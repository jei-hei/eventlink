<script setup lang="ts">
import { useRouter } from "vue-router";

const props = defineProps<{
  /** Portal home route, e.g. `/ssc` */
  to: string;
}>();

const router = useRouter();

function go() {
  void router.push(props.to);
}
</script>

<template>
  <button
    type="button"
    class="text-xs text-[#16A34A] font-semibold hover:underline"
    @click="go"
  >
    View all →
  </button>
</template>
