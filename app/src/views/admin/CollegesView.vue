<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Plus, ChevronDown, ChevronUp, Trash2 } from "lucide-vue-next";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  createCollege,
  createOrganization,
  deleteOrganization,
  fetchCollegesWithOrganizations,
  type CollegeWithOrgs,
} from "@/services/collegesDb";
import { UNIVERSITY_WIDE_COLLEGE_CODE } from "@/services/organizationsDb";

const colleges = ref<CollegeWithOrgs[]>([]);

const universityWide = computed(() =>
  colleges.value.find((c) => c.code === UNIVERSITY_WIDE_COLLEGE_CODE) ?? null,
);

const collegeList = computed(() =>
  colleges.value.filter((c) => c.code !== UNIVERSITY_WIDE_COLLEGE_CODE),
);
const loading = ref(false);
const expandedCollege = ref<string | null>(null);
const newCollegeName = ref("");
const newCollegeCode = ref("");
const newOrgName = ref("");
const addingOrgFor = ref<string | null>(null);

async function load() {
  if (!isSupabaseConfigured) return;
  loading.value = true;
  try {
    colleges.value = await fetchCollegesWithOrganizations();
  } catch (e) {
    window.alert(e instanceof Error ? e.message : String(e));
  } finally {
    loading.value = false;
  }
}

onMounted(() => void load());

function toggleCollege(id: string) {
  expandedCollege.value = expandedCollege.value === id ? null : id;
}

async function addCollege() {
  if (!newCollegeName.value.trim()) return;
  try {
    await createCollege(newCollegeName.value, newCollegeCode.value || newCollegeName.value.slice(0, 6));
    newCollegeName.value = "";
    newCollegeCode.value = "";
    await load();
  } catch (e) {
    window.alert(e instanceof Error ? e.message : String(e));
  }
}

async function addOrganization(collegeId: string) {
  if (!newOrgName.value.trim()) return;
  try {
    await createOrganization(collegeId, newOrgName.value);
    newOrgName.value = "";
    addingOrgFor.value = null;
    await load();
  } catch (e) {
    window.alert(e instanceof Error ? e.message : String(e));
  }
}

async function removeOrg(id: string) {
  if (!window.confirm("Delete this organization?")) return;
  try {
    await deleteOrganization(id);
    await load();
  } catch (e) {
    window.alert(e instanceof Error ? e.message : String(e));
  }
}
</script>

<template>
  <div class="p-8">
    <div class="mb-8">
      <h1 class="mb-2 text-3xl font-semibold text-gray-900">Colleges & organizations</h1>
      <p class="text-gray-600">
        Add colleges and student organizations. Officers only see organizations from their college when creating events.
        SSC (Supreme Student Council) is university-wide and listed separately—not under CCSICT or other colleges.
      </p>
    </div>

    <div class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 class="mb-4 font-semibold text-gray-900">Add college</h3>
      <div class="flex flex-col gap-3 sm:flex-row">
        <input
          v-model="newCollegeName"
          type="text"
          placeholder="College name"
          class="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          v-model="newCollegeCode"
          type="text"
          placeholder="Code (e.g. CCSICT)"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 sm:w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          class="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
          @click="addCollege"
        >
          <Plus class="h-5 w-5" />
          Add
        </button>
      </div>
    </div>

    <p v-if="loading" class="text-sm text-gray-500">Loading…</p>

    <div v-if="universityWide" class="mb-6 rounded-lg border border-purple-200 bg-purple-50/50 shadow-sm">
      <div class="border-b border-purple-100 px-6 py-4">
        <h3 class="text-lg font-semibold text-gray-900">{{ universityWide.name }}</h3>
        <p class="text-sm text-gray-600">
          University-wide body (not a college org). SSC events use this organization—not CCSICT student orgs.
        </p>
      </div>
      <ul class="divide-y divide-purple-100">
        <li
          v-for="org in universityWide.organizations"
          :key="org.id"
          class="flex items-center justify-between px-6 py-3"
        >
          <span class="font-medium text-gray-800">{{ org.name }}</span>
          <span class="text-xs text-purple-700">SSC · slug: {{ org.slug || "ssc" }}</span>
        </li>
        <li v-if="!universityWide.organizations.length" class="px-6 py-4 text-sm text-gray-400">
          Run migration / seed for SSC (supabase/seed/03_ssc_organization.sql).
        </li>
      </ul>
    </div>

    <div class="space-y-4">
      <div
        v-for="college in collegeList"
        :key="college.id"
        class="rounded-lg border border-gray-200 bg-white shadow-sm"
      >
        <div
          class="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50"
          role="button"
          tabindex="0"
          @click="toggleCollege(college.id)"
        >
          <div class="min-w-0 flex-1">
            <h3 class="text-lg font-semibold text-gray-900">{{ college.name }}</h3>
            <p v-if="college.code" class="text-sm text-gray-600">Code: {{ college.code }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-4">
            <span class="rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">
              {{ college.organizations.length }} org{{ college.organizations.length === 1 ? "" : "s" }}
            </span>
            <ChevronUp v-if="expandedCollege === college.id" class="h-5 w-5 text-gray-500" />
            <ChevronDown v-else class="h-5 w-5 text-gray-500" />
          </div>
        </div>

        <div v-if="expandedCollege === college.id" class="border-t border-gray-200">
          <div
            v-if="addingOrgFor === college.id"
            class="border-b border-gray-200 bg-blue-50 px-6 py-4"
          >
            <h4 class="mb-3 font-medium text-gray-900">New organization</h4>
            <div class="flex flex-col gap-3 sm:flex-row">
              <input
                v-model="newOrgName"
                type="text"
                placeholder="Organization name"
                class="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                @click.stop="addOrganization(college.id)"
              >
                Save
              </button>
              <button
                type="button"
                class="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                @click.stop="addingOrgFor = null"
              >
                Cancel
              </button>
            </div>
          </div>

          <ul class="divide-y divide-gray-100">
            <li
              v-for="org in college.organizations"
              :key="org.id"
              class="flex items-center justify-between px-6 py-3 hover:bg-gray-50"
            >
              <span class="font-medium text-gray-800">{{ org.name }}</span>
              <button
                type="button"
                class="rounded-lg p-2 text-red-600 hover:bg-red-50"
                title="Delete organization"
                @click.stop="removeOrg(org.id)"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </li>
            <li v-if="!college.organizations.length" class="px-6 py-4 text-sm text-gray-400">
              No organizations yet.
            </li>
          </ul>

          <div class="border-t border-gray-200 bg-gray-50 px-6 py-4">
            <button
              type="button"
              class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              @click.stop="addingOrgFor = college.id"
            >
              <Plus class="h-4 w-4" />
              Add organization
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
