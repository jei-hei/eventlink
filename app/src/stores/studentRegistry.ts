import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchAllStudents,
  updateStudentById,
  upsertStudents,
} from "@/services/studentRegistryDb";
import type { MasterStudent } from "@/types/studentRegistry";
import { isValidStudentIdFormat, normalizeStudentId } from "@/types/studentRegistry";

export const useStudentRegistryStore = defineStore("studentRegistry", () => {
  const students = ref<MasterStudent[]>([]);
  const loading = ref(false);
  const loadError = ref<string | null>(null);
  const useSupabase = ref(isSupabaseConfigured);

  const activeStudents = computed(() => students.value.filter((s) => !s.archived));

  const byStudentId = computed(() => {
    const m = new Map<string, MasterStudent>();
    for (const s of activeStudents.value) {
      const id = normalizeStudentId(s.studentId);
      if (id) m.set(id, s);
    }
    return m;
  });

  function mergeImportLocal(rows: MasterStudent[]) {
    const map = new Map<string, MasterStudent>();
    for (const s of students.value) {
      const id = normalizeStudentId(s.studentId);
      if (id) map.set(id, { ...s });
    }
    for (const s of rows) {
      const id = normalizeStudentId(s.studentId);
      if (!id) continue;
      const prev = map.get(id);
      map.set(id, {
        ...(prev ?? {}),
        ...s,
        studentId: id,
        id: prev?.id ?? id,
        archived: s.archived ?? prev?.archived ?? false,
      });
    }
    students.value = Array.from(map.values());
  }

  async function fetchAll() {
    if (!useSupabase.value) return;
    loading.value = true;
    loadError.value = null;
    try {
      students.value = await fetchAllStudents();
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : "Could not load student registry.";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function mergeImport(rows: MasterStudent[]) {
    if (!useSupabase.value) {
      mergeImportLocal(rows);
      return;
    }
    await upsertStudents(rows);
    await fetchAll();
  }

  async function updateStudent(studentId: string, patch: Partial<MasterStudent>) {
    const id = normalizeStudentId(studentId);
    if (!useSupabase.value) {
      students.value = students.value.map((s) =>
        normalizeStudentId(s.studentId) === id ? { ...s, ...patch, studentId: id } : s,
      );
      return;
    }
    await updateStudentById(id, patch);
    const idx = students.value.findIndex((s) => normalizeStudentId(s.studentId) === id);
    if (idx >= 0) {
      students.value[idx] = { ...students.value[idx]!, ...patch, studentId: id };
    } else {
      await fetchAll();
    }
  }

  async function setArchived(studentId: string, archived: boolean) {
    await updateStudent(studentId, { archived });
  }

  function lookup(studentId: string): MasterStudent | null {
    const id = normalizeStudentId(studentId);
    if (!isValidStudentIdFormat(id)) return null;
    return byStudentId.value.get(id) ?? null;
  }

  /** In-memory demo when Supabase env is not configured. */
  function seedDemo() {
    if (useSupabase.value || students.value.length > 0) return;
    students.value = [
      {
        id: "23-0669",
        studentId: "23-0669",
        fullName: "Maria Santos",
        course: "CCSICT",
        program: "BSIT",
        yearLevel: "",
        email: "maria.santos@isu.edu.ph",
      },
    ];
  }

  return {
    students,
    loading,
    loadError,
    useSupabase,
    activeStudents,
    fetchAll,
    mergeImport,
    updateStudent,
    setArchived,
    lookup,
    seedDemo,
  };
});
