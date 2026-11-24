import { redirect, notFound } from 'next/navigation';
import { currentActor } from '@/features/programs/access';
import { ProgramShell } from '@/features/programs/shell';
import { database } from '@/features/training/database';
export default async function ProgramsLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor();
  if (!actor) redirect('/login');
  if (actor.role !== 'COACH') notFound();
  const [row] = await database().$queryRaw<
    { pending: number }[]
  >`SELECT count(*)::int AS pending FROM "Workspace",
    LATERAL jsonb_array_elements(data->'reviews') r WHERE id=${actor.coachId} AND coalesce(r->>'feedback','')=''`;
  return <ProgramShell pending={row.pending}>{children}</ProgramShell>;
}
