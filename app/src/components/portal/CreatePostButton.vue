<script setup lang="ts">
import { ref } from "vue";
import { PenSquare } from "lucide-vue-next";
import type { PortalEvent } from "@/types/portalEvent";
import type { CreateStudentFeedPostInput } from "@/types/studentPost";
import CreateStudentPostModal from "@/components/portal/CreateStudentPostModal.vue";
import { toUserFacingError } from "@/utils/userFacingError";

const props = defineProps<{
  myEvents?: PortalEvent[];
  publishFn: (payload: CreateStudentFeedPostInput) => Promise<void>;
  size?: "sm" | "md";
}>();

const composerOpen = ref(false);
const publishing = ref(false);

async function onPublish(payload: CreateStudentFeedPostInput) {
  if (publishing.value) return;
  publishing.value = true;
  try {
    await props.publishFn(payload);
    composerOpen.value = false;
  } catch (e) {
    window.alert(toUserFacingError(e, "Could not save the post. Please try again."));
  } finally {
    publishing.value = false;
  }
}
</script>

<template>
  <button
    type="button"
    :class="[
      'btn-gradient inline-flex items-center gap-1.5 shadow',
      size === 'md' ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs',
    ]"
    @click="composerOpen = true"
  >
    <PenSquare :size="size === 'md' ? 16 : 14" />
    Create post
  </button>

  <CreateStudentPostModal
    :open="composerOpen"
    :my-events="myEvents"
    :publishing="publishing"
    @close="composerOpen = false"
    @publish="onPublish"
  />
</template>
