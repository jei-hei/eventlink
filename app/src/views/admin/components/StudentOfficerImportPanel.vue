<script setup lang="ts">
import { computed, ref } from "vue";
import { Download, FileSpreadsheet, Upload } from "lucide-vue-next";
import StatusBadge from "@/components/portal/StatusBadge.vue";
import { fetchOfficerImportCatalog, importStudentOfficers, type OfficerImportRowResult } from "@/services/officerImportDb";
import {
  OFFICER_IMPORT_MAX_BYTES,
  OFFICER_IMPORT_MAX_ROWS,
  downloadOfficerTemplate,
  officerImportCanConfirm,
  parseOfficerCsv,
  parseOfficerXlsx,
  validateOfficerImportRows,
  type OfficerImportPreviewRow,
  type OfficerImportRow,
} from "@/services/officerImportParser";
import { useUiStore } from "@/stores/ui";
import { toUserFacingError } from "@/utils/userFacingError";

const emit = defineEmits<{ imported: [] }>();
const ui = useUiStore();
const fileInput = ref<HTMLInputElement | null>(null);
const previewRows = ref<OfficerImportPreviewRow[]>([]);
const resultRows = ref<OfficerImportRowResult[]>([]);
const parsing = ref(false);
const importing = ref(false);
const summary = ref<string | null>(null);

function statusTone(status: string) {
  if (status === "Valid" || status === "Success") return "success" as const;
  if (status === "Duplicate" || status === "Skipped") return "info" as const;
  if (status === "Warning") return "warning" as const;
  return "danger" as const;
}

const canConfirm = computed(() => officerImportCanConfirm(previewRows.value) && !importing.value && !parsing.value);

function triggerUpload() {
  fileInput.value?.click();
}

function downloadTemplate() {
  downloadOfficerTemplate();
  ui.pushToast("Template downloaded", "Replace the EXAMPLE row before uploading. Example rows are not imported.", "info");
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  previewRows.value = [];
  resultRows.value = [];
  summary.value = null;
  if (file.size > OFFICER_IMPORT_MAX_BYTES) {
    ui.pushToast("File too large", "Use a CSV or XLSX file smaller than 1 MB.", "error");
    return;
  }
  parsing.value = true;
  try {
    const name = file.name.toLowerCase();
    let parsed: OfficerImportRow[];
    if (name.endsWith(".csv")) parsed = parseOfficerCsv(await file.text());
    else if (name.endsWith(".xlsx")) parsed = await parseOfficerXlsx(await file.arrayBuffer());
    else if (name.endsWith(".xls")) {
      ui.pushToast("Legacy XLS is not supported", "Save as XLSX or CSV and upload again.", "error");
      return;
    } else {
      ui.pushToast("Unsupported file", "Use CSV or XLSX.", "error");
      return;
    }
    if (parsed.length > OFFICER_IMPORT_MAX_ROWS) {
      ui.pushToast("Too many rows", `Import at most ${OFFICER_IMPORT_MAX_ROWS} Student Officers at a time.`, "error");
      return;
    }
    const catalog = await fetchOfficerImportCatalog(parsed.map((r) => r.studentId));
    previewRows.value = validateOfficerImportRows(parsed, catalog);
    if (!previewRows.value.length) {
      ui.pushToast("Nothing to import", "No data rows were found. Example rows are skipped.", "info");
      return;
    }
    const invalid = previewRows.value.filter((r) => r.status === "Invalid").length;
    ui.pushToast(
      "Import preview ready",
      invalid
        ? `${previewRows.value.length} row(s) parsed. ${invalid} cannot be imported.`
        : `${previewRows.value.length} row(s) parsed. Review the preview, then confirm.`,
      invalid ? "warning" : "success",
    );
  } catch (err) {
    console.error(err);
    ui.pushToast("Could not read file", toUserFacingError(err, "Use the downloadable template and try again."), "error");
  } finally {
    parsing.value = false;
  }
}

async function confirmImport() {
  if (!canConfirm.value) return;
  importing.value = true;
  try {
    const result = await importStudentOfficers(previewRows.value);
    resultRows.value = result.rows;
    summary.value = `Student Officer Import Complete. Total rows: ${result.total}. Successful: ${result.successful}. Failed: ${result.failed}. Skipped: ${result.skipped}. Invitations sent: ${result.invitations}.`;
    ui.pushToast(
      result.failed ? "Import finished with errors" : "Import completed",
      summary.value,
      result.failed ? "warning" : "success",
    );
    previewRows.value = [];
    emit("imported");
  } catch (err) {
    summary.value = `Import failed. ${toUserFacingError(err, "Some rows may not have been processed.")}`;
    ui.pushToast("Import failed", toUserFacingError(err, "Try again after checking the preview."), "error");
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <section
    class="dash-card min-w-0 p-3"
    :class="previewRows.length || resultRows.length ? 'md:col-span-3' : ''"
  >
    <h2 class="text-sm font-bold text-slate-900">Student Officers</h2>
    <p class="mt-1 text-xs text-slate-600">
      Invite officers from a spreadsheet. Missing student registry rows are added. No passwords.
    </p>
    <input ref="fileInput" type="file" accept=".csv,.xlsx,.xls" class="sr-only" @change="onFile" />
    <div class="mt-3 flex flex-col gap-1.5">
      <button type="button" class="portal-btn-secondary w-full justify-center text-xs" @click="downloadTemplate">
        <Download class="h-3.5 w-3.5" />
        Download Template
      </button>
      <button type="button" class="portal-btn w-full justify-center text-xs" :disabled="parsing || importing" @click="triggerUpload">
        <Upload class="h-3.5 w-3.5" />
        {{ parsing ? "Reading…" : "Upload File" }}
      </button>
      <button type="button" class="portal-btn w-full justify-center text-xs" :disabled="!canConfirm" @click="confirmImport">
        <FileSpreadsheet class="h-3.5 w-3.5" />
        {{ importing ? "Importing…" : "Confirm import" }}
      </button>
    </div>
    <p v-if="summary" class="mt-3 text-sm text-slate-700">{{ summary }}</p>

    <div v-if="previewRows.length" class="mt-4 overflow-x-auto">
      <table class="portal-table min-w-[960px]">
        <thead>
          <tr>
            <th>Row</th>
            <th>Student ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>College</th>
            <th>Organization</th>
            <th>Position</th>
            <th>Status</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in previewRows" :key="`p-${row.row}-${row.studentId}`">
            <td class="font-mono text-xs">{{ row.row }}</td>
            <td class="font-mono text-xs">{{ row.studentId || "—" }}</td>
            <td>{{ row.fullName || "—" }}</td>
            <td class="text-xs">{{ row.email || "—" }}</td>
            <td>{{ row.college || "—" }}</td>
            <td>{{ row.organization || "—" }}</td>
            <td>{{ row.position || "—" }}</td>
            <td><StatusBadge :label="row.status" :tone="statusTone(row.status)" /></td>
            <td class="text-xs text-slate-600">{{ row.message }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="resultRows.length" class="mt-4 overflow-x-auto">
      <table class="portal-table min-w-[960px]">
        <thead>
          <tr>
            <th>Row</th>
            <th>Student ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>College</th>
            <th>Organization</th>
            <th>Position</th>
            <th>Status</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in resultRows" :key="`r-${row.row}-${row.student_id}`">
            <td class="font-mono text-xs">{{ row.row }}</td>
            <td class="font-mono text-xs">{{ row.student_id || "—" }}</td>
            <td>{{ row.full_name || "—" }}</td>
            <td class="text-xs">{{ row.email || "—" }}</td>
            <td>{{ row.college || "—" }}</td>
            <td>{{ row.organization || "—" }}</td>
            <td>{{ row.position || "—" }}</td>
            <td><StatusBadge :label="row.status" :tone="statusTone(row.status)" /></td>
            <td class="text-xs text-slate-600">{{ row.message }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
