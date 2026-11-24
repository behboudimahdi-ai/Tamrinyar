import { AccessError } from './access';
import { ProgramError } from './definition';
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host'))
    throw new AccessError(403, 'مبدأ درخواست مجاز نیست.');
}
export async function response(task: () => Promise<unknown>) {
  try {
    return Response.json(await task(), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AccessError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof ProgramError || error instanceof SyntaxError)
      return Response.json(
        { error: error instanceof ProgramError ? error.message : 'درخواست نامعتبر است.' },
        { status: 400 },
      );
    console.error('Workout request failed', error);
    return Response.json({ error: 'عملیات انجام نشد. دوباره تلاش کنید.' }, { status: 500 });
  }
}
