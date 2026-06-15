<script setup lang="ts">
import { ref, computed } from "vue";
import { UserPlus, Plus, Trash2, Edit2 } from "lucide-vue-next";
import AssignMemberModal from "./components/AssignMemberModal.vue";
import ChangeAdviserModal from "./components/ChangeAdviserModal.vue";
import { useUiStore } from "@/stores/ui";

interface SSCMember {
  id: number;
  studentName: string;
  position: string;
  college: string;
  program: string;
}

const ui = useUiStore();
const adviser = ref("Dr. Mike Johnson");
const assignMemberOpen = ref(false);
const changeAdviserOpen = ref(false);
const isAddingPosition = ref(false);
const newPositionName = ref("");

const defaultPositions = [
  "President",
  "Vice President",
  "Secretary",
  "Treasurer",
  "Accountant",
  "Auditor",
];
const customPositions = ref<string[]>(["Public Relations Officer", "Events Coordinator"]);

const allPositions = computed(() => [...defaultPositions, ...customPositions.value]);

const members = ref<SSCMember[]>([
  {
    id: 1,
    studentName: "John Doe",
    position: "President",
    college: "College of Engineering",
    program: "Computer Science",
  },
  {
    id: 2,
    studentName: "Jane Smith",
    position: "Vice President",
    college: "College of Arts and Sciences",
    program: "Psychology",
  },
  {
    id: 3,
    studentName: "Bob Wilson",
    position: "Secretary",
    college: "College of Engineering",
    program: "Electronics Engineering",
  },
  {
    id: 4,
    studentName: "Alice Brown",
    position: "Treasurer",
    college: "College of Business",
    program: "Accounting",
  },
  {
    id: 5,
    studentName: "Emily Davis",
    position: "Accountant",
    college: "College of Business",
    program: "Finance",
  },
  {
    id: 6,
    studentName: "Chris Martin",
    position: "Auditor",
    college: "College of Engineering",
    program: "Civil Engineering",
  },
  {
    id: 7,
    studentName: "Lisa Anderson",
    position: "Public Relations Officer",
    college: "College of Arts and Sciences",
    program: "English",
  },
]);

function handleAddPosition() {
  if (newPositionName.value.trim()) {
    customPositions.value = [...customPositions.value, newPositionName.value.trim()];
    newPositionName.value = "";
    isAddingPosition.value = false;
  }
}

function handleRemoveMember(memberId: number) {
  members.value = members.value.filter((m) => m.id !== memberId);
}

function handleRemovePosition(position: string) {
  if (!customPositions.value.includes(position)) return;
  const hasMember = members.value.some((m) => m.position === position);
  if (hasMember) {
    window.alert(
      "Cannot remove position that has assigned members. Please remove the member first.",
    );
  } else {
    customPositions.value = customPositions.value.filter((p) => p !== position);
  }
}

function editMember(member: SSCMember) {
  const next = window.prompt("Position title", member.position);
  if (!next?.trim()) return;
  members.value = members.value.map((m) =>
    m.id === member.id ? { ...m, position: next.trim() } : m,
  );
  ui.pushToast("Position updated", `${member.studentName} is now ${next.trim()}.`, "success");
}

function onAssignMember(payload: {
  studentName: string;
  position: string;
  college: string;
  program: string;
}) {
  const nextId = Math.max(...members.value.map((m) => m.id), 0) + 1;
  members.value = [
    ...members.value,
    {
      id: nextId,
      studentName: payload.studentName,
      position: payload.position,
      college: payload.college,
      program: payload.program,
    },
  ];
  assignMemberOpen.value = false;
}

function onAdviserChange(next: string) {
  adviser.value = next;
  changeAdviserOpen.value = false;
}
</script>

<template>
  <div class="p-8">
    <div class="mb-8">
      <h1 class="text-3xl font-semibold text-gray-900 mb-2">SSC Management</h1>
      <p class="text-gray-600">Manage Student Supreme Council members and positions.</p>
    </div>

    <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="font-semibold text-lg text-gray-900">Student Supreme Council</h3>
      </div>
      <div class="p-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <p class="text-sm font-medium text-gray-700 mb-1">Current Adviser</p>
            <p class="text-lg text-gray-900">{{ adviser }}</p>
          </div>
          <button
            type="button"
            class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
            @click="changeAdviserOpen = true"
          >
            Change Adviser
          </button>
        </div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-gray-700 mb-1">Total Members</p>
            <p class="text-2xl font-semibold text-gray-900">{{ members.length }}</p>
          </div>
          <button
            type="button"
            class="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            @click="assignMemberOpen = true"
          >
            <UserPlus class="w-5 h-5" />
            Assign Member
          </button>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div class="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 class="font-semibold text-lg text-gray-900">SSC Positions</h3>
        <button
          type="button"
          class="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors w-fit"
          @click="isAddingPosition = true"
        >
          <Plus class="w-4 h-4" />
          Add New Position
        </button>
      </div>

      <div v-if="isAddingPosition" class="px-6 py-4 bg-blue-50 border-b border-gray-200">
        <label class="block text-sm font-medium text-gray-700 mb-2">New Position Name</label>
        <div class="flex flex-col sm:flex-row gap-3">
          <input
            v-model="newPositionName"
            type="text"
            placeholder="Enter position name"
            class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autofocus
          />
          <div class="flex gap-3">
            <button
              type="button"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              @click="handleAddPosition"
            >
              Add
            </button>
            <button
              type="button"
              class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              @click="
                isAddingPosition = false;
                newPositionName = '';
              "
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div class="p-6">
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div
            v-for="position in allPositions"
            :key="position"
            :class="[
              'relative px-4 py-3 rounded-lg border-2',
              members.find((m) => m.position === position)
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 bg-white',
            ]"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <p
                  :class="[
                    'font-medium text-sm',
                    members.find((m) => m.position === position)
                      ? 'text-green-900'
                      : 'text-gray-900',
                  ]"
                >
                  {{ position }}
                </p>
                <p
                  v-if="members.find((m) => m.position === position)"
                  class="text-xs text-green-700 mt-1 truncate"
                >
                  {{ members.find((m) => m.position === position)?.studentName }}
                </p>
              </div>
              <button
                v-if="customPositions.includes(position) && !members.find((m) => m.position === position)"
                type="button"
                class="p-1 text-gray-400 hover:text-red-600 transition-colors shrink-0"
                title="Remove position"
                @click="handleRemovePosition(position)"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="font-semibold text-lg text-gray-900">SSC Members</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Student Name
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Position
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                College
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Program
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Adviser
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-if="members.length === 0">
              <td colspan="6" class="px-6 py-12 text-center text-gray-500">
                No members assigned yet. Click "Assign Member" to add members to the SSC.
              </td>
            </tr>
            <tr v-for="member in members" :key="member.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="font-medium text-gray-900">{{ member.studentName }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">{{
                  member.position
                }}</span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-600">{{ member.college }}</td>
              <td class="px-6 py-4 text-sm text-gray-600">{{ member.program }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{{ adviser }}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit position"
                    @click="editMember(member)"
                  >
                    <Edit2 class="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove"
                    @click="handleRemoveMember(member.id)"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AssignMemberModal
      :open="assignMemberOpen"
      :available-positions="allPositions"
      :current-members="members"
      @close="assignMemberOpen = false"
      @assign="onAssignMember"
    />

    <ChangeAdviserModal
      :open="changeAdviserOpen"
      :current-adviser="adviser"
      @close="changeAdviserOpen = false"
      @change="onAdviserChange"
    />
  </div>
</template>
