// Calendar-day helpers for planning a trip, in the browser's time zone. Ported from
// brokan.xyz/buffalo (dateHelper.ts).

/** Midnight at the start of `date`'s day. */
export const toDateOnly = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const isSameDate = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** A short day label, such as "Sat 11/22" in en-US. */
export const formatDayLabel = (date: Date): string =>
  date.toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" });

/** `yyyy-mm-dd`, the value format of a date input. */
export const toDateInputValue = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/** Parses `yyyy-mm-dd` as a local date, or returns null. */
export const fromDateInputValue = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

/** Today if it's Saturday or Sunday, else the coming Saturday. */
export const getUpcomingWeekendDate = (now = new Date()): Date => {
  const today = toDateOnly(now);
  const dayOfWeek = today.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6 ? today : addDays(today, 6 - dayOfWeek);
};

export interface DayPick {
  label: string;
  date: Date;
}

/**
 * Today, Tomorrow, and the coming Saturday and Sunday, with a day that's already listed left out
 * (on a Saturday, "Today" is that Saturday). Most floaters plan for the weekend.
 */
export const getQuickPickDates = (now = new Date()): DayPick[] => {
  const today = toDateOnly(now);
  const saturday = addDays(today, (6 - today.getDay() + 7) % 7);
  const candidates: DayPick[] = [
    { label: "Today", date: today },
    { label: "Tomorrow", date: addDays(today, 1) },
    { label: formatDayLabel(saturday), date: saturday },
    { label: formatDayLabel(addDays(saturday, 1)), date: addDays(saturday, 1) },
  ];
  const seen = new Set<string>();
  return candidates.filter(({ date }) => {
    const key = toDateInputValue(date);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export type DateRelation = "past" | "today" | "future";

export const getDateRelation = (date: Date, now = new Date()): DateRelation => {
  const today = toDateOnly(now).getTime();
  const day = toDateOnly(date).getTime();
  if (day === today) return "today";
  return day > today ? "future" : "past";
};
