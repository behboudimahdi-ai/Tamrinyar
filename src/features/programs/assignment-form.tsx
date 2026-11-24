'use client';
import { useEffect, useState } from 'react';
import { todayKey } from '../training/model';
import type { Definition } from './definition';
import { request, message } from './client';
import { ProgramPreview } from './preview';
import { schedule } from './recurrence';
export function AssignmentForm({
  id,
  revision,
  program,
  initialAthlete,
}: {
  id: string;
  revision: number;
  program: Definition;
  initialAthlete?: string;
}) {
  const [people, setPeople] = useState<{ id: string; name: string }[] | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    initialAthlete ? { [initialAthlete]: todayKey() } : {},
  );
  const [key, setKey] = useState(() => crypto.randomUUID()),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    request<{ id: string; name: string }[]>('/api/programs?choices=athletes')
      .then((v) => {
        if (current) setPeople(v);
      })
      .catch((e) => {
        if (current) setError(message(e));
      });
    return () => {
      current = false;
    };
  }, [attempt]);
  function change(next: Record<string, string>) {
    setSelected(next);
    setKey(crypto.randomUUID());
    setConfirm(false);
    setError('');
  }
  async function submit() {
    setError('');
    try {
      const recipients = Object.entries(selected).map(([athleteId, start]) => ({ athleteId, start }));
      if (!recipients.length) throw Error('حداقل یک شاگرد انتخاب کنید.');
      for (const r of recipients) schedule(program, r.start);
      if (!confirm) {
        setConfirm(true);
        return;
      }
      setBusy(true);
      await request('/api/programs', { intent: 'assign', id, revision, requestId: key, recipients });
      setSaved(true);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (saved)
    return (
      <div role="status">
        <p>برنامه برای شاگردان انتخابی ثبت شد.</p>
        {people
          ?.filter((p) => selected[p.id])
          .map((p) => (
            <a
              className="text-button"
              key={p.id}
              href={'/?view=students&athlete=' + encodeURIComponent(p.id)}
            >
              پروندهٔ {p.name}
            </a>
          ))}
      </div>
    );
  return (
    <div className="form">
      <h3>تخصیص برنامه به شاگردان</h3>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {!people ? (
        error ? (
          <button
            className="secondary"
            onClick={() => {
              setError('');
              setAttempt(attempt + 1);
            }}
          >
            تلاش مجدد
          </button>
        ) : (
          <p role="status">در حال دریافت شاگردان…</p>
        )
      ) : !people.length ? (
        <p className="empty">برای تخصیص، ابتدا در بخش شاگردان یک پرونده بسازید.</p>
      ) : (
        <>
          {people.map((p) => (
            <div className="wp-recipient" key={p.id}>
              <label>
                <input
                  type="checkbox"
                  checked={Object.hasOwn(selected, p.id)}
                  disabled={busy || confirm}
                  onChange={(e) => {
                    const next = { ...selected };
                    if (e.target.checked) next[p.id] = todayKey();
                    else delete next[p.id];
                    change(next);
                  }}
                />
                {p.name}
              </label>
              {Object.hasOwn(selected, p.id) && (
                <label>
                  تاریخ شروع {p.name}
                  <input
                    type="date"
                    value={selected[p.id]}
                    disabled={busy || confirm}
                    onChange={(e) => change({ ...selected, [p.id]: e.target.value })}
                  />
                </label>
              )}
              {confirm && selected[p.id] && <ProgramPreview program={program} start={selected[p.id]} />}
            </div>
          ))}
          <div className="wp-actions">
            {confirm && (
              <button className="secondary" disabled={busy} onClick={() => setConfirm(false)}>
                اصلاح انتخاب
              </button>
            )}
            <button className="primary" disabled={busy || !Object.keys(selected).length} onClick={submit}>
              {busy ? 'در حال ثبت…' : confirm ? 'تأیید تخصیص' : 'پیش‌نمایش تخصیص'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
