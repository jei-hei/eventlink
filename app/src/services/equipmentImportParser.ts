import { downloadCsv } from "@/utils/downloadCsv";
export const EQUIPMENT_IMPORT_MAX_BYTES = 1_000_000;
export const EQUIPMENT_IMPORT_MAX_ROWS = 200;

export type EquipmentImportStatus = "Valid" | "Duplicate" | "Invalid" | "Warning";

export type EquipmentImportRow = {
  row: number;
  name: string;
  quantity: number;
  description: string;
  status: string;
  availability: string;
};

export type EquipmentImportPreviewRow = EquipmentImportRow & {
  statusLabel: EquipmentImportStatus;
  message: string;
};

type HeaderField = "name" | "quantity" | "description" | "status" | "availability";

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQ = !inQ;
      continue;
    }
    if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function headerKey(h: string): HeaderField | null {
  const x = normalizeHeader(h);
  if (["name", "equipment", "equipment_name", "item"].includes(x)) return "name";
  if (["quantity", "qty", "quantity_available", "available"].includes(x)) return "quantity";
  if (["description", "details", "notes"].includes(x)) return "description";
  if (["status", "active"].includes(x)) return "status";
  if (["availability"].includes(x)) return "availability";
  return null;
}

export function isEquipmentExampleRow(row: Pick<EquipmentImportRow, "name">): boolean {
  return row.name.trim().toLowerCase().startsWith("example ");
}

function parseQuantity(raw: string): number | null {
  if (!raw.trim()) return 0;
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function normalizeStatus(raw: string): string {
  const x = raw.trim().toLowerCase();
  if (!x || x === "active" || x === "true" || x === "yes" || x === "1") return "active";
  if (x === "inactive" || x === "false" || x === "no" || x === "0") return "inactive";
  return raw.trim();
}

function normalizeAvailability(raw: string): string {
  const x = raw.trim().toLowerCase();
  if (!x || x === "available") return "available";
  if (x === "unavailable") return "unavailable";
  return raw.trim();
}

function rowFromCells(
  cells: string[],
  headerMap: { index: number; key: HeaderField }[],
  rowIndex: number,
): EquipmentImportRow | null {
  const obj: Partial<Record<HeaderField, string>> = {};
  for (const { index, key } of headerMap) {
    obj[key] = cells[index] ?? "";
  }
  const name = (obj.name ?? "").trim();
  const description = (obj.description ?? "").trim();
  const quantityRaw = obj.quantity ?? "";
  if (!name && !description && !quantityRaw.trim()) return null;
  return {
    row: rowIndex,
    name,
    quantity: parseQuantity(quantityRaw) ?? Number.NaN,
    description,
    status: normalizeStatus(obj.status ?? ""),
    availability: normalizeAvailability(obj.availability ?? ""),
  };
}

function parseGrid(rows: string[][]): EquipmentImportRow[] {
  if (rows.length < 2) {
    throw new Error("The file has no data rows.");
  }
  const headerMap: { index: number; key: HeaderField }[] = [];
  rows[0]!.forEach((value, index) => {
    const key = headerKey(String(value ?? ""));
    if (key && !headerMap.some((h) => h.key === key)) headerMap.push({ index, key });
  });
  if (!headerMap.some((h) => h.key === "name")) {
    throw new Error("The file must include a name (or equipment) column.");
  }

  const parsed: EquipmentImportRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rowFromCells(rows[i] ?? [], headerMap, i + 1);
    if (row) parsed.push(row);
  }
  return parsed;
}

export function parseEquipmentCsv(text: string): EquipmentImportRow[] {
  const rawLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return parseGrid(rawLines.map((line) => splitCsvLine(line)));
}

export async function parseEquipmentXlsx(buffer: ArrayBuffer): Promise<EquipmentImportRow[]> {
  const { readSheet } = await import("read-excel-file/browser");
  const sheetRows = await readSheet(buffer);
  return parseGrid(sheetRows.map((row) => row.map((value) => String(value ?? "").trim())));
}

export function downloadEquipmentTemplate(): void {
  downloadCsv("eventlink-equipment-template.csv", [
    ["name", "quantity", "description", "status", "availability"],
    ["EXAMPLE Projector", "5", "Example row — replace before upload", "active", "available"],
  ]);
}

export function downloadEquipmentData(
  rows: Array<{
    name: string;
    quantity_available: number;
    description: string;
    status: string;
    availability: string;
  }>,
): void {
  downloadCsv("eventlink-equipment.csv", [
    ["name", "quantity", "description", "status", "availability"],
    ...rows.map((row) => [
      row.name,
      String(row.quantity_available),
      row.description,
      row.status,
      row.availability,
    ]),
  ]);
}

export function validateEquipmentImportRows(
  rows: EquipmentImportRow[],
  existingNames: string[],
): EquipmentImportPreviewRow[] {
  const existing = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const seen = new Set<string>();
  const out: EquipmentImportPreviewRow[] = [];

  for (const row of rows) {
    if (isEquipmentExampleRow(row)) continue;

    const preview: EquipmentImportPreviewRow = {
      ...row,
      statusLabel: "Valid",
      message: "New equipment will be created.",
    };

    if (!row.name) {
      preview.statusLabel = "Invalid";
      preview.message = "Equipment name is required.";
    } else if (row.name.length > 200) {
      preview.statusLabel = "Invalid";
      preview.message = "Name is too long.";
    } else if (!Number.isFinite(row.quantity)) {
      preview.statusLabel = "Invalid";
      preview.message = "Quantity must be a whole number 0 or greater.";
    } else if (row.status !== "active" && row.status !== "inactive") {
      preview.statusLabel = "Invalid";
      preview.message = "Status must be active or inactive.";
    } else if (row.availability !== "available" && row.availability !== "unavailable") {
      preview.statusLabel = "Invalid";
      preview.message = "Availability must be available or unavailable.";
    } else {
      const key = row.name.toLowerCase();
      if (seen.has(key)) {
        preview.statusLabel = "Invalid";
        preview.message = "Duplicate name in this file.";
      } else if (existing.has(key)) {
        preview.statusLabel = "Duplicate";
        preview.message = "Already in the equipment catalog. Row will be skipped.";
      }
      seen.add(key);
    }

    out.push(preview);
  }
  return out;
}

export function equipmentImportHasBlockers(rows: EquipmentImportPreviewRow[]): boolean {
  return !rows.some((r) => r.statusLabel === "Valid") || rows.some((r) => r.statusLabel === "Invalid");
}
