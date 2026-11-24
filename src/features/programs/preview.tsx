'use client';
import { useState } from 'react';
import { dateLabel, fa, weekdays } from '../training/model';
import { kindLabels, unitLabels, type Definition } from './definition';
import { schedule } from './recurrence';
import { message } from './client';
export function ProgramPreview({ program, start }: { program: Definition; start: string }) {
  const [page, setPage] = useState(0);
  let result: ReturnType<typeof schedule>;
  try {
    result = schedule(program, start);
  } catch (error) {
    return (
      <p className="notice error" role="alert">
        {message(error)}
      </p>
    );
  }
  const dates = new Map<string, string[]>();
  for (const occurrence of result.occurrences) {
    const title = program.sessions.find((s) => s.id === occurrence.slotId)?.title ?? '';
    dates.set(occurrence.date, [...(dates.get(occurrence.date) ?? []), title]);
  }
  const total = result.occurrences.length;
  const days = Math.round((Date.parse(result.end) - Date.parse(start)) / 86400000) + 1;
  const index = Math.min(page, Math.floor((days - 1) / 14)),
    offset = index * 14;
  const saving = Math.max(0, 100 * (1 - program.sessions.length / total));
  return (
    <section className="wp-preview" aria-label="پیش‌نمایش همین برنامه">
      <p>
        <strong>
          {fa(program.sessions.length)} جلسه طراحی‌شده · {fa(total)} جلسه زمان‌بندی‌شده
        </strong>
      </p>
      <p>
        {kindLabels[program.kind]} · {fa(program.durationValue)} {unitLabels[program.durationUnit]} ·{' '}
        {fa(result.completeCycles)} چرخهٔ کامل{result.cycles > result.completeCycles ? ' و یک چرخهٔ ناقص' : ''}
      </p>
      <p>
        {dateLabel(start)} تا {dateLabel(result.end)} ·{' '}
        {saving.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪ کاهش ورود دستی
      </p>
      {program.kind === 'weekly' && (
        <p>
          روزهای تمرین {program.sessions.map((s) => weekdays[s.weekday]).join('، ')} · استراحت{' '}
          {weekdays.filter((_, i) => !program.sessions.some((s) => s.weekday === i)).join('، ') || 'ندارد'}
        </p>
      )}
      <details>
        <summary>دیدن تاریخ جلسات و روزهای استراحت</summary>
        <ol>
          {Array.from({ length: Math.min(14, days - offset) }, (_, i) => {
            const key = new Date(Date.parse(start) + (offset + i) * 86400000).toISOString().slice(0, 10);
            return (
              <li key={key}>
                <span>{dateLabel(key)}</span> · {dates.get(key)?.join('، ') ?? 'استراحت'}
              </li>
            );
          })}
        </ol>
        <div className="wp-actions">
          <button type="button" className="text-button" disabled={!index} onClick={() => setPage(index - 1)}>
            بازهٔ قبل
          </button>
          <button
            type="button"
            className="text-button"
            disabled={offset + 14 >= days}
            onClick={() => setPage(index + 1)}
          >
            بازهٔ بعد
          </button>
        </div>
      </details>
    </section>
  );
}
