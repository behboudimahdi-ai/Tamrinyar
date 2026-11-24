import { notFound, redirect } from 'next/navigation';
import { currentActor } from '@/features/programs/access';
import { details, programList } from '@/features/programs/repository';
import { ProgramLibrary } from '@/features/programs/library';
export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await currentActor();
  if (!actor) redirect('/login');
  if (actor.role !== 'COACH') notFound();
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(await searchParams))
    if (typeof value === 'string') query[key] = value;
  const list = await programList(actor, new URLSearchParams(query));
  const current = query.renew ? await details(actor, query.renew) : undefined;
  const renewal = current?.status === 'READY' ? { ...current, name: current.definition.name } : undefined;
  return <ProgramLibrary list={list} query={query} renewal={renewal} />;
}
