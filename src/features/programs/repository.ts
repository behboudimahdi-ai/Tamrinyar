import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Prisma, ProgramStatus } from '@/generated/prisma/client';
import { database } from '../training/database';
import type { Movement } from '../training/model';
import { coachOnly, type Actor } from './access';
import { ensure, parseDefinition, type Definition } from './definition';
import { dateOnly, schedule } from './recurrence';

export const dayValue = (value: Date) => value.toISOString().slice(0, 10);
const requiredItem = 'برنامه پیدا نشد یا دسترسی به آن مجاز نیست.';
export async function movementsFor(coachId: string): Promise<Movement[]> {
  const rows = await database().$queryRaw<
    { movements: Movement[] }[]
  >`SELECT data->'movements' AS movements FROM "Workspace" WHERE id = ${coachId}`;
  return rows[0]?.movements ?? [];
}
export async function choices(actor: Actor, type: string) {
  coachOnly(actor);
  if (type === 'movements') return movementsFor(actor.coachId);
  ensure(type === 'athletes', 'انتخاب نامعتبر است.');
  return database().athlete.findMany({
    where: { coachId: actor.coachId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}
export async function programList(actor: Actor, filters: URLSearchParams) {
  coachOnly(actor);
  const q = filters.get('q')?.trim().slice(0, 120);
  const status = filters.get('status');
  const page = Math.max(1, Math.min(100000, Math.floor(Number(filters.get('page')) || 1)));
  const where: Prisma.ProgramTemplateWhereInput = { coachId: actor.coachId };
  if (status && ['READY', 'DRAFT', 'ARCHIVED'].includes(status)) where.status = status as ProgramStatus;
  if (q) where.OR = ['name', 'goal', 'level'].map((key) => ({ [key]: { contains: q, mode: 'insensitive' } }));
  if (filters.get('kind')) where.kind = filters.get('kind')!;
  const db = database();
  const [total, items] = await db.$transaction([
    db.programTemplate.count({ where }),
    db.programTemplate.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * 12,
      take: 12,
      select: {
        id: true,
        name: true,
        goal: true,
        level: true,
        kind: true,
        durationUnit: true,
        durationValue: true,
        status: true,
        sessionCount: true,
        updatedAt: true,
        revision: true,
      },
    }),
  ]);
  return { page, total, items: items.map((item) => ({ ...item, updatedAt: item.updatedAt.toISOString() })) };
}
export async function details(actor: Actor, id: string) {
  coachOnly(actor);
  const template = await database().programTemplate.findFirst({
    where: { id, coachId: actor.coachId },
    select: {
      id: true,
      revision: true,
      status: true,
      versions: { orderBy: { revision: 'desc' }, take: 1, select: { definition: true } },
    },
  });
  ensure(template?.versions.length, requiredItem);
  return {
    id: template.id,
    revision: template.revision,
    status: template.status,
    definition: parseDefinition(template.versions[0].definition, false),
  };
}
export async function validateCatalog(def: Definition, coachId: string) {
  const ids = new Set((await movementsFor(coachId)).map((m) => m.id));
  ensure(
    def.sessions.every((s) => s.entries.every((e) => !e.movementId || ids.has(e.movementId))),
    'حرکت انتخاب‌شده در بانک حرکات شما موجود نیست.',
  );
}
export async function saveProgram(
  actor: Actor,
  value: unknown,
  status: 'DRAFT' | 'READY',
  id?: string,
  expected?: number,
) {
  coachOnly(actor);
  ensure(status === 'DRAFT' || status === 'READY', 'وضعیت ذخیره معتبر نیست.');
  const def = parseDefinition(value, status === 'READY');
  await validateCatalog(def, actor.coachId);
  if (status === 'READY' && def.kind === 'custom' && def.durationUnit !== 'month') {
    schedule(def, '2024-01-01');
  }
  const summary = {
    name: def.name,
    goal: def.goal,
    level: def.level,
    kind: def.kind,
    durationUnit: def.durationUnit,
    durationValue: def.durationValue,
    sessionCount: def.sessions.length,
    status,
  };
  const db = database();
  return db.$transaction(async (tx) => {
    const templateId = id || randomUUID(),
      revision = id ? Number(expected) + 1 : 1;
    if (id) {
      ensure(Number.isSafeInteger(expected) && Number(expected) > 0, 'نسخهٔ برنامه نامعتبر است.');
      const written = await tx.programTemplate.updateMany({
        where: { id, coachId: actor.coachId, revision: expected, status: { not: 'ARCHIVED' } },
        data: { ...summary, revision },
      });
      ensure(written.count === 1, 'برنامه تغییر کرده یا آرشیو شده است. نسخهٔ تازه را باز کنید.');
    } else
      await tx.programTemplate.create({
        data: { id: templateId, coachId: actor.coachId, ...summary, revision },
      });
    await tx.programVersion.create({ data: { templateId, revision, definition: def } });
    return { id: templateId, revision };
  });
}
export async function archiveProgram(actor: Actor, id: string, revision: number) {
  coachOnly(actor);
  const updated = await database().programTemplate.updateMany({
    where: { coachId: actor.coachId, id, revision },
    data: { status: 'ARCHIVED' },
  });
  ensure(updated.count === 1, requiredItem);
  return { id };
}
export async function duplicateProgram(actor: Actor, id: string) {
  const current = await details(actor, id);
  return saveProgram(
    actor,
    { ...current.definition, name: ('رونوشت ' + current.definition.name).slice(0, 120) },
    'DRAFT',
  );
}
export type Recipient = { athleteId: string; start: string };
export async function assignProgram(
  actor: Actor,
  id: string,
  revision: number,
  requestId: string,
  recipients: Recipient[],
) {
  coachOnly(actor);
  ensure(
    typeof requestId === 'string' && /^[a-zA-Z0-9-]{12,100}$/.test(requestId),
    'شناسهٔ درخواست معتبر نیست.',
  );
  ensure(
    Number.isSafeInteger(revision) &&
      revision > 0 &&
      Array.isArray(recipients) &&
      recipients.length > 0 &&
      recipients.length <= 250,
    'شاگرد و نسخهٔ برنامه را انتخاب کنید.',
  );
  for (const item of recipients) {
    ensure(
      item &&
        typeof item.athleteId === 'string' &&
        item.athleteId.length <= 120 &&
        typeof item.start === 'string',
      'مشخصات تخصیص نامعتبر است.',
    );
    dateOnly(item.start);
  }
  const selected = new Map(recipients.map((r) => [r.athleteId, r.start]));
  ensure(selected.size === recipients.length, 'هر شاگرد را فقط یک‌بار انتخاب کنید.');
  const db = database();
  return db.$transaction(
    async (tx) => {
      // Serialize retries of one confirmation, including simultaneous requests from other instances.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.coachId + ':' + requestId},0))`;
      const existing = await tx.programAssignment.findMany({ where: { coachId: actor.coachId, requestId } });
      if (existing.length) {
        ensure(
          existing.length === selected.size &&
            existing.every(
              (x) =>
                x.templateId === id &&
                x.revision === revision &&
                selected.get(x.athleteId) === dayValue(x.startDate),
            ),
          'این شناسه برای تخصیص دیگری استفاده شده است.',
        );
        return { ids: existing.map((x) => x.id) };
      }
      await tx.$executeRaw`SELECT id FROM "ProgramTemplate" WHERE id=${id} AND "coachId"=${actor.coachId} FOR SHARE`;
      const template = await tx.programTemplate.findFirst({
        where: { id, coachId: actor.coachId, status: 'READY', revision },
        include: { versions: { where: { revision }, select: { definition: true } } },
      });
      ensure(template?.versions.length, 'قالب آماده نیست یا نسخهٔ آن تغییر کرده است.');
      const roster = await tx.athlete.count({
        where: { coachId: actor.coachId, id: { in: [...selected.keys()] } },
      });
      ensure(roster === selected.size, 'دسترسی به یکی از شاگردان مجاز نیست.');
      const def = parseDefinition(template.versions[0].definition);
      const ids: string[] = [];
      for (const { athleteId, start } of recipients) {
        const plan = schedule(def, start);
        const assignment = await tx.programAssignment.create({
          data: {
            coachId: actor.coachId,
            athleteId,
            templateId: id,
            revision,
            requestId,
            startDate: new Date(dateOnly(start)),
            endDate: new Date(dateOnly(plan.end)),
          },
        });
        ids.push(assignment.id);
        const rows = plan.occurrences.map((o) => ({
          assignmentId: assignment.id,
          slotId: o.slotId,
          cycleIndex: o.cycleIndex,
          date: new Date(dateOnly(o.date)),
        }));
        for (let index = 0; index < rows.length; index += 1000)
          await tx.scheduledSession.createMany({ data: rows.slice(index, index + 1000) });
      }
      return { ids };
    },
    { timeout: 60000, maxWait: 10000 },
  );
}
