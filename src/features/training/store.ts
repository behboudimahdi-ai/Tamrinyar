import 'server-only';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@/generated/prisma/client';
import { todayKey, type Workspace } from './model';
import { seed } from './seed';

const dataDir = join(process.cwd(), '.data');
const localPath = join(dataDir, 'workspace.json');
const globalStore = globalThis as typeof globalThis & { trainingDb?: PrismaClient; localWrites?: Promise<unknown> };
const workspaceId = 'demo';
const isMissing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';
function database() {
  if (!process.env.DATABASE_URL) return undefined;
  return globalStore.trainingDb ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
}
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
export async function readWorkspace(): Promise<Workspace> {
  const db = database();
  if (db) {
    const initial = seed(todayKey()) as Prisma.InputJsonValue;
    const row = await db.workspace.upsert({ where: { id: workspaceId }, create: { id: workspaceId, data: initial }, update: {} });
    return row.data as unknown as Workspace;
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
  const db = database();
  const fallback = await readWorkspace();
  if (db) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const row = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      const workspace = row.data as unknown as Workspace;
      change(workspace);
      const result = await db.workspace.updateMany({
        where: { id: workspaceId, revision: row.revision },
        data: { data: workspace as Prisma.InputJsonValue, revision: { increment: 1 } },
      });
      if (result.count) return;
    }
    throw new Error('هم‌زمان تغییر دیگری ثبت شد. دوباره تلاش کنید.');
  }
  return queueLocal(async () => {
    const workspace = await readLocal() ?? fallback;
    change(workspace);
    await writeLocal(workspace);
  });
}
export async function saveClip(id: string, content: Uint8Array<ArrayBuffer>, mime: string) {
  const db = database();
  if (db) {
    await db.clip.create({ data: { id, content, mime } });
    return;
  }
  const dir = join(dataDir, 'clips');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, id + (mime === 'video/webm' ? '.webm' : '.mp4')), content, { flag: 'wx' });
}
export async function readClip(id: string) {
  if (!/^[a-f\d-]{36}$/.test(id)) return null;
  const db = database();
  if (db) return db.clip.findUnique({ where: { id } });
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