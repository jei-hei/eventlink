import { defineStore } from "pinia";
import { ref } from "vue";

/** Placeholder until Supabase-backed events API is wired. */
export const useEventsStore = defineStore("events", () => {
  const loading = ref(false);
  function setLoading(v: boolean) {
    loading.value = v;
  }
  return { loading, setLoading };
});
