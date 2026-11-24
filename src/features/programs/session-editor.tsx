'use client';
import type { Movement } from '../training/model';
import { newExercise, type SessionTemplate, type Prescription } from './definition';
import { moveItem } from './client';

export function cloneSlot(slot: SessionTemplate): SessionTemplate {
  return {
    ...slot,
    id: crypto.randomUUID(),
    entries: slot.entries.map((e) => ({ ...e, id: crypto.randomUUID() })),
  };
}
export function SessionEditor({
  slot,
  bank,
  change,
}: {
  slot: SessionTemplate;
  bank: Movement[];
  change: (s: SessionTemplate) => void;
}) {
  const set = (patch: Partial<SessionTemplate>) => change({ ...slot, ...patch });
  function exercise(id: string, patch: Partial<Prescription>) {
    set({ entries: slot.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  }
  return (
    <div className="form wp-editor">
      <div className="form-grid">
        <label>
          نام جلسه
          <input value={slot.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label>
          گروه عضلانی هدف
          <input value={slot.groups} onChange={(e) => set({ groups: e.target.value })} />
        </label>
        <label>
          مدت تقریبی (دقیقه)
          <input
            type="number"
            min="1"
            value={slot.minutes ?? ''}
            onChange={(e) => set({ minutes: e.target.value ? +e.target.value : undefined })}
          />
        </label>
        <label>
          توضیحات مربی
          <input value={slot.notes} onChange={(e) => set({ notes: e.target.value })} />
        </label>
        <label>
          گرم کردن
          <textarea value={slot.warmup} onChange={(e) => set({ warmup: e.target.value })} />
        </label>
        <label>
          سرد کردن
          <textarea value={slot.cooldown} onChange={(e) => set({ cooldown: e.target.value })} />
        </label>
      </div>
      <h3>حرکات اصلی</h3>
      {slot.entries.map((item, i) => (
        <fieldset className="wp-box" key={item.id}>
          <legend>حرکت {(i + 1).toLocaleString('fa-IR')}</legend>
          <div className="form-grid">
            <label>
              حرکت
              <select
                value={item.movementId}
                onChange={(e) => exercise(item.id, { movementId: e.target.value })}
              >
                <option value="">انتخاب حرکت</option>
                {bank.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ست
              <input
                type="number"
                min="1"
                max="100"
                value={item.sets || ''}
                onChange={(e) => exercise(item.id, { sets: +e.target.value })}
              />
            </label>
            <label>
              تکرار
              <input
                type="number"
                min="1"
                max="1000"
                value={item.reps || ''}
                onChange={(e) => exercise(item.id, { reps: +e.target.value })}
              />
            </label>
          </div>
          <details>
            <summary>جزئیات اختیاری حرکت</summary>
            <div className="form-grid">
              {(
                [
                  ['weight', 'وزنه (کیلوگرم)'],
                  ['seconds', 'مدت حرکت (ثانیه)'],
                  ['rest', 'استراحت (ثانیه)'],
                  ['rpe', 'RPE'],
                  ['rir', 'RIR'],
                ] as const
              ).map(([k, label]) => (
                <label key={k}>
                  {label}
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={item[k] ?? ''}
                    onChange={(e) => exercise(item.id, { [k]: e.target.value ? +e.target.value : undefined })}
                  />
                </label>
              ))}
              <label>
                تمپو
                <input
                  value={item.tempo ?? ''}
                  onChange={(e) => exercise(item.id, { tempo: e.target.value })}
                />
              </label>
              <label>
                یادداشت حرکت
                <input
                  value={item.notes ?? ''}
                  onChange={(e) => exercise(item.id, { notes: e.target.value })}
                />
              </label>
            </div>
          </details>
          <div className="wp-actions">
            <button
              type="button"
              className="text-button"
              disabled={!i}
              onClick={() => set({ entries: moveItem(slot.entries, i, -1) })}
            >
              حرکت بالاتر
            </button>
            <button
              type="button"
              className="text-button"
              disabled={i === slot.entries.length - 1}
              onClick={() => set({ entries: moveItem(slot.entries, i, 1) })}
            >
              حرکت پایین‌تر
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                set({
                  entries: [
                    ...slot.entries.slice(0, i + 1),
                    { ...item, id: crypto.randomUUID() },
                    ...slot.entries.slice(i + 1),
                  ],
                })
              }
            >
              کپی حرکت
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => set({ entries: slot.entries.filter((e) => e.id !== item.id) })}
            >
              حذف حرکت
            </button>
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        className="secondary"
        onClick={() => set({ entries: [...slot.entries, newExercise(bank[0]?.id)] })}
      >
        افزودن حرکت
      </button>
    </div>
  );
}
