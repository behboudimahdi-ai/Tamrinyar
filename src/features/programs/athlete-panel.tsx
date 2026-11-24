'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Modal, Section, Empty } from '@/components/ui';
import {
  dateLabel,
  fa,
  offsetDate,
  weekdays,
  weekStart,
  type Session,
  type Movement,
} from '../training/model';
import type { AssignmentInfo } from './athlete';
import { SessionEditor } from './session-editor';
import { message, request } from './client';
import './programs.css';
export function AthletePrograms({
  programs,
  sessions,
  today,
  coach,
  athleteId,
}: {
  programs: AssignmentInfo[];
  sessions: Session[];
  today: string;
  coach: boolean;
  athleteId: string;
}) {
  const relevant = sessions.filter((s) => s.studentId === athleteId);
  const next = [...relevant].filter((s) => s.date > today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const current = relevant.filter((s) => s.date === today);
  return (
    <Section title="برنامه‌ها و پیشرفت">
      <p>جلسهٔ امروز · {current.map((s) => s.title).join('، ') || 'استراحت'}</p>
      <p>جلسهٔ بعدی · {next ? next.title + '، ' + dateLabel(next.date) : 'جلسه‌ای ثبت نشده'}</p>
      {programs.length ? (
        programs.map((p) => (
          <article key={p.id} className="session-card">
            <h3>{p.name}</h3>
            <p>
              {p.start > today ? 'پیش رو' : p.end < today ? 'برنامهٔ قبلی' : 'برنامهٔ فعال'} ·{' '}
              {dateLabel(p.start)} تا {dateLabel(p.end)}
            </p>
            <p>
              {fa(p.completed)} انجام‌شده · {fa(p.total - p.completed)} باقی‌مانده ·{' '}
              {fa(p.total ? Math.round((100 * p.completed) / p.total) : 0)}٪ پیشرفت
            </p>
            {coach && (
              <Link
                className="text-button"
                href={
                  '/programs?' +
                  new URLSearchParams({
                    athlete: athleteId,
                    renew: p.templateId,
                    start: p.end >= today ? offsetDate(p.end, 1) : today,
                  })
                }
              >
                تمدید برنامه
              </Link>
            )}
          </article>
        ))
      ) : (
        <Empty>هنوز برنامهٔ دوره‌ای تخصیص داده نشده است.</Empty>
      )}
      {coach && (
        <Link href={'/programs?athlete=' + encodeURIComponent(athleteId)} className="secondary">
          انتخاب از برنامه‌های من
        </Link>
      )}
    </Section>
  );
}
export function PersonalCalendar({
  today,
  sessions,
  render,
}: {
  today: string;
  sessions: Session[];
  render: (sessions: Session[]) => React.ReactNode;
}) {
  const [week, setWeek] = useState(0);
  const start = offsetDate(weekStart(today), week * 7),
    end = offsetDate(start, 6);
  const visible = sessions.filter((s) => s.date >= start && s.date <= end);
  return (
    <Section
      title="تقویم اختصاصی"
      detail={dateLabel(start) + ' تا ' + dateLabel(end)}
      action={
        <div className="week-controls">
          <button className="text-button" onClick={() => setWeek(week - 1)}>
            هفتهٔ قبل
          </button>
          <button className="text-button" onClick={() => setWeek(0)}>
            این هفته
          </button>
          <button className="text-button" onClick={() => setWeek(week + 1)}>
            هفتهٔ بعد
          </button>
        </div>
      }
    >
      <div className="week-grid">
        {weekdays.map((day, i) => {
          const date = offsetDate(start, i);
          const n = visible.filter((s) => s.date === date).length;
          return (
            <div key={day} className={date === today ? 'today' : ''}>
              <strong>{day}</strong>
              <small>{dateLabel(date)}</small>
              <span>{n ? fa(n) + ' جلسه' : '—'}</span>
            </div>
          );
        })}
      </div>
      {render(visible)}
    </Section>
  );
}
export function SessionExtras({
  session,
  coach,
  bank,
  today,
}: {
  session: Session;
  coach: boolean;
  bank: Movement[];
  today: string;
}) {
  const router = useRouter(),
    slot = session.prescription;
  const [draft, setDraft] = useState(slot),
    [open, setOpen] = useState(false),
    [scope, setScope] = useState('one'),
    [reason, setReason] = useState(''),
    [date, setDate] = useState(session.date),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  if (!slot || !draft) return null;
  async function save() {
    setBusy(true);
    setError('');
    try {
      await request('/api/workouts', {
        intent: 'edit',
        sessionId: session.id,
        revision: session.revision,
        slot: draft,
        scope,
        reason,
        date: scope === 'one' ? date : undefined,
      });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const extras = slot.entries.map((e) => ({
    id: e.id,
    name: bank.find((m) => m.id === e.movementId)?.name,
    fields: [
      e.weight !== undefined ? 'وزنه ' + fa(e.weight) + ' کیلوگرم' : '',
      e.seconds !== undefined ? 'مدت ' + fa(e.seconds) + ' ثانیه' : '',
      e.rest !== undefined ? 'استراحت ' + fa(e.rest) + ' ثانیه' : '',
      e.rpe !== undefined ? 'RPE ' + fa(e.rpe) : '',
      e.rir !== undefined ? 'RIR ' + fa(e.rir) : '',
      e.tempo ? 'تمپو ' + e.tempo : '',
      e.notes,
    ].filter(Boolean),
  }));
  return (
    <>
      <details>
        <summary>جزئیات جلسه</summary>
        <p>
          {session.programName} · {slot.groups} {slot.minutes ? fa(slot.minutes) + ' دقیقه' : ''}
        </p>
        {slot.warmup && <p>گرم کردن · {slot.warmup}</p>}
        {slot.notes && <p>{slot.notes}</p>}
        {extras
          .filter((e) => e.fields.length)
          .map((e) => (
            <p key={e.id}>
              {e.name} · {e.fields.join('، ')}
            </p>
          ))}
        {slot.cooldown && <p>سرد کردن · {slot.cooldown}</p>}
      </details>
      {coach && session.date >= today && !session.entries.some((e) => e.done) && (
        <button
          className="text-button"
          onClick={() => {
            setDraft(slot);
            setOpen(true);
            setError('');
          }}
        >
          ویرایش جلسه
        </button>
      )}
      {open && (
        <Modal
          title="تغییر جلسهٔ شاگرد"
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <div className="form">
            <label>
              دامنهٔ تغییر
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="one">فقط این جلسه</option>
                <option value="future">این جلسه و جلسات مشابه آیندهٔ همین شاگرد</option>
              </select>
            </label>
            {scope === 'one' && (
              <label>
                تاریخ جلسه
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
            )}
            <SessionEditor slot={draft} change={setDraft} bank={bank} />
            <label>
              دلیل تغییر
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            {error && (
              <p role="alert" className="notice error">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy} onClick={save}>
              ثبت تغییر جلسه
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
