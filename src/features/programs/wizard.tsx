'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, ChevronRight, Save } from 'lucide-react';
import { fa, goalOptions, levelOptions, todayKey, weekdays, type Movement } from '../training/model';
import {
  freshProgram,
  newSession,
  parseDefinition,
  kindLabels,
  unitLabels,
  type Definition,
  type SessionTemplate,
  type ProgramKind,
} from './definition';
import { message, moveItem, request } from './client';
import { SessionEditor, cloneSlot } from './session-editor';
import { ProgramPreview } from './preview';
import { AssignmentForm } from './assignment-form';
import { schedule } from './recurrence';
import './programs.css';
const steps = ['اطلاعات پایه', 'نوع برنامه', 'ساختار جلسات', 'طراحی جلسات', 'پیش‌نمایش', 'ذخیره و تخصیص'];
const descriptions: Record<ProgramKind, string> = {
  weekly: 'مثلاً شنبه، دوشنبه و چهارشنبه در هر هفته.',
  weeks: 'مثلاً چهار هفته با جلسات متفاوت، سپس تکرار همان چهار هفته.',
  months: 'چرخه بر اساس ماه شمسی و طول واقعی آن تکرار می‌شود.',
  custom: 'هر جلسه فقط یک بار در روز تعیین‌شده برگزار می‌شود.',
};
export function Wizard({
  bank,
  initial,
  copyFrom,
}: {
  bank: Movement[];
  initial?: { id: string; revision: number; definition: Definition };
  copyFrom?: SessionTemplate;
}) {
  const [program, setProgram] = useState<Definition>(
    () =>
      initial?.definition ?? {
        ...freshProgram(),
        sessions: [copyFrom ? cloneSlot(copyFrom) : newSession(0, bank[0]?.id)],
      },
  );
  const [step, setStep] = useState(0),
    [active, setActive] = useState(0),
    [start, setStart] = useState(todayKey);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState<{ id: string; revision: number; status: 'READY' | 'DRAFT' } | null>(null);
  const [version, setVersion] = useState(
    initial ? { id: initial.id, revision: initial.revision } : undefined,
  );
  const [importList, setImportList] = useState<{ id: string; name: string }[] | null>(null),
    [importProgram, setImportProgram] = useState<Definition | null>(null);
  const [importSearch, setImportSearch] = useState(''),
    [importPage, setImportPage] = useState(1),
    [importTotal, setImportTotal] = useState(0);
  const sel = Math.min(active, program.sessions.length - 1);
  const set = (patch: Partial<Definition>) => setProgram((p) => ({ ...p, ...patch }));
  function updateSlot(i: number, patch: Partial<SessionTemplate>) {
    set({ sessions: program.sessions.map((s, j) => (i === j ? { ...s, ...patch } : s)) });
  }
  function availableDay(slots: SessionTemplate[]) {
    return weekdays.findIndex((_, i) => !slots.some((s) => s.weekday === i));
  }
  function append(slot: SessionTemplate) {
    const day = availableDay(program.sessions);
    if (program.kind === 'weekly' && day < 0) {
      setError('هر هفت روز هفته انتخاب شده‌اند.');
      return;
    }
    set({ sessions: [...program.sessions, { ...slot, weekday: day < 0 ? slot.weekday : day }] });
    setActive(program.sessions.length);
    setError('');
  }
  function changeCount(n: number) {
    if (!Number.isInteger(n) || n < 1 || n > (program.kind === 'weekly' ? 7 : 366)) return;
    const slots = program.sessions.slice(0, n);
    while (slots.length < n) {
      const item = newSession(slots.length, bank[0]?.id);
      item.weekday = Math.max(0, availableDay(slots));
      slots.push(item);
    }
    set({ sessions: slots });
    setActive(0);
  }
  function next() {
    setError('');
    try {
      if (
        step === 0 &&
        (!program.name.trim() ||
          !program.goal.trim() ||
          !program.level.trim() ||
          !Number.isInteger(program.durationValue) ||
          program.durationValue < 1)
      )
        throw Error('نام، هدف، سطح و مدت معتبر برنامه را وارد کنید.');
      if (step === 2) {
        if (
          program.kind === 'weekly' &&
          new Set(program.sessions.map((s) => s.weekday)).size !== program.sessions.length
        )
          throw Error('روزهای هفتگی هر جلسه باید متفاوت باشند.');
        const structure = {
          ...program,
          sessions: program.sessions.map((s) => ({
            ...s,
            entries: [{ id: 'structure', movementId: 'structure', sets: 1, reps: 1 }],
          })),
        };
        parseDefinition(structure);
        schedule(structure, start);
      }
      if (step >= 3) {
        parseDefinition(program);
        schedule(program, start);
      }
      setStep(step + 1);
    } catch (e) {
      setError(message(e));
    }
  }
  async function save(status: 'DRAFT' | 'READY') {
    setError('');
    setBusy(true);
    try {
      parseDefinition(program, status === 'READY');
      const result = await request<{ id: string; revision: number }>('/api/programs', {
        intent: 'save',
        definition: program,
        status,
        ...version,
      });
      setVersion(result);
      setSaved({ ...result, status });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function imports(page = 1) {
    try {
      setError('');
      const result = await request<{ items: { id: string; name: string }[]; total: number }>(
        '/api/programs?status=READY&q=' + encodeURIComponent(importSearch) + '&page=' + page,
      );
      setImportList(result.items);
      setImportTotal(result.total);
      setImportPage(page);
    } catch (e) {
      setError(message(e));
    }
  }
  if (saved)
    return (
      <section className="panel wp-panel">
        <h1>{program.name}</h1>
        <p role="status">{saved.status === 'READY' ? 'قالب برنامه ذخیره شد.' : 'پیش‌نویس ذخیره شد.'}</p>
        {saved.status === 'READY' && (
          <AssignmentForm id={saved.id} revision={saved.revision} program={program} />
        )}
        <div className="wp-actions">
          <Link className="secondary" href="/programs">
            برنامه‌های من
          </Link>
          <button className="text-button" onClick={() => setSaved(null)}>
            ادامهٔ ویرایش
          </button>
        </div>
      </section>
    );
  return (
    <div className="wp-content">
      <div className="page-title">
        <div>
          <Link className="text-button" href="/programs">
            برنامه‌های من
          </Link>
          <h1>{initial ? 'ویرایش برنامه' : 'ایجاد برنامه تمرینی جدید'}</h1>
        </div>
        <button className="secondary" disabled={busy} onClick={() => save('DRAFT')}>
          <Save size={16} />
          ذخیره پیش‌نویس
        </button>
      </div>
      <ol className="wp-steps" aria-label="مراحل ساخت برنامه">
        {steps.map((name, i) => (
          <li key={name} aria-current={i === step ? 'step' : undefined}>
            {i < step ? <Check size={14} /> : fa(i + 1)} {name}
          </li>
        ))}
      </ol>
      <section className="panel wp-panel form" aria-label={steps[step]}>
        <h2>{steps[step]}</h2>
        {step === 0 && (
          <>
            <label>
              نام برنامه
              <input value={program.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <div className="form-grid">
              <label>
                هدف تمرینی
                <input list="wp-goals" value={program.goal} onChange={(e) => set({ goal: e.target.value })} />
                <datalist id="wp-goals">
                  {goalOptions.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
              </label>
              <label>
                سطح ورزشکار
                <select value={program.level} onChange={(e) => set({ level: e.target.value })}>
                  <option value="">انتخاب سطح</option>
                  {levelOptions.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label>
                مدت کل برنامه
                <input
                  type="number"
                  min="1"
                  value={program.durationValue || ''}
                  onChange={(e) => set({ durationValue: +e.target.value })}
                />
              </label>
              <label>
                واحد مدت
                <select
                  value={program.durationUnit}
                  onChange={(e) => set({ durationUnit: e.target.value as Definition['durationUnit'] })}
                >
                  {Object.entries(unitLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              توضیحات برنامه
              <textarea
                maxLength={3000}
                value={program.description}
                onChange={(e) => set({ description: e.target.value })}
              />
            </label>
          </>
        )}
        {step === 1 && (
          <fieldset className="wp-options">
            <legend>نوع تکرار</legend>
            {(Object.keys(kindLabels) as ProgramKind[]).map((k) => (
              <label key={k}>
                <input
                  type="radio"
                  name="kind"
                  checked={program.kind === k}
                  onChange={() => set({ kind: k })}
                />
                <span>
                  <strong>{kindLabels[k]}</strong>
                  <small>{descriptions[k]}</small>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {step === 2 && (
          <>
            {(program.kind === 'weeks' || program.kind === 'months') && (
              <label>
                طول چرخه ({program.kind === 'weeks' ? 'هفته' : 'ماه شمسی'})
                <input
                  type="number"
                  min="1"
                  value={program.cycleLength || ''}
                  onChange={(e) => set({ cycleLength: +e.target.value })}
                />
              </label>
            )}
            <label>
              {program.kind === 'weekly'
                ? 'تعداد جلسات هفتگی'
                : program.kind === 'custom'
                  ? 'تعداد کل جلسات'
                  : 'تعداد جلسات در چرخه'}
              <input
                type="number"
                min="1"
                max={program.kind === 'weekly' ? 7 : 366}
                value={program.sessions.length}
                onChange={(e) => changeCount(+e.target.value)}
              />
            </label>
            {program.sessions.map((s, i) => (
              <fieldset className="wp-box" key={s.id}>
                <legend>{s.title}</legend>
                {program.kind === 'weekly' ? (
                  <label>
                    روز تمرین {fa(i + 1)}
                    <select value={s.weekday} onChange={(e) => updateSlot(i, { weekday: +e.target.value })}>
                      {weekdays.map((d, j) => (
                        <option key={d} value={j}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label>
                    روز اجرای جلسه {fa(i + 1)}
                    <input
                      type="number"
                      min="1"
                      value={s.offset + 1}
                      onChange={(e) => updateSlot(i, { offset: +e.target.value - 1 })}
                    />
                  </label>
                )}
                <div className="wp-actions">
                  <button
                    className="text-button"
                    disabled={i === 0}
                    onClick={() => set({ sessions: moveItem(program.sessions, i, -1) })}
                  >
                    جلسه بالاتر
                  </button>
                  <button
                    className="text-button"
                    disabled={i === program.sessions.length - 1}
                    onClick={() => set({ sessions: moveItem(program.sessions, i, 1) })}
                  >
                    جلسه پایین‌تر
                  </button>
                </div>
              </fieldset>
            ))}
          </>
        )}
        {step === 3 && (
          <>
            <label>
              انتخاب جلسه برای ویرایش
              <select value={sel} onChange={(e) => setActive(+e.target.value)}>
                {program.sessions.map((s, i) => (
                  <option key={s.id} value={i}>
                    {s.title || fa(i + 1)}
                  </option>
                ))}
              </select>
            </label>
            <SessionEditor slot={program.sessions[sel]} bank={bank} change={(s) => updateSlot(sel, s)} />
            <div className="wp-actions">
              <button className="secondary" onClick={() => append(cloneSlot(program.sessions[sel]))}>
                کپی جلسه
              </button>
              <button
                className="secondary"
                disabled={program.sessions.length <= 1}
                onClick={() => {
                  set({ sessions: program.sessions.filter((_, i) => i !== sel) });
                  setActive(0);
                }}
              >
                حذف جلسه
              </button>
            </div>
            <details>
              <summary>استفاده از جلسات برنامه‌های قبلی</summary>
              <label>
                جست‌وجوی قالب
                <input value={importSearch} onChange={(e) => setImportSearch(e.target.value)} />
              </label>
              <button className="text-button" onClick={() => imports()}>
                نمایش قالب‌ها
              </button>
              {importList && (
                <>
                  <label>
                    برنامهٔ قبلی
                    <select
                      defaultValue=""
                      onChange={async (e) => {
                        try {
                          setImportProgram(null);
                          if (e.target.value)
                            setImportProgram(
                              (
                                await request<{ definition: Definition }>(
                                  '/api/programs?id=' + e.target.value,
                                )
                              ).definition,
                            );
                        } catch (err) {
                          setError(message(err));
                        }
                      }}
                    >
                      <option value="">انتخاب قالب</option>
                      {importList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="wp-actions">
                    <button
                      className="text-button"
                      disabled={importPage === 1}
                      onClick={() => imports(importPage - 1)}
                    >
                      صفحهٔ قبل
                    </button>
                    <button
                      className="text-button"
                      disabled={importPage * 12 >= importTotal}
                      onClick={() => imports(importPage + 1)}
                    >
                      صفحهٔ بعد
                    </button>
                  </div>
                </>
              )}
              {importProgram?.sessions.map((s) => (
                <button key={s.id} className="text-button" onClick={() => append(cloneSlot(s))}>
                  افزودن {s.title}
                </button>
              ))}
            </details>
          </>
        )}
        {step === 4 && (
          <>
            <label>
              تاریخ شروع پیش‌نمایش
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <ProgramPreview program={program} start={start} />
          </>
        )}
        {step === 5 && (
          <>
            <p>
              {program.name} · {fa(program.sessions.length)} جلسهٔ طراحی‌شده
            </p>
            <button className="primary" disabled={busy} onClick={() => save('READY')}>
              <Check size={16} />
              ذخیره قالب
            </button>
          </>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="wp-actions">
          {step > 0 && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setStep(step - 1);
                setError('');
              }}
            >
              <ChevronRight size={16} />
              قبلی
            </button>
          )}
          {step < 5 && (
            <button className="primary" disabled={busy} onClick={next}>
              بعدی
              <ArrowLeft size={16} />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
