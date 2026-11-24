import { redirect, notFound } from 'next/navigation';
import { currentActor } from '@/features/programs/access';
import { details, movementsFor } from '@/features/programs/repository';
import { Wizard } from '@/features/programs/wizard';
import { newSession } from '@/features/programs/definition';
import { readWorkspace } from '@/features/training/store';
export default async function BuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; athlete?: string; session?: string }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect('/login');
  if (actor.role !== 'COACH') notFound();
  const p = await searchParams;
  const bank = await movementsFor(actor.coachId);
  const initial = p.id ? await details(actor, p.id) : undefined;
  if (initial?.status === 'ARCHIVED') notFound();
  let copyFrom;
  if (p.athlete && p.session) {
    const workspace = await readWorkspace(p.athlete);
    const s = workspace.sessions.find((s) => s.id === p.session && s.studentId === p.athlete);
    if (!s) notFound();
    copyFrom = s.prescription ?? {
      ...newSession(0),
      title: s.title,
      entries: s.entries.map(({ id, movementId, sets, reps }) => ({ id, movementId, sets, reps })),
    };
  }
  return <Wizard bank={bank} initial={initial} copyFrom={copyFrom} />;
}
