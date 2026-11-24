import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { database } from '../training/database';
import { todayKey, type Session } from '../training/model';
import { coachOnly, ownAthlete, type Actor } from './access';
import { ensure, parseSession, type Definition, type SessionTemplate } from './definition';
import { dateOnly } from './recurrence';
import { dayValue, validateCatalog } from './repository';

export type AssignmentInfo = {
  id: string;
  templateId: string;
  revision: number;
  name: string;
  start: string;
  end: string;
  total: number;
  completed: number;
};
export async function assignedWorkouts(actor: Actor, athleteId?: string) {
  if (athleteId) ownAthlete(actor, athleteId);
  const owner = actor.role === 'ATHLETE' ? actor.athleteId! : athleteId;
  const assignments = await database().programAssignment.findMany({
    where: { coachId: actor.coachId, athleteId: owner },
    orderBy: { startDate: 'desc' },
    include: {
      version: { select: { definition: true } },
      sessions: { orderBy: { date: 'asc' }, include: { logs: { select: { entryId: true, done: true } } } },
    },
  });
  const sessions: Session[] = [],
    programs: AssignmentInfo[] = [];
  for (const a of assignments) {
    const def = a.version.definition as unknown as Definition;
    const slots = new Map(def.sessions.map((s) => [s.id, s]));
    programs.push({
      id: a.id,
      templateId: a.templateId,
      revision: a.revision,
      name: def.name,
      start: dayValue(a.startDate),
      end: dayValue(a.endDate),
      total: a.sessions.length,
      completed: a.sessions.filter((s) => s.completedAt).length,
    });
    for (const s of a.sessions) {
      const slot = s.override ? (s.override as unknown as SessionTemplate) : slots.get(s.slotId)!;
      const done = new Set(s.logs.filter((l) => l.done).map((l) => l.entryId));
      sessions.push({
        id: s.id,
        studentId: a.athleteId,
        title: slot.title,
        date: dayValue(s.date),
        assignmentId: a.id,
        programName: def.name,
        prescription: slot,
        revision: s.revision,
        entries: slot.entries.map((e) => ({ ...e, done: done.has(e.id) })),
      });
    }
  }
  return { sessions, programs };
}
async function lockedSession(tx: Prisma.TransactionClient, actor: Actor, sessionId: string) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT a.id FROM "ProgramAssignment" a JOIN "ScheduledSession" s ON a.id=s."assignmentId"
    WHERE s.id=${sessionId} AND a."coachId"=${actor.coachId} FOR UPDATE OF a`;
  ensure(rows.length === 1, 'جلسه در دسترس نیست.');
  const session = await tx.scheduledSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { assignment: { include: { version: true } } },
  });
  ownAthlete(actor, session.assignment.athleteId);
  const def = session.assignment.version.definition as unknown as Definition;
  const slot = session.override
    ? (session.override as unknown as SessionTemplate)
    : def.sessions.find((x) => x.id === session.slotId)!;
  return { session, slot, def };
}
export async function logCompletion(actor: Actor, sessionId: string, entryId: string, done: boolean) {
  ensure(actor.role === 'ATHLETE' && typeof done === 'boolean', 'ثبت اجرا فقط برای شاگرد مجاز است.');
  return database().$transaction(async (tx) => {
    const { session, slot } = await lockedSession(tx, actor, sessionId);
    ensure(
      slot.entries.some((e) => e.id === entryId),
      'حرکت این جلسه پیدا نشد.',
    );
    await tx.workoutLog.upsert({
      where: { sessionId_entryId: { sessionId, entryId } },
      create: { sessionId, entryId, done },
      update: { done },
    });
    const completed = await tx.workoutLog.count({
      where: { sessionId, done: true, entryId: { in: slot.entries.map((e) => e.id) } },
    });
    await tx.scheduledSession.update({
      where: { id: sessionId },
      data: { completedAt: completed === slot.entries.length ? (session.completedAt ?? new Date()) : null },
    });
    return { ok: true };
  });
}
export async function editOccurrence(
  actor: Actor,
  sessionId: string,
  expected: number,
  value: unknown,
  scope: string,
  reason: string,
  date?: string,
) {
  coachOnly(actor);
  ensure(scope === 'one' || scope === 'future', 'محدودهٔ ویرایش را انتخاب کنید.');
  ensure(typeof reason === 'string' && reason.trim() && reason.length <= 500, 'دلیل ویرایش را وارد کنید.');
  const slot = parseSession(value, true);
  return database().$transaction(async (tx) => {
    const { session, def } = await lockedSession(tx, actor, sessionId);
    const today = new Date(dateOnly(todayKey()));
    ensure(
      slot.id === session.slotId &&
        session.date >= today &&
        !session.completedAt &&
        session.revision === expected,
      'جلسه تغییر کرده یا زمان ویرایش آن گذشته است.',
    );
    await validateCatalog({ ...def, sessions: [slot] }, actor.coachId);
    let newDate: Date | undefined;
    if (date) {
      newDate = new Date(dateOnly(date));
      ensure(
        scope === 'one' &&
          newDate >= today &&
          newDate >= session.assignment.startDate &&
          newDate <= session.assignment.endDate,
        'تاریخ جلسه باید در دورهٔ فعال باشد.',
      );
    }
    const reviews = await tx.$queryRaw<{ id: string }[]>`SELECT item->>'sessionId' AS id FROM "Workspace",
      LATERAL jsonb_array_elements(data->'reviews') item WHERE "Workspace".id=${actor.coachId}`;
    const affected = await tx.scheduledSession.updateMany({
      where: {
        assignmentId: session.assignmentId,
        slotId: session.slotId,
        id: scope === 'one' ? sessionId : { notIn: reviews.map((x) => x.id) },
        date: { gte: session.date },
        completedAt: null,
        logs: { none: {} },
      },
      data: { override: slot, reason: reason.trim(), date: newDate, revision: { increment: 1 } },
    });
    ensure(
      !reviews.some((x) => x.id === session.id) && affected.count > 0,
      'جلسهٔ دارای سابقه یا ویدیو قابل بازنویسی نیست.',
    );
    return { count: affected.count };
  });
}
