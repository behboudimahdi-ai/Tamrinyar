import 'server-only';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { database } from '../training/database';
import { ProgramError } from './definition';
export type Actor = { role: 'COACH' | 'ATHLETE'; coachId: string; athleteId: string | null };
export class AccessError extends ProgramError {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const derive = promisify(scrypt);
const cookieName = 'ty_session';
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
export const currentActor = cache(async function currentActor(): Promise<Actor | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !process.env.DATABASE_URL) return null;
  const row = await database().loginSession.findUnique({
    where: { digest: digest(token) },
    select: { expiresAt: true, account: { select: { role: true, coachId: true, athleteId: true } } },
  });
  return row && row.expiresAt > new Date() ? row.account : null;
});
export async function authenticated() {
  const actor = await currentActor();
  if (!actor) throw new AccessError(401, 'ابتدا وارد حساب خود شوید.');
  return actor;
}
export function coachOnly(actor: Actor) {
  if (actor.role !== 'COACH') throw new AccessError(403, 'این عملیات مخصوص مربی است.');
}
export function ownAthlete(actor: Actor, athleteId: string) {
  if (actor.role === 'ATHLETE' && actor.athleteId !== athleteId)
    throw new AccessError(403, 'دسترسی به این پرونده مجاز نیست.');
}
export async function login(loginName: string, password: string, secure: boolean) {
  if (!process.env.DATABASE_URL) throw new ProgramError('اتصال به پایگاه داده تنظیم نشده است.');
  const account = await database().account.findUnique({ where: { login: loginName.trim().toLowerCase() } });
  const [salt, hash] = (account?.passwordHash ?? 'unavailable:').split(':');
  const candidate = (await derive(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  if (!account || expected.length !== candidate.length || !timingSafeEqual(candidate, expected)) {
    throw new AccessError(401, 'نام کاربری یا گذرواژه درست نیست.');
  }
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 86400000);
  await database().loginSession.create({
    data: { digest: digest(token), accountId: account.id, expiresAt: expires },
  });
  (await cookies()).set(cookieName, token, { httpOnly: true, sameSite: 'lax', path: '/', secure, expires });
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token && process.env.DATABASE_URL)
    await database().loginSession.deleteMany({ where: { digest: digest(token) } });
  jar.delete(cookieName);
}
