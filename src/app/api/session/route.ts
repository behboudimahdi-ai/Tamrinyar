import { login, logout } from '@/features/programs/access';
import { ensure } from '@/features/programs/definition';
import { response, sameOrigin } from '@/features/programs/http';
export async function POST(req: Request) {
  return response(async () => {
    sameOrigin(req);
    const form = await req.formData();
    if (form.get('action') === 'logout') {
      await logout();
      return { ok: true };
    }
    const name = form.get('login'),
      password = form.get('password');
    ensure(
      typeof name === 'string' &&
        name.length <= 160 &&
        typeof password === 'string' &&
        password.length > 0 &&
        password.length <= 512,
      'نام کاربری و گذرواژه را وارد کنید.',
    );
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(req.url).hostname);
    await login(
      name,
      password,
      new URL(req.url).protocol === 'https:' || (process.env.NODE_ENV === 'production' && !loopback),
    );
    return { ok: true };
  });
}
