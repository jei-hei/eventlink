import type { EoEvent } from "./types";

export const initialPendingEvents: EoEvent[] = [
  {
    id: "1",
    name: "Sports Festival",
    organization: "Supreme Student Council",
    date: "Mar20, 2026 8:00 AM",
    venue: "Gymnasium",
    status: "Pending",
    description: "Annual sports festival for all departments.",
    participants: 500,
    sdgs: "SDG 3, SDG 4",
  },
  {
    id: "2",
    name: "Seminar",
    organization: "Organization A",
    date: "Mar21, 2026 1:00 PM",
    venue: "Devenecia",
    status: "Pending",
    description: "Technology and innovation seminar.",
    participants: 150,
    sdgs: "SDG 4, SDG 9",
  },
  {
    id: "3",
    name: "Concert",
    organization: "Organization B",
    date: "Mar20, 2026 6:00 PM",
    venue: "Open Gymnasium",
    status: "Pending",
    description: "Music festival featuring local bands.",
    participants: 800,
    sdgs: "SDG 11",
  },
  {
    id: "4",
    name: "Basketball Tournament",
    organization: "Sports Club",
    date: "Mar20, 2026 8:00 AM",
    venue: "Gymnasium",
    status: "Conflict",
    description: "Inter-collegiate basketball tournament.",
    participants: 300,
    sdgs: "SDG 3",
  },
];

export const initialApprovedEvents: EoEvent[] = [
  {
    id: "5",
    name: "Welcome Assembly",
    organization: "Supreme Student Council",
    date: "Mar01, 2026 9:00 AM",
    venue: "Gymnasium",
    status: "Approved",
    description: "Freshmen welcome assembly.",
    participants: 1000,
    sdgs: "SDG 4",
  },
];
