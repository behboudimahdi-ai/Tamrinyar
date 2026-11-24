import { ensure, type Definition } from './definition.ts';

const dayMs = 86400000;
const persian = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'UTC',
});
export function dateOnly(key: string) {
  const stamp = Date.parse(key + 'T00:00:00Z');
  ensure(
    /^\d{4}-\d{2}-\d{2}$/.test(key) &&
      Number.isFinite(stamp) &&
      new Date(stamp).toISOString().slice(0, 10) === key,
    'تاریخ معتبر وارد کنید.',
  );
  return stamp;
}
function iso(stamp: number) {
  const key = new Date(stamp).toISOString().slice(0, 10);
  ensure(/^\d{4}-/.test(key), 'تاریخ پایان برنامه از محدوده خارج است.');
  return key;
}
function parts(stamp: number) {
  const fields = Object.fromEntries(persian.formatToParts(stamp).map((p) => [p.type, p.value]));
  return { monthIndex: Number(fields.year) * 12 + Number(fields.month) - 1, day: Number(fields.day) };
}
function monthStart(stamp: number) {
  return stamp - (parts(stamp).day - 1) * dayMs;
}
function shiftMonths(anchor: number, months: number) {
  const original = parts(anchor);
  const target = original.monthIndex + months;
  let middle = monthStart(anchor) + (Math.floor(months * 30.436875) + 14) * dayMs;
  while (parts(middle).monthIndex < target) middle += 28 * dayMs;
  while (parts(middle).monthIndex > target) middle -= 28 * dayMs;
  const first = monthStart(middle);
  const next = monthStart(first + 32 * dayMs);
  return Math.min(first + (original.day - 1) * dayMs, next - dayMs);
}
export type Occurrence = { slotId: string; cycleIndex: number; date: string };
export function schedule(program: Definition, start: string) {
  const anchor = dateOnly(start);
  const end =
    program.durationUnit === 'month'
      ? shiftMonths(anchor, program.durationValue)
      : anchor + dayMs * program.durationValue * (program.durationUnit === 'week' ? 7 : 1);
  const occurrences: Occurrence[] = [];
  const firstDay = (new Date(anchor).getUTCDay() + 1) % 7;
  let cycleIndex = 0,
    completeCycles = 0,
    base = anchor;
  while (base < end) {
    const next =
      program.kind === 'months'
        ? shiftMonths(anchor, (cycleIndex + 1) * program.cycleLength)
        : program.kind === 'custom'
          ? end
          : base + 7 * dayMs * (program.kind === 'weeks' ? program.cycleLength : 1);
    for (const session of program.sessions) {
      const offset = program.kind === 'weekly' ? (session.weekday - firstDay + 7) % 7 : session.offset;
      const date = base + offset * dayMs;
      if (program.kind === 'custom')
        ensure(date < end, 'روز یکی از جلسه‌های اختصاصی خارج از مدت برنامه است.');
      if (date < next && date < end) occurrences.push({ slotId: session.id, cycleIndex, date: iso(date) });
    }
    if (next <= end) completeCycles++;
    cycleIndex++;
    base = next;
  }
  occurrences.sort((a, b) => a.date.localeCompare(b.date));
  ensure(occurrences.length, 'در بازهٔ انتخاب‌شده جلسه‌ای قرار نمی‌گیرد.');
  return { start, end: iso(end - dayMs), cycles: cycleIndex, completeCycles, occurrences };
}
