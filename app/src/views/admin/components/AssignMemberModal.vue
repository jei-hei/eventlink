<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { X } from "lucide-vue-next";

interface SscMemberPayload {
  studentName: string;
  position: string;
  college: string;
  program: string;
}

interface Student {
  id: number;
  name: string;
  college: string;
  program: string;
}

const props = defineProps<{
  open: boolean;
  availablePositions: string[];
  currentMembers: Array<{ position: string }>;
}>();
const emit = defineEmits<{ close: []; assign: [member: SscMemberPayload] }>();

const selectedStudent = ref("");
const selectedPosition = ref("");

const allStudents: Student[] = [
  { id: 1, name: "John Doe", college: "College of Engineering", program: "Computer Science" },
  { id: 2, name: "Jane Smith", college: "College of Arts and Sciences", program: "Psychology" },
  { id: 3, name: "Bob Wilson", college: "College of Engineering", program: "Electronics Engineering" },
  { id: 4, name: "Alice Brown", college: "College of Business", program: "Accounting" },
  { id: 5, name: "Emily Davis", college: "College of Business", program: "Finance" },
  { id: 6, name: "Chris Martin", college: "College of Arts and Sciences", program: "Biology" },
  { id: 7, name: "Lisa Anderson", college: "College of Arts and Sciences", program: "English" },
  { id: 8, name: "David Lee", college: "College of Engineering", program: "Civil Engineering" },
  { id: 9, name: "Maria Garcia", college: "College of Business", program: "Marketing" },
  { id: 10, name: "Tom Harris", college: "College of Engineering", program: "Information Technology" },
];

const occupiedPositions = computed(() => props.currentMembers.map((m) => m.position));

const availablePositionOptions = computed(() =>
  props.availablePositions.filter((pos) => !occupiedPositions.value.includes(pos)),
);

const selectedStudentRecord = computed(() =>
  allStudents.find((s) => s.name === selectedStudent.value),
);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      selectedStudent.value = "";
      selectedPosition.value = "";
    }
  },
);

function handleSubmit(e: Event) {
  e.preventDefault();
  const student = allStudents.find((s) => s.name === selectedStudent.value);
  if (!student) return;
  emit("assign", {
    studentName: student.name,
    position: selectedPosition.value,
    college: student.college,
    program: student.program,
  });
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full">
      <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-900">Assign SSC Member</h2>
        <button
          type="button"
          class="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <form class="p-6 space-y-4" @submit="handleSubmit">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Select Student <span class="text-red-500">*</span>
          </label>
          <select
            v-model="selectedStudent"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose a student</option>
            <option v-for="student in allStudents" :key="student.id" :value="student.name">
              {{ student.name }} - {{ student.program }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Assign to Position <span class="text-red-500">*</span>
          </label>
          <select
            v-model="selectedPosition"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose a position</option>
            <option v-for="position in availablePositionOptions" :key="position" :value="position">
              {{ position }}
            </option>
          </select>
          <p v-if="availablePositionOptions.length === 0" class="mt-2 text-sm text-red-600">
            All positions are filled. Please add a new position or remove an existing member.
          </p>
        </div>

        <div v-if="selectedStudent && selectedStudentRecord" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p class="text-sm font-medium text-gray-700 mb-1">Selected Student:</p>
          <p class="text-gray-900">{{ selectedStudentRecord.name }}</p>
          <p class="text-sm text-gray-600">
            {{ selectedStudentRecord.college }} - {{ selectedStudentRecord.program }}
          </p>
        </div>

        <div class="flex gap-3 pt-4">
          <button
            type="submit"
            :disabled="availablePositionOptions.length === 0"
            class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Assign Member
          </button>
          <button
            type="button"
            class="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            @click="emit('close')"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
