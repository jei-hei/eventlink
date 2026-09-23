<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  Plus,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Users,
  Dumbbell,
  HeartPulse,
  Calendar,
} from "lucide-vue-next";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useEventRequestsStore } from "@/stores/eventRequests";

export interface ScheduledCalendarEvent {
  id?: string;
  date: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  name: string;
  venue?: string;
  organization?: string;
  eventType?: string;
  status?: string;
  completed?: boolean;
}

const props = withDefaults(
  defineProps<{
    events: ScheduledCalendarEvent[];
    showAddButton?: boolean;
    title?: string;
    /** When true, clicking an event chip emits `select` (e.g. EO edit). */
    selectable?: boolean;
    /** Places the compact list beside the month grid on desktop. */
    listLayout?: "management" | "calendar-only" | "below";
    /** Max events shown in the compact upcoming/past side list. */
    upcomingLimit?: number;
  }>(),
  {
    showAddButton: false,
    title: "Scheduled events",
    selectable: false,
    listLayout: "management",
    upcomingLimit: 6,
  },
);

const emit = defineEmits<{
  add: [];
  select: [event: ScheduledCalendarEvent];
  monthChange: [payload: { year: number; month: number; startDate: string; endDate: string }];
}>();

const today = new Date();
today.setHours(0, 0, 0, 0);
const now = new Date();

const viewYear = ref(today.getFullYear());
const viewMonth = ref(today.getMonth());

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const THEME_CLASSES = [
  "bg-emerald-100 border-emerald-300/70 text-emerald-950",
  "bg-teal-100 border-teal-300/70 text-teal-950",
  "bg-green-100 border-green-300/70 text-green-950",
  "bg-[#dcfce7] border-[#86efac]/80 text-[#14532d]",
] as const;

const monthLabel = computed(() =>
  new Date(viewYear.value, viewMonth.value, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  }),
);

const daysInMonth = computed(() => new Date(viewYear.value, viewMonth.value + 1, 0).getDate());

const leadingBlanks = computed(() => new Date(viewYear.value, viewMonth.value, 1).getDay());

const calendarCells = computed(() => {
  const cells: Array<{ key: string; day: number | null }> = [];
  for (let i = 0; i < leadingBlanks.value; i++) {
    cells.push({ key: `pad-${i}`, day: null });
  }
  for (let d = 1; d <= daysInMonth.value; d++) {
    cells.push({ key: `d-${d}`, day: d });
  }
  return cells;
});

type WeekCell = { key: string; day: number | null; col: number; date: Date | null };
type WeekBar = {
  key: string;
  event: ScheduledCalendarEvent;
  startCol: number;
  endCol: number;
  lane: number;
};

function hashKey(event: ScheduledCalendarEvent): string {
  return event.id ?? event.name;
}

function chipIndex(event: ScheduledCalendarEvent): number {
  const key = hashKey(event);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % THEME_CLASSES.length;
}

function isEventToday(event: ScheduledCalendarEvent): boolean {
  const start = eventStartDate(event);
  const end = eventEndDate(event);
  if (!start || !end) return false;
  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(23, 59, 59, 999);
  return today.getTime() >= startDay.getTime() && today.getTime() <= endDay.getTime();
}

function chipClass(event: ScheduledCalendarEvent, ongoing = false, past = false) {
  if (past || event.completed) {
    return "bg-slate-200 border-slate-300 text-slate-600";
  }
  const base = THEME_CLASSES[chipIndex(event)];
  if (ongoing) {
    return `${base} ring-2 ring-emerald-700 border-emerald-600 shadow-md brightness-105`;
  }
  if (isEventToday(event)) {
    return `${base} ring-2 ring-emerald-600 border-emerald-500 shadow-sm`;
  }
  return base;
}

function parseIsoDay(iso: string): { y: number; m: number; d: number } | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

function parseTimeToMinutes(time?: string): number | null {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function eventRange(event: ScheduledCalendarEvent): { start: Date; end: Date } | null {
  const startIso = event.startDate;
  if (startIso) {
    const s = parseIsoDay(startIso);
    if (!s) return null;
    const endIso = event.endDate || startIso;
    const e = parseIsoDay(endIso);
    if (!e) return null;
    return {
      start: new Date(s.y, s.m, s.d),
      end: new Date(e.y, e.m, e.d),
    };
  }
  const day = event.date.match(/\b(\d{1,2})\b/);
  if (!day) return null;
  const d = parseInt(day[1]!, 10);
  const dt = new Date(viewYear.value, viewMonth.value, d);
  return { start: dt, end: dt };
}

function eventStartDate(event: ScheduledCalendarEvent): Date | null {
  const range = eventRange(event);
  return range?.start ?? null;
}

function eventEndDate(event: ScheduledCalendarEvent): Date | null {
  const range = eventRange(event);
  return range?.end ?? null;
}

function isEventPast(event: ScheduledCalendarEvent): boolean {
  if (event.completed) return true;
  const end = eventEndDate(event);
  if (!end) return false;
  const endDay = new Date(end);
  endDay.setHours(23, 59, 59, 999);
  const endMinutes = parseTimeToMinutes(event.endTime);
  if (endMinutes != null) {
    endDay.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 59, 999);
  }
  return endDay.getTime() < now.getTime();
}

function isEventOngoing(event: ScheduledCalendarEvent): boolean {
  if (isEventPast(event)) return false;
  const start = eventStartDate(event);
  const end = eventEndDate(event);
  if (!start || !end) return false;
  const startDt = new Date(start);
  const endDt = new Date(end);
  const startMin = parseTimeToMinutes(event.startTime);
  const endMin = parseTimeToMinutes(event.endTime);
  if (startMin != null) startDt.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
  else startDt.setHours(0, 0, 0, 0);
  if (endMin != null) endDt.setHours(Math.floor(endMin / 60), endMin % 60, 59, 999);
  else endDt.setHours(23, 59, 59, 999);
  return now.getTime() >= startDt.getTime() && now.getTime() <= endDt.getTime();
}

function eventOnDay(event: ScheduledCalendarEvent, day: number): boolean {
  const range = eventRange(event);
  if (!range) return false;
  const cell = new Date(viewYear.value, viewMonth.value, day);
  const start = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
  const end = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate());
  return cell >= start && cell <= end;
}

function isMultiDayEvent(event: ScheduledCalendarEvent): boolean {
  const range = eventRange(event);
  if (!range) return false;
  const s = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate()).getTime();
  const e = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate()).getTime();
  return e > s;
}

function allEventsOnDay(day: number) {
  return props.events.filter((e) => eventOnDay(e, day));
}

function eventsOnDay(day: number) {
  return allEventsOnDay(day).filter((e) => !isMultiDayEvent(e));
}

const MAX_DAY_EVENTS = 2;
const overflowDay = ref<number | null>(null);

function visibleEventsOnDay(day: number) {
  return eventsOnDay(day).slice(0, MAX_DAY_EVENTS);
}

function extraEventsOnDay(day: number) {
  return Math.max(0, eventsOnDay(day).length - MAX_DAY_EVENTS);
}

function openDayOverflow(day: number) {
  overflowDay.value = day;
}

function closeDayOverflow() {
  overflowDay.value = null;
}

function overflowDayEvents() {
  if (overflowDay.value == null) return [];
  return allEventsOnDay(overflowDay.value);
}

function overflowDayLabel() {
  if (overflowDay.value == null) return "";
  return new Date(viewYear.value, viewMonth.value, overflowDay.value).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function hasEvents(day: number) {
  return allEventsOnDay(day).length > 0;
}

function isToday(day: number) {
  return (
    viewYear.value === today.getFullYear() &&
    viewMonth.value === today.getMonth() &&
    day === today.getDate()
  );
}

function onEventClick(event: ScheduledCalendarEvent) {
  if (props.selectable) emit("select", event);
}

function eventHoverText(event: ScheduledCalendarEvent) {
  const parts = [event.name];
  if (event.organization) parts.push(`Organization: ${event.organization}`);
  if (event.venue) parts.push(`Venue: ${event.venue}`);
  if (event.status) parts.push(`Status: ${event.status}`);
  return parts.join(" | ");
}

function eventIcon(event: ScheduledCalendarEvent) {
  const hay = `${event.eventType ?? ""} ${event.name}`.toLowerCase();
  if (/sport|athlet|game|tournament|intram/.test(hay)) return Dumbbell;
  if (/medical|health|clinic|first.?aid|wellness/.test(hay)) return HeartPulse;
  if (/seminar|workshop|lecture|training|book|class|symposium/.test(hay)) return BookOpen;
  if (/meet|assembly|org|club|student|social|party|fellowship/.test(hay)) return Users;
  return Calendar;
}

function formatEventDate(event: ScheduledCalendarEvent): string {
  const start = eventStartDate(event);
  if (start) {
    return start.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  return event.date;
}

function dayDiffFromToday(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function formatGroupDateLabel(date: Date): string {
  return date
    .toLocaleDateString("en-US", { month: "long", day: "numeric" })
    .toUpperCase();
}

type ListGroup = { key: string; label: string; events: ScheduledCalendarEvent[] };

const groupedEventList = computed((): ListGroup[] => {
  const sorted = [...props.events].sort((a, b) => {
    const da = eventStartDate(a)?.getTime() ?? Number.POSITIVE_INFINITY;
    const db = eventStartDate(b)?.getTime() ?? Number.POSITIVE_INFINITY;
    return da - db;
  });

  const groups: ListGroup[] = [];
  const laterByDay = new Map<string, ScheduledCalendarEvent[]>();
  const undated: ScheduledCalendarEvent[] = [];
  let futureCount = 0;
  const limit = Math.max(1, props.upcomingLimit);

  for (const ev of sorted) {
    const start = eventStartDate(ev);
    if (!start) {
      if (futureCount >= limit) continue;
      undated.push(ev);
      futureCount += 1;
      continue;
    }
    const diff = dayDiffFromToday(start);
    if (isEventPast(ev) || diff < 0) {
      continue; // compact list focuses on upcoming only
    }
    if (futureCount >= limit) continue;
    futureCount += 1;

    if (diff === 0) {
      const existing = groups.find((g) => g.key === "today");
      if (existing) existing.events.push(ev);
      else groups.push({ key: "today", label: "TODAY", events: [ev] });
      continue;
    }
    if (diff === 1) {
      const existing = groups.find((g) => g.key === "tomorrow");
      if (existing) existing.events.push(ev);
      else groups.push({ key: "tomorrow", label: "TOMORROW", events: [ev] });
      continue;
    }
    const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
    const bucket = laterByDay.get(key) ?? [];
    bucket.push(ev);
    laterByDay.set(key, bucket);
  }

  for (const [key, events] of laterByDay) {
    const start = eventStartDate(events[0]!);
    groups.push({
      key: `day-${key}`,
      label: start ? formatGroupDateLabel(start) : "UPCOMING",
      events,
    });
  }

  if (undated.length) {
    groups.push({ key: "undated", label: "UPCOMING", events: undated });
  }
  return groups;
});

function emitMonthRange() {
  const start = new Date(viewYear.value, viewMonth.value, 1);
  const end = new Date(viewYear.value, viewMonth.value + 1, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const payload = {
    year: viewYear.value,
    month: viewMonth.value,
    startDate: fmt(start),
    endDate: fmt(end),
  };
  emit("monthChange", payload);
  if (isSupabaseConfigured) {
    try {
      void useEventRequestsStore().loadCalendarRange(payload.startDate, payload.endDate);
    } catch {
      // The calendar can also be rendered outside an initialized portal store.
    }
  }
}

onMounted(() => {
  emitMonthRange();
});

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11;
    viewYear.value -= 1;
  } else {
    viewMonth.value -= 1;
  }
  emitMonthRange();
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0;
    viewYear.value += 1;
  } else {
    viewMonth.value += 1;
  }
  emitMonthRange();
}

function goToToday() {
  viewYear.value = today.getFullYear();
  viewMonth.value = today.getMonth();
  emitMonthRange();
}

const weeks = computed(() => {
  const rows: Array<{ index: number; cells: WeekCell[]; bars: WeekBar[]; laneCount: number }> = [];
  for (let i = 0; i < calendarCells.value.length; i += 7) {
    const raw = calendarCells.value.slice(i, i + 7);
    const cells: WeekCell[] = raw.map((c, idx) => ({
      key: c.key,
      day: c.day,
      col: idx,
      date: c.day === null ? null : new Date(viewYear.value, viewMonth.value, c.day),
    }));

    const bars: WeekBar[] = [];
    const laneEndCols: number[] = [];
    props.events
      .filter((e) => isMultiDayEvent(e))
      .forEach((event, idx) => {
        const range = eventRange(event);
        if (!range) return;
        const cols = cells
          .filter((cell) => {
            if (!cell.date) return false;
            const t = cell.date.getTime();
            const s = new Date(
              range.start.getFullYear(),
              range.start.getMonth(),
              range.start.getDate(),
            ).getTime();
            const en = new Date(
              range.end.getFullYear(),
              range.end.getMonth(),
              range.end.getDate(),
            ).getTime();
            return t >= s && t <= en;
          })
          .map((c) => c.col);
        if (!cols.length) return;
        const startCol = Math.min(...cols);
        const endCol = Math.max(...cols);
        let lane = laneEndCols.findIndex((end) => startCol > end);
        if (lane === -1) {
          lane = laneEndCols.length;
          laneEndCols.push(endCol);
        } else {
          laneEndCols[lane] = endCol;
        }
        bars.push({
          key: `${event.id ?? event.name}-${i}-${idx}`,
          event,
          startCol,
          endCol,
          lane,
        });
      });

    rows.push({
      index: i / 7,
      cells,
      bars,
      laneCount: laneEndCols.length,
    });
  }
  return rows;
});

const weekRowTemplate = computed(() => {
  const count = Math.max(weeks.value.length, 1);
  if (props.listLayout === "calendar-only") {
    return `repeat(${count}, minmax(4.75rem, 5.25rem))`;
  }
  return `repeat(${count}, minmax(0, 1fr))`;
});
</script>

<template>
  <div
    :class="[
      'relative font-sans dash-card border border-slate-200/90 bg-[#faf8f5]',
      listLayout === 'calendar-only'
        ? 'h-auto overflow-visible'
        : listLayout !== 'below'
          ? 'dash-card-fill !h-auto min-h-[44rem] !overflow-visible lg:!h-full lg:min-h-0 lg:!overflow-hidden'
          : '',
    ]"
  >
    <div
      class="flex shrink-0 flex-col gap-2 border-b border-slate-200/90 bg-[#faf8f5] p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-2"
    >
      <div class="min-w-0">
        <h2 class="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-800">
          <CalendarDays class="h-4 w-4 shrink-0 text-emerald-600" stroke-width="2" />
          {{ title }}
        </h2>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-700 hover:bg-white"
            aria-label="Previous month"
            @click="prevMonth"
          >
            <ChevronLeft class="h-4 w-4" />
          </button>
          <span class="min-w-[9rem] text-center text-sm font-semibold text-slate-800">{{ monthLabel }}</span>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-700 hover:bg-white"
            aria-label="Next month"
            @click="nextMonth"
          >
            <ChevronRight class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
            @click="goToToday"
          >
            Today
          </button>
        </div>
        <p class="mt-1 text-[11px] text-slate-500 sm:text-xs">
          Events are listed on each date{{ selectable ? " — click to edit" : "" }}
        </p>
      </div>
      <button
        v-if="showAddButton"
        type="button"
        class="inline-flex shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-emerald-500 hover:to-teal-600"
        title="Manually add an event"
        aria-label="Add event"
        @click="emit('add')"
      >
        <Plus :size="14" />
        Add
      </button>
    </div>

    <div
      :class="[
        listLayout === 'below'
          ? 'contents'
          : listLayout === 'calendar-only'
            ? 'grid min-h-0 grid-cols-1 items-start gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]'
            : 'flex min-h-0 flex-none flex-col lg:flex-1 lg:flex-row',
      ]"
    >
      <div
        :class="[
          'flex min-w-0 flex-col',
          listLayout === 'management'
            ? 'min-h-[32rem] flex-1 lg:min-h-0 lg:w-3/4 lg:flex-none'
            : listLayout === 'calendar-only'
              ? 'min-h-0 min-w-0 w-full'
              : 'min-h-[32rem] flex-1 lg:min-h-0',
        ]"
      >
    <div
      :class="[
        'flex min-h-0 flex-col p-2 sm:p-3',
        listLayout === 'calendar-only' ? '' : 'flex-1 overflow-hidden',
      ]"
    >
      <div class="mb-1 grid shrink-0 grid-cols-7 gap-px bg-slate-200/60">
        <div
          v-for="(d, idx) in weekdays"
          :key="idx"
          class="bg-[#faf8f5] py-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500"
        >
          {{ d }}
        </div>
      </div>
      <div
        class="grid min-h-0 gap-px bg-slate-200/60"
        :class="listLayout === 'calendar-only' ? '' : 'flex-1 overflow-hidden'"
        :style="{ gridTemplateRows: weekRowTemplate }"
      >
        <div v-for="week in weeks" :key="`week-${week.index}`" class="relative min-h-0 overflow-hidden">
          <div
            v-if="week.bars.length"
            class="pointer-events-none absolute left-0 right-0 top-0 z-20 overflow-hidden"
            :style="{ height: `${Math.min(week.laneCount, 2) * 18 + 4}px` }"
          >
            <component
              :is="selectable ? 'button' : 'div'"
              v-for="bar in week.bars.slice(0, 2)"
              :key="bar.key"
              :type="selectable ? 'button' : undefined"
              class="pointer-events-auto absolute flex items-center gap-1 rounded border px-1.5 text-left text-[10px] font-semibold text-charcoal shadow-sm"
              :class="[
                chipClass(bar.event, isEventOngoing(bar.event), isEventPast(bar.event)),
                selectable ? 'cursor-pointer hover:brightness-95' : '',
              ]"
              :style="{
                left: `calc(${(bar.startCol / 7) * 100}% + 1px)`,
                width: `calc(${((bar.endCol - bar.startCol + 1) / 7) * 100}% - 2px)`,
                top: `${bar.lane * 18 + 2}px`,
                height: '16px',
              }"
              :title="eventHoverText(bar.event)"
              @click="selectable ? onEventClick(bar.event) : undefined"
            >
              <span v-if="isEventOngoing(bar.event)" class="shrink-0 rounded bg-emerald-700 px-1 text-[8px] font-bold text-white">
                ONGOING
              </span>
              <span
                v-else-if="isEventToday(bar.event) && !isEventPast(bar.event)"
                class="shrink-0 rounded bg-emerald-600 px-1 text-[8px] font-bold text-white"
              >
                TODAY
              </span>
              <span class="truncate">{{ bar.event.name }}</span>
            </component>
          </div>

          <div
            class="grid h-full min-h-0 grid-cols-7 gap-px bg-slate-200/60"
            :style="{ paddingTop: week.bars.length ? `${Math.min(week.laneCount, 2) * 18 + 4}px` : '0px' }"
          >
            <div v-for="cell in week.cells" :key="cell.key" class="min-h-0 bg-[#faf8f5]">
              <div v-if="cell.day === null" class="h-full min-h-0 bg-[#f5f3ef]" />
              <div
                v-else
                :class="[
                  'flex h-full min-h-0 flex-col overflow-hidden border border-transparent p-1',
                  hasEvents(cell.day) ? 'bg-[#f7f5f1]' : 'bg-[#faf8f5]',
                  isToday(cell.day)
                    ? 'rounded-lg border-emerald-400/70 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-300/50'
                    : '',
                ]"
              >
                <span
                  :class="[
                    'mb-0.5 shrink-0 text-[11px] font-bold leading-none',
                    isToday(cell.day) ? 'text-emerald-800' : 'text-slate-600',
                  ]"
                >
                  {{ cell.day }}
                </span>
                <div class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                  <component
                    :is="selectable ? 'button' : 'div'"
                    v-for="ev in visibleEventsOnDay(cell.day)"
                    :key="(ev.id ?? ev.name) + cell.day"
                    :type="selectable ? 'button' : undefined"
                    :class="[
                      'w-full rounded border px-1 py-0.5 text-left leading-tight text-charcoal',
                      chipClass(ev, isEventOngoing(ev), isEventPast(ev)),
                      selectable ? 'cursor-pointer hover:brightness-95' : '',
                    ]"
                    :title="eventHoverText(ev)"
                    @click="selectable ? onEventClick(ev) : undefined"
                  >
                    <span class="flex items-center gap-0.5">
                      <component :is="eventIcon(ev)" class="h-2.5 w-2.5 shrink-0 text-slate-600" stroke-width="2" />
                      <span class="block truncate text-[10px] font-semibold">{{ ev.name }}</span>
                    </span>
                    <span
                      v-if="isEventOngoing(ev)"
                      class="mt-0.5 inline-block rounded bg-emerald-700 px-1 text-[7px] font-bold text-white"
                    >
                      ONGOING
                    </span>
                    <span
                      v-else-if="isEventToday(ev) && !isEventPast(ev)"
                      class="mt-0.5 inline-block rounded bg-emerald-600 px-1 text-[7px] font-bold text-white"
                    >
                      TODAY
                    </span>
                  </component>
                  <button
                    v-if="extraEventsOnDay(cell.day) > 0"
                    type="button"
                    class="px-1 text-left text-[9px] font-semibold text-emerald-800 hover:underline"
                    @click="openDayOverflow(cell.day)"
                  >
                    +{{ extraEventsOnDay(cell.day) }} more
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="overflowDay != null"
      class="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
      @click.self="closeDayOverflow"
    >
      <div class="max-h-[80%] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-4 shadow-xl" @click.stop>
        <div class="mb-3 flex items-start justify-between gap-2">
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-slate-500">{{ overflowDayLabel() }}</p>
            <p class="text-sm font-semibold text-slate-800">Events this day</p>
          </div>
          <button type="button" class="rounded-lg p-1 text-slate-500 hover:bg-slate-100" @click="closeDayOverflow">
            Close
          </button>
        </div>
        <ul class="space-y-2">
          <li
            v-for="ev in overflowDayEvents()"
            :key="ev.id ?? ev.name"
            :class="[
              'rounded-lg border px-2.5 py-1.5 text-sm',
              chipClass(ev, isEventOngoing(ev), isEventPast(ev)),
              selectable ? 'cursor-pointer hover:brightness-95' : '',
            ]"
            @click="selectable ? onEventClick(ev) : undefined"
          >
            <p class="truncate font-semibold">{{ ev.name }}</p>
            <p class="mt-0.5 text-xs text-slate-600">{{ formatEventDate(ev) }}</p>
          </li>
        </ul>
      </div>
    </div>

    <div class="flex flex-wrap gap-3 border-t border-slate-200/90 bg-[#faf8f5] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
      <span class="inline-flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 rounded-sm bg-emerald-200 ring-1 ring-emerald-400" />
        Upcoming
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 rounded-sm bg-emerald-300 ring-2 ring-emerald-700" />
        Today / Ongoing
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 rounded-sm bg-slate-300 ring-1 ring-slate-400" />
        Completed / Past
      </span>
    </div>
      </div>

    <aside
      v-if="groupedEventList.length"
      :class="[
        'border-t border-slate-200/90 bg-[#faf8f5] px-3 py-2',
        listLayout === 'management'
          ? 'shrink-0 lg:w-1/4 lg:border-l lg:border-t-0'
          : listLayout === 'calendar-only'
            ? 'min-w-0 w-full lg:h-full lg:max-h-[min(34rem,calc(100dvh-16rem))] lg:overflow-y-auto lg:border-l lg:border-t-0'
            : 'shrink-0',
      ]"
    >
      <p class="mb-2 text-xs font-bold uppercase tracking-wide text-slate-700">List of events</p>
      <div v-for="group in groupedEventList" :key="group.key" class="mb-3 last:mb-0">
        <p class="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{{ group.label }}</p>
        <ul class="space-y-1">
          <li
            v-for="ev in group.events"
            :key="`${group.key}-${ev.id ?? ev.name}`"
            :class="[
              'rounded-lg border px-2.5 py-1.5 text-sm',
              chipClass(ev, isEventOngoing(ev), isEventPast(ev)),
            ]"
          >
            <p
              :class="[
                'font-semibold',
                listLayout === 'calendar-only' ? 'break-words whitespace-normal' : 'truncate',
                isEventPast(ev) ? 'text-slate-600' : 'text-charcoal',
              ]"
            >
              {{ ev.name }}
            </p>
            <p class="mt-0.5 text-xs text-slate-600">{{ formatEventDate(ev) }}</p>
          </li>
        </ul>
      </div>
    </aside>
    </div>
  </div>
</template>

<style scoped>
.text-charcoal {
  color: #2d2d2d;
}
</style>
