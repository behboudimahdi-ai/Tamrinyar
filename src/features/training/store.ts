import 'server-only';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { database, localDemo } from './database';
import { authenticated, ownAthlete } from '../programs/access';
import { assignedWorkouts } from '../programs/athlete';
import { Prisma } from '@/generated/prisma/client';
import { todayKey, type Workspace } from './model';
import { seed } from './seed';

const dataDir = join(process.cwd(), '.data');
const localPath = join(dataDir, 'workspace.json');
const globalStore = globalThis as typeof globalThis & { localWrites?: Promise<unknown> };
const isMissing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';
async function readLocal() {
  try {
    return JSON.parse(await readFile(localPath, 'utf8')) as Workspace;
  } catch (error) {
    if (!isMissing(error)) throw error;
    return null;
  }
}
async function writeLocal(workspace: Workspace) {
  await mkdir(dataDir, { recursive: true });
  const temp = localPath + '.tmp';
  await writeFile(temp, JSON.stringify(workspace), 'utf8');
  await rename(temp, localPath);
}
function queueLocal<T>(work: () => Promise<T>) {
  const result = (globalStore.localWrites ?? Promise.resolve()).then(work);
  globalStore.localWrites = result.catch(() => undefined);
  return result;
}
export async function readWorkspace(athleteId?: string, workouts?: Awaited<ReturnType<typeof assignedWorkouts>>): Promise<Workspace> {
  if (!localDemo()) {
    const actor = await authenticated();
    if (athleteId) ownAthlete(actor, athleteId);
    const scope = actor.role === 'ATHLETE' ? actor.athleteId! : athleteId;
    const assigned = workouts ?? await assignedWorkouts(actor, scope);
    let workspace: Workspace;
    if (scope) {
      const rows = await database().$queryRaw<{data:Workspace}[]>`SELECT jsonb_build_object(
        'movements',data->'movements',
        'students',(SELECT coalesce(jsonb_agg(p),'[]') FROM jsonb_array_elements(data->'students') p WHERE p->>'id'=${scope}),
        'sessions',(SELECT coalesce(jsonb_agg(s),'[]') FROM jsonb_array_elements(data->'sessions') s WHERE s->>'studentId'=${scope}),
        'reviews',(SELECT coalesce(jsonb_agg(r),'[]') FROM jsonb_array_elements(data->'reviews') r WHERE
          EXISTS(SELECT 1 FROM jsonb_array_elements(data->'sessions') s WHERE s->>'studentId'=${scope} AND s->>'id'=r->>'sessionId')
          OR EXISTS(SELECT 1 FROM "ScheduledSession" s JOIN "ProgramAssignment" a ON a.id=s."assignmentId"
             WHERE s.id=r->>'sessionId' AND a."coachId"=${actor.coachId} AND a."athleteId"=${scope}))
      ) AS data FROM "Workspace" WHERE id=${actor.coachId}`;
      workspace = rows[0].data;
    } else {
      const row = await database().workspace.findUniqueOrThrow({where:{id:actor.coachId},select:{data:true}});
      workspace = row.data as unknown as Workspace;
    }
    const legacy = workspace.sessions;
    const sessions = [...legacy,...assigned.sessions];
    const ids = new Set(sessions.map(s=>s.id));
    return {...workspace, sessions, students:workspace.students.filter(s=>!scope || s.id===scope),
      reviews:workspace.reviews.filter(r=>ids.has(r.sessionId))};
  }
  const existing = await readLocal();
  if (existing) return existing;
  return queueLocal(async () => {
    const stored = await readLocal();
    if (stored) return stored;
    const fresh = seed(todayKey());
    await writeLocal(fresh);
    return fresh;
  });
}
export async function updateWorkspace(change: (workspace: Workspace) => void) {
  if (!localDemo()) {
    const actor = await authenticated();
    const db = database();
    for (let attempt = 0; attempt < 4; attempt++) {
      const saved = await db.$transaction(async tx => {
        const row = await tx.workspace.findUniqueOrThrow({where:{id:actor.coachId}});
        const workspace = row.data as unknown as Workspace;
        const known = new Set(workspace.students.map(s=>s.id));
        change(workspace);
        const written = await tx.workspace.updateMany({where:{id:actor.coachId,revision:row.revision},
          data:{data:workspace as Prisma.InputJsonValue,revision:{increment:1}}});
        if (!written.count) return false;
        const added = workspace.students.filter(s=>!known.has(s.id));
        if (added.length) await tx.athlete.createMany({data:added.map(s=>({coachId:actor.coachId,id:s.id,name:s.name}))});
        return true;
      });
      if (saved) return;
    }
    throw new Error('هم‌زمان تغییر دیگری ثبت شد. دوباره تلاش کنید.');
  }
  const fallback = await readWorkspace();
  return queueLocal(async () => {
    const workspace = await readLocal() ?? fallback;
    change(workspace);
    await writeLocal(workspace);
  });
}
export async function saveClip(id: string, content: Uint8Array<ArrayBuffer>, mime: string) {
  if (!localDemo()) {
    await authenticated();
    const db = database();
    await db.clip.create({ data: { id, content, mime } });
    return;
  }
  const dir = join(dataDir, 'clips');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, id + (mime === 'video/webm' ? '.webm' : '.mp4')), content, { flag: 'wx' });
}
export async function readClip(id: string) {
  if (!/^[a-f\d-]{36}$/.test(id)) return null;
  if (!localDemo()) { await authenticated(); return database().clip.findUnique({where:{id}}); }
  for (const extension of ['mp4', 'webm']) {
    try {
      const content = await readFile(join(dataDir, 'clips', id + '.' + extension));
      return { content, mime: 'video/' + extension };
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
  return null;
}
