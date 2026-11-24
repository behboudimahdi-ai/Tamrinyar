export type ProgramKind = 'weekly' | 'weeks' | 'months' | 'custom';
export type DurationUnit = 'week' | 'month' | 'day';
export type Prescription = {
  id: string;
  movementId: string;
  sets: number;
  reps: number;
  weight?: number;
  seconds?: number;
  rest?: number;
  rpe?: number;
  rir?: number;
  tempo?: string;
  notes?: string;
};
export type SessionTemplate = {
  id: string;
  title: string;
  offset: number;
  weekday: number;
  groups: string;
  notes: string;
  warmup: string;
  cooldown: string;
  minutes?: number;
  entries: Prescription[];
};
export type Definition = {
  name: string;
  goal: string;
  level: string;
  description: string;
  durationValue: number;
  durationUnit: DurationUnit;
  kind: ProgramKind;
  cycleLength: number;
  sessions: SessionTemplate[];
};
export const kindLabels: Record<ProgramKind, string> = {
  weekly: 'هفتگی',
  weeks: 'چرخهٔ چند‌هفته‌ای',
  months: 'چرخهٔ ماه تقویمی',
  custom: 'اختصاصی بدون تکرار',
};
export const unitLabels = { week: 'هفته', month: 'ماه', day: 'روز' };
export const statusLabels = { DRAFT: 'پیش‌نویس', READY: 'آماده', ARCHIVED: 'آرشیوشده' };
export class ProgramError extends Error {}
export function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ProgramError(message);
}
function record(value: unknown): Record<string, unknown> {
  ensure(value && typeof value === 'object' && !Array.isArray(value), 'اطلاعات برنامه معتبر نیست.');
  return value as Record<string, unknown>;
}
function string(value: unknown, max: number, required = false): string {
  ensure(
    typeof value === 'string' && value.length <= max && (!required || value.trim()),
    'متن فیلدهای برنامه را بررسی کنید.',
  );
  return value.trim();
}
function number(value: unknown, min: number, max: number, integer = true): number {
  ensure(
    typeof value === 'number' &&
      Number.isFinite(value) &&
      (!integer || Number.isInteger(value)) &&
      value >= min &&
      value <= max,
    'مقدار عددی خارج از محدوده است.',
  );
  return value;
}
function id(value: unknown) {
  const key = string(value, 100, true);
  ensure(/^[\w-]+$/.test(key), 'شناسه نامعتبر است.');
  return key;
}
function unique(keys: string[]) {
  ensure(new Set(keys).size === keys.length, 'شناسهٔ تکراری در برنامه وجود دارد.');
}
export function parseSession(input: unknown, ready: boolean): SessionTemplate {
  const s = record(input);
  ensure(
    Array.isArray(s.entries) && s.entries.length <= 60 && (!ready || s.entries.length),
    'برای هر جلسه حداقل یک حرکت انتخاب کنید.',
  );
  const entries = s.entries.map((raw): Prescription => {
    const e = record(raw);
    const result: Prescription = {
      id: id(e.id),
      movementId: string(e.movementId, 100, ready),
      sets: number(e.sets, 1, 100),
      reps: number(e.reps, 1, 1000),
    };
    for (const [key, max] of [
      ['weight', 2000],
      ['seconds', 86400],
      ['rest', 86400],
      ['rpe', 10],
      ['rir', 10],
    ] as const) {
      if (e[key] !== undefined) result[key] = number(e[key], 0, max, false);
    }
    if (e.tempo !== undefined) result.tempo = string(e.tempo, 40);
    if (e.notes !== undefined) result.notes = string(e.notes, 2000);
    return result;
  });
  unique(entries.map((e) => e.id));
  return {
    id: id(s.id),
    title: string(s.title, 120, ready),
    offset: number(s.offset, 0, 3660),
    weekday: number(s.weekday, 0, 6),
    groups: string(s.groups, 300),
    notes: string(s.notes, 2000),
    warmup: string(s.warmup, 2000),
    cooldown: string(s.cooldown, 2000),
    ...(s.minutes !== undefined ? { minutes: number(s.minutes, 1, 1440) } : {}),
    entries,
  };
}
export function parseDefinition(input: unknown, ready = true): Definition {
  const p = record(input);
  ensure(typeof p.kind === 'string' && Object.hasOwn(kindLabels, p.kind), 'نوع برنامه را انتخاب کنید.');
  ensure(
    typeof p.durationUnit === 'string' && Object.hasOwn(unitLabels, p.durationUnit),
    'واحد مدت برنامه را انتخاب کنید.',
  );
  const kind = p.kind as ProgramKind,
    unit = p.durationUnit as DurationUnit;
  const durationValue = number(p.durationValue, 1, { week: 520, month: 120, day: 3660 }[unit]);
  const cycleLength = number(p.cycleLength, 1, 120);
  ensure(
    Array.isArray(p.sessions) && p.sessions.length <= 366 && (!ready || p.sessions.length),
    'ساختار جلسات را تکمیل کنید.',
  );
  const sessions = p.sessions.map((s) => parseSession(s, ready));
  unique(sessions.map((s) => s.id));
  if (ready && kind === 'weekly') {
    ensure(
      new Set(sessions.map((s) => s.weekday)).size === sessions.length,
      'برای هر جلسهٔ هفتگی یک روز متفاوت انتخاب کنید.',
    );
  }
  if (ready && kind === 'weeks')
    ensure(
      sessions.every((s) => s.offset < cycleLength * 7),
      'روز جلسه خارج از چرخه است.',
    );
  if (ready && kind === 'months')
    ensure(
      sessions.every((s) => s.offset < cycleLength * 31),
      'روز جلسه خارج از چرخهٔ ماهانه است.',
    );
  return {
    name: string(p.name, 120, true),
    goal: string(p.goal, 160, ready),
    level: string(p.level, 80, ready),
    description: string(p.description, 3000),
    durationValue,
    durationUnit: unit,
    kind,
    cycleLength,
    sessions,
  };
}
export function newExercise(movementId = ''): Prescription {
  return { id: crypto.randomUUID(), movementId, sets: 3, reps: 10 };
}
export function newSession(position: number, movementId = ''): SessionTemplate {
  return {
    id: crypto.randomUUID(),
    title: 'جلسهٔ ' + (position + 1).toLocaleString('fa-IR'),
    offset: position,
    weekday: position % 7,
    groups: '',
    notes: '',
    warmup: '',
    cooldown: '',
    entries: [newExercise(movementId)],
  };
}
export function freshProgram(): Definition {
  return {
    name: '',
    description: '',
    goal: '',
    level: '',
    durationValue: 12,
    durationUnit: 'week',
    kind: 'weekly',
    cycleLength: 1,
    sessions: [newSession(0)],
  };
}
