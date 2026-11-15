export const weekdays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
export const fa = (value: number) => value.toLocaleString('fa-IR');
export const dateLabel = (date: string) => new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long', timeZone: 'Asia/Tehran' }).format(new Date(date + 'T12:00:00Z'));
export const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
export function offsetDate(date: string, offset: number) {
  const result = new Date(date + 'T12:00:00Z');
  result.setUTCDate(result.getUTCDate() + offset);
  return result.toISOString().slice(0, 10);
}
export function weekStart(date: string) {
  return offsetDate(date, -((new Date(date + 'T12:00:00Z').getUTCDay() + 1) % 7));
}
export type Student = { id: string; name: string; age: number; weight: number; level: string; goal: string; injury: string; color: string };
export type Movement = { id: string; name: string; group: string; cue: string; video?: string };
export type Entry = { id: string; movementId: string; sets: number; reps: number; done: boolean };
export type Session = { id: string; studentId: string; title: string; date: string; entries: Entry[] };
export type Review = { id: string; sessionId: string; entryId: string; clipId?: string; date: string; feedback: string };
export type Workspace = { students: Student[]; movements: Movement[]; sessions: Session[]; reviews: Review[] };
export const levelOptions = ['مبتدی', 'متوسط', 'پیشرفته'];
export const goalOptions = ['عضله‌سازی', 'افزایش قدرت', 'کاهش وزن', 'آمادگی عمومی'];
export const palette = ['violet', 'sky', 'peach', 'mint', 'rose'];
export function counts(sessions: Session[]) {
  const total = sessions.reduce((sum, session) => sum + session.entries.length, 0);
  const done = sessions.reduce((sum, session) => sum + session.entries.filter(entry => entry.done).length, 0);
  return { total, done, percent: total ? Math.round(done * 100 / total) : 0 };
}
export function isBehind(sessions: Session[], today: string) {
  return sessions.some(session => session.date < today && session.entries.some(entry => !entry.done));
}
export function getReview(workspace: Workspace, review: Review) {
  const session = workspace.sessions.find(item => item.id === review.sessionId);
  const entry = session?.entries.find(item => item.id === review.entryId);
  const student = workspace.students.find(item => item.id === session?.studentId);
  const movement = workspace.movements.find(item => item.id === entry?.movementId);
  return { session, entry, student, movement };
}