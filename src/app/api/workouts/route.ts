import { authenticated } from '@/features/programs/access';
import { assignedWorkouts, editOccurrence, logCompletion } from '@/features/programs/athlete';
import { ensure } from '@/features/programs/definition';
import { response, sameOrigin } from '@/features/programs/http';
export async function GET(req: Request) {
  return response(async () => {
    const actor = await authenticated(),
      athleteId = new URL(req.url).searchParams.get('athlete');
    ensure(athleteId, 'شاگرد را انتخاب کنید.');
    return assignedWorkouts(actor, athleteId);
  });
}
export async function POST(req: Request) {
  return response(async () => {
    sameOrigin(req);
    const actor = await authenticated(),
      data = await req.json();
    ensure(data && typeof data.sessionId === 'string', 'جلسه را انتخاب کنید.');
    if (data.intent === 'complete') return logCompletion(actor, data.sessionId, data.entryId, data.done);
    ensure(data.intent === 'edit', 'عملیات معتبر نیست.');
    return editOccurrence(
      actor,
      data.sessionId,
      data.revision,
      data.slot,
      data.scope,
      data.reason,
      data.date,
    );
  });
}
