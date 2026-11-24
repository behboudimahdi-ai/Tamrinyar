import { currentActor } from '@/features/programs/access';
import { localDemo } from '@/features/training/database';
import { readClip, readWorkspace } from '@/features/training/store';

export async function GET(request: Request, context: RouteContext<'/api/clips/[id]'>) {
  if (!localDemo() && !(await currentActor())) return new Response(null,{status:401});
  const { id } = await context.params;
  const workspace = await readWorkspace();
  if (!workspace.reviews.some(review => review.clipId === id) && !workspace.movements.some(movement => movement.video === id)) {
    return new Response(null, { status: 404 });
  }
  const clip = await readClip(id);
  if (!clip) return new Response(null, { status: 404 });
  const size = clip.content.byteLength;
  const headers = new Headers({ 'Content-Type': clip.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  const requested = request.headers.get('range');
  if (!requested) {
    headers.set('Content-Length', String(size));
    return new Response(new Uint8Array(clip.content), { headers });
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(requested);
  const start = match?.[1] ? Number(match[1]) : Math.max(0, size - Number(match?.[2]));
  const end = match?.[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!match || !Number.isSafeInteger(start) || start > end || start >= size) {
    headers.set('Content-Range', 'bytes */' + size);
    return new Response(null, { status: 416, headers });
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(new Uint8Array(clip.content.subarray(start, end + 1)), { status: 206, headers });
}
