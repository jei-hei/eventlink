/** Matches student design: gradient avatar by organization name length. */
export function getOrgColor(orgName: string) {
  const colors = [
    "bg-gradient-to-br from-blue-500 to-blue-600",
    "bg-gradient-to-br from-purple-500 to-purple-600",
    "bg-gradient-to-br from-pink-500 to-pink-600",
    "bg-gradient-to-br from-green-500 to-green-600",
    "bg-gradient-to-br from-orange-500 to-orange-600",
    "bg-gradient-to-br from-red-500 to-red-600",
  ];
  const index = orgName.length % colors.length;
  return colors[index]!;
}

export function formatPostedAgo(postedAt: string | null | undefined, fallbackDay: number) {
  if (postedAt) {
    const posted = new Date(postedAt);
    const diffMs = Date.now() - posted.getTime();
    const hours = Math.floor(diffMs / 3_600_000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  }
  return getTimeAgo(fallbackDay);
}

export function getTimeAgo(eventDay: number) {
  const today = 24;
  const daysUntil = eventDay - today;
  if (daysUntil < 0) return `${Math.abs(daysUntil)} days ago`;
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `in ${daysUntil} days`;
}
