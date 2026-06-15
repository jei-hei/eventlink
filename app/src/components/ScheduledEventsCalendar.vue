<script setup lang="ts">
import { computed, ref } from "vue";
import { Plus, CalendarDays, ChevronLeft, ChevronRight } from "lucide-vue-next";

export interface ScheduledCalendarEvent {
  id?: string;
  date: string;
  startDate?: string;
  endDate?: string;
  name: string;
  venue?: string;
  organization?: string;
}

const props = withDefaults(
  defineProps<{
    events: ScheduledCalendarEvent[];
    showAddButton?: boolean;
    title?: string;
    /** When true, clicking an event chip emits `select` (e.g. EO edit). */
    selectable?: boolean;
  }>(),
  {
    showAddButton: false,
    title: "Scheduled events",
    selectable: false,
  },
);

const emit = defineEmits<{ add: []; select: [event: ScheduledCalendarEvent] }>();

const today = new Date();
const viewYear = ref(today.getFullYear());
const viewMonth = ref(today.getMonth());

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

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

function parseIsoDay(iso: string): { y: number; m: number; d: number } | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
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
  return parts.join(" | ");
}

function barClass() {
  return props.selectable
    ? "cursor-pointer bg-emerald-500 hover:bg-emerald-600"
    : "bg-emerald-500/95";
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

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11;
    viewYear.value -= 1;
  } else {
    viewMonth.value -= 1;
  }
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0;
    viewYear.value += 1;
  } else {
    viewMonth.value += 1;
  }
}

function goToToday() {
  viewYear.value = today.getFullYear();
  viewMonth.value = today.getMonth();
}
</script>

<template>
  <div class="dash-card flex min-h-[min(320px,50vh)] flex-1 flex-col border border-slate-200/90 lg:min-h-0">
    <div
      class="flex shrink-0 flex-col gap-2 border-b border-slate-200/90 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-2"
    >
      <div class="min-w-0">
        <h2 class="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-800">
          <CalendarDays class="h-4 w-4 shrink-0 text-emerald-600" stroke-width="2" />
          {{ title }}
        </h2>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            aria-label="Previous month"
            @click="prevMonth"
          >
            <ChevronLeft class="h-4 w-4" />
          </button>
          <span class="min-w-[9rem] text-center text-sm font-semibold text-slate-800">{{ monthLabel }}</span>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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

    <div class="min-h-0 flex-1 overflow-auto p-2 sm:p-3">
      <div class="mb-1 grid grid-cols-7 gap-1">
        <div
          v-for="(d, idx) in weekdays"
          :key="idx"
          class="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500"
        >
          {{ d }}
        </div>
      </div>
      <div class="space-y-1">
        <div v-for="week in weeks" :key="`week-${week.index}`" class="relative">
          <div
            v-if="week.bars.length"
            class="pointer-events-none absolute left-0 right-0 top-0 z-20"
            :style="{ height: `${week.laneCount * 18 + 4}px` }"
          >
            <component
              :is="selectable ? 'button' : 'div'"
              v-for="bar in week.bars"
              :key="bar.key"
              :type="selectable ? 'button' : undefined"
              class="pointer-events-auto absolute flex items-center rounded px-1.5 text-left text-[10px] font-semibold text-white shadow-sm"
              :class="barClass()"
              :style="{
                left: `calc(${(bar.startCol / 7) * 100}% + 2px)`,
                width: `calc(${((bar.endCol - bar.startCol + 1) / 7) * 100}% - 4px)`,
                top: `${bar.lane * 18 + 2}px`,
                height: '16px',
              }"
              :title="eventHoverText(bar.event)"
              @click="selectable ? onEventClick(bar.event) : undefined"
            >
              <span class="truncate">{{ bar.event.name }}</span>
            </component>
          </div>

          <div class="grid grid-cols-7 gap-1" :style="{ paddingTop: week.bars.length ? `${week.laneCount * 18 + 4}px` : '0px' }">
            <div v-for="cell in week.cells" :key="cell.key" class="min-h-[5.5rem]">
              <div v-if="cell.day === null" class="h-full min-h-[5.5rem]" />
              <div
                v-else
                :class="[
                  'flex h-full min-h-[5.5rem] flex-col rounded-lg border p-1',
                  hasEvents(cell.day)
                    ? 'border-emerald-300 bg-emerald-50/40'
                    : 'border-slate-200 bg-slate-50/80',
                  isToday(cell.day) ? 'ring-2 ring-emerald-500 ring-offset-1' : '',
                ]"
              >
                <span
                  :class="[
                    'mb-0.5 shrink-0 text-[11px] font-bold leading-none',
                    isToday(cell.day) ? 'text-emerald-700' : 'text-slate-600',
                  ]"
                >
                  {{ cell.day }}
                </span>
                <div class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                  <component
                    :is="selectable ? 'button' : 'div'"
                    v-for="ev in eventsOnDay(cell.day).slice(0, 3)"
                    :key="(ev.id ?? ev.name) + cell.day"
                    :type="selectable ? 'button' : undefined"
                    :class="[
                      'w-full rounded px-1 py-0.5 text-left leading-tight text-emerald-950',
                      selectable
                        ? 'cursor-pointer bg-emerald-200 hover:bg-emerald-300'
                        : 'bg-emerald-200/90',
                    ]"
                    :title="eventHoverText(ev)"
                    @click="selectable ? onEventClick(ev) : undefined"
                  >
                    <span class="block truncate text-[10px] font-semibold">{{ ev.name }}</span>
                    <span
                      v-if="ev.organization"
                      class="block truncate text-[8px] font-medium text-emerald-800/90"
                    >
                      {{ ev.organization }}
                    </span>
                  </component>
                  <span
                    v-if="eventsOnDay(cell.day).length > 3"
                    class="px-1 text-[9px] font-medium text-slate-500"
                  >
                    +{{ eventsOnDay(cell.day).length - 3 }} more
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
