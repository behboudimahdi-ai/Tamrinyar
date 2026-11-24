'use client';
import { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import '@/features/programs/programs.css';
export default function Login() {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <main className="wp-login">
      <section className="panel wp-panel">
        <Dumbbell size={28} />
        <h1>ورود به تمرین‌یار</h1>
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setBusy(true);
            setError('');
            try {
              const res = await fetch('/api/session', { method: 'POST', body: form });
              if (!res.ok) throw Error((await res.json()).error);
              location.assign('/');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'ارتباط برقرار نشد.');
              setBusy(false);
            }
          }}
        >
          <label>
            نام کاربری
            <input name="login" required autoComplete="username" dir="auto" />
          </label>
          <label>
            گذرواژه
            <input name="password" required type="password" autoComplete="current-password" />
          </label>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? 'در حال ورود…' : 'ورود'}
          </button>
        </form>
      </section>
    </main>
  );
}
