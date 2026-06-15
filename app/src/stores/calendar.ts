import { defineStore } from "pinia";
import { ref } from "vue";

export const useCalendarStore = defineStore("calendar", () => {
  const selectedDate = ref<string | null>(null);
  return { selectedDate };
});
