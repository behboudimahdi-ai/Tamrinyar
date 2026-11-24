import { connection } from 'next/server';
import { notFound, redirect } from 'next/navigation';
import { Dashboard } from '@/features/dashboard/dashboard';
import type { Screen } from '@/features/dashboard/overview';
import { todayKey } from '@/features/training/model';
import { readWorkspace } from '@/features/training/store';
import { localDemo } from '@/features/training/database';
import { currentActor } from '@/features/programs/access';
import { assignedWorkouts } from '@/features/programs/athlete';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; athlete?: string; pending?: string }>;
}) {
  await connection();
  const { view, athlete, pending } = await searchParams;
  if (view === 'plans') redirect('/programs');
  const demo = localDemo(),
    actor = demo ? null : await currentActor();
  if (!demo && !actor) redirect('/login');
  const coach = actor?.role !== 'ATHLETE';
  const allowed = coach
    ? ['overview', 'students', 'reviews', 'assistant', 'library', 'subscription']
    : ['schedule', 'reviews', 'assistant', 'library'];
  if (view && !allowed.includes(view)) notFound();
  if (actor?.role === 'ATHLETE' && athlete && athlete !== actor.athleteId) notFound();
  const screen = (view ?? (coach ? 'overview' : 'schedule')) as Screen;
  const studentId =
    actor?.role === 'ATHLETE' ? actor.athleteId! : screen === 'students' ? athlete : undefined;
  const assigned = actor && studentId ? await assignedWorkouts(actor, studentId) : undefined;
  const workspace = await readWorkspace(studentId, assigned);
  if (studentId && !workspace.students.some((s) => s.id === studentId)) notFound();
  return (
    <Dashboard
      key={[screen, studentId, pending].join('/')}
      account={actor ?? undefined}
      initialView={screen}
      initialPending={coach && screen === 'reviews' && pending === '1'}
      initialStudent={coach ? studentId : undefined}
      programs={assigned?.programs}
      workspace={workspace}
      today={todayKey()}
      assistantConnected={Boolean(
        process.env.AI_URL && process.env.AI_MODEL && process.env.AI_WORKSPACE_CONSENT === 'true',
      )}
    />
  );
}
