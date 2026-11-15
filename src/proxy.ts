import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const password = process.env.DEMO_ACCESS_PASSWORD;
  if (!password) return NextResponse.next();
  const supplied = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from('Basic ' + Buffer.from('demo:' + password).toString('base64'));
  if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) return NextResponse.next();
  return new NextResponse('Authentication required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Tamrin Yar Demo"' } });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };