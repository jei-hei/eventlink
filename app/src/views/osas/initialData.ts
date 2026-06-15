import type { OsasEvent } from "./types";

export const initialPendingEvents: OsasEvent[] = [
  {
    id: "1",
    name: "Sports Festival",
    organization: "Supreme Student Council",
    date: "Mar20",
    venue: "Gymnasium",
    status: "Pending",
    description: "Annual sports festival for all departments.",
    eventType: "Student Event",
    purpose:
      "To promote physical fitness and camaraderie among students across all departments through friendly sports competitions.",
    startTime: "8:00 AM",
    endTime: "5:00 PM",
    itemsEquipment:
      "Sound system, tents, chairs, tables, sports equipment (basketballs, volleyballs, etc.)",
    remarks: "Please ensure the venue is available for setup one day before the event.",
    createdBy: "EO",
    assignedTo: "SSC",
  },
  {
    id: "2",
    name: "Technology and Innovation Seminar",
    organization: "Organization A",
    date: "Mar21",
    venue: "Devenecia",
    status: "Pending",
    description:
      "A comprehensive seminar on emerging technologies and innovation strategies for students and faculty.",
    eventType: "Student Event",
    requesterName: "Maria Santos",
    requesterRole: "President",
    purpose:
      "To educate students about the latest trends in technology and innovation, preparing them for future careers in the tech industry.",
    startTime: "9:00 AM",
    endTime: "4:00 PM",
    itemsEquipment: "Projector, microphone system, laptop, whiteboard, markers",
    letterContent:
      "Dear Executive Officer,\n\nWe, Organization A, humbly request permission to conduct a Technology and Innovation Seminar on March 21, 2026 at Devenecia Hall.\n\nThis seminar aims to expose our students to cutting-edge technologies and innovative practices in the industry. We have invited guest speakers from leading tech companies who will share their expertise and experiences.\n\nWe kindly request your approval for this event and the use of the mentioned venue and equipment.\n\nRespectfully yours,\nMaria Santos\nPresident, Organization A",
    remarks: "Guest speakers will arrive at 8:30 AM. Please ensure the venue is ready by then.",
    createdBy: "Organization",
  },
  {
    id: "3",
    name: "Music Festival 2026",
    organization: "Organization B",
    date: "Mar20",
    venue: "Open Gymnasium",
    status: "Pending",
    description: "Music festival featuring local bands and student performers.",
    eventType: "Student Event",
    requesterName: "Pedro Reyes",
    requesterRole: "Event Coordinator",
    purpose: "To showcase local musical talent and provide entertainment for the student body.",
    startTime: "3:00 PM",
    endTime: "9:00 PM",
    itemsEquipment:
      "Stage setup, professional sound system, lighting equipment, generator, security barriers",
    letterContent:
      "Dear Executive Officer,\n\nOrganization B is writing to request approval for our annual Music Festival 2026, scheduled for March 20, 2026 at the Open Gymnasium.\n\nThis event has become a beloved tradition in our institution, bringing together students through music and celebration. We will feature five local bands and several student performers.\n\nWe respectfully request permission to use the Open Gymnasium and the necessary equipment listed above.\n\nThank you for your consideration.\n\nSincerely,\nPedro Reyes\nEvent Coordinator, Organization B",
    remarks: "Event may run slightly past 9:00 PM for cleanup. Security personnel needed.",
    createdBy: "Organization",
  },
  {
    id: "4",
    name: "Basketball Tournament",
    organization: "Sports Club",
    date: "Mar20",
    venue: "Gymnasium",
    status: "Conflict",
    description: "Inter-collegiate basketball tournament.",
    eventType: "Student Event",
    requesterName: "Carlos Mendoza",
    requesterRole: "Sports Director",
    purpose: "To foster sportsmanship and healthy competition among different colleges through basketball.",
    startTime: "8:00 AM",
    endTime: "6:00 PM",
    itemsEquipment: "Basketball court, basketballs, scoreboard, referee equipment, first aid kit",
    letterContent:
      "Dear Executive Officer,\n\nThe Sports Club requests permission to hold our Inter-Collegiate Basketball Tournament on March 20, 2026 at the Gymnasium.\n\nThis tournament will involve teams from five different colleges, promoting athletic excellence and school spirit.\n\nWe kindly ask for your approval.\n\nRespectfully,\nCarlos Mendoza\nSports Director, Sports Club",
    remarks: "Venue conflict detected with Sports Festival. Please resolve scheduling.",
    createdBy: "Organization",
  },
];

export const initialApprovedEvents: OsasEvent[] = [
  {
    id: "5",
    name: "Welcome Assembly",
    organization: "Supreme Student Council",
    date: "Mar01",
    venue: "Gymnasium",
    status: "Approved",
    description:
      "Freshmen welcome assembly introducing new students to campus life and academic expectations.",
    eventType: "Student Event",
    purpose: "To welcome incoming freshmen and introduce them to the university culture and resources.",
    startTime: "10:00 AM",
    endTime: "12:00 PM",
    itemsEquipment: "Projector, sound system, chairs for 500 students",
    remarks: "All department heads are expected to attend.",
    createdBy: "EO",
    assignedTo: "SSC",
  },
];
