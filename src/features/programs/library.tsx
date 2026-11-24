'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Archive, Copy, FileText, Plus, Users } from 'lucide-react';
import { Empty, Modal } from '@/components/ui';
import { dateLabel, fa, todayKey } from '../training/model';
import {
  kindLabels,
  statusLabels,
  unitLabels,
  type Definition,
  type DurationUnit,
  type ProgramKind,
} from './definition';
import type { programList } from './repository';
import { message, request } from './client';
import { AssignmentForm } from './assignment-form';
import { ProgramPreview } from './preview';
import './programs.css';

type Summary = Awaited<ReturnType<typeof programList>>;
type Mode = 'details' | 'assign' | 'archive';
export function ProgramLibrary({
  list,
  query,
  renewal,
}: {
  list: Summary;
  query: Record<string, string>;
  renewal?: { id: string; revision: number; name: string; definition: Definition };
}) {
  const router = useRouter();
  const [modal, setModal] = useState<{ id: string; revision: number; name: string; mode: Mode } | null>(
    renewal ? { ...renewal, mode: 'assign' } : null,
  );
  const [bank, setBank] = useState<{ id: string; name: string }[]>([]);
  const [definition, setDefinition] = useState<Definition | null>(renewal?.definition ?? null);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let valid = true;
    if (!modal || modal.mode === 'archive') return;
    Promise.all([
      request<{ definition: Definition }>('/api/programs?id=' + encodeURIComponent(modal.id)),
      modal.mode === 'details'
        ? request<{ id: string; name: string }[]>('/api/programs?choices=movements')
        : Promise.resolve([]),
    ])
      .then(([d, m]) => {
        if (valid) {
          setDefinition(d.definition);
          setBank(m);
        }
      })
      .catch((e) => {
        if (valid) setError(message(e));
      });
    return () => {
      valid = false;
    };
  }, [modal, retry]);
  function open(item: Summary['items'][number], mode: Mode) {
    setError('');
    setDefinition(null);
    setModal({ ...item, mode });
  }
  async function mutate(intent: 'archive' | 'duplicate', id: string, revision: number) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await request('/api/programs', { intent, id, revision });
      setModal(null);
      setNotice(intent === 'archive' ? 'قالب آرشیو شد.' : 'رونوشت در پیش‌نویس‌ها ذخیره شد.');
      router.refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function pageLink(page: number) {
    const params = new URLSearchParams(query);
    params.set('page', String(page));
    return '/programs?' + params;
  }
  return (
    <section className="wp-content">
      <div className="page-title">
        <div>
          <h1>برنامه‌های من</h1>
        </div>
        <Link href="/programs/builder" className="primary">
          <Plus size={18} />
          ایجاد برنامه تمرینی جدید
        </Link>
      </div>
      <form className="panel wp-panel form" action="/programs" method="get">
        <div className="form-grid">
          <label>
            جست‌وجوی برنامه
            <input type="search" name="q" defaultValue={query.q} placeholder="نام، هدف یا سطح" />
          </label>
          <label>
            وضعیت برنامه
            <select name="status" defaultValue={query.status ?? ''}>
              <option value="">همه برنامه‌ها</option>
              {Object.entries(statusLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            نوع برنامه
            <select name="kind" defaultValue={query.kind ?? ''}>
              <option value="">همهٔ انواع</option>
              {Object.entries(kindLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        {query.athlete && <input type="hidden" name="athlete" value={query.athlete} />}
        <div className="wp-actions">
          <button className="secondary">اعمال فیلتر</button>
          {(query.q || query.status || query.kind) && (
            <Link className="text-button" href="/programs">
              پاک کردن فیلترها
            </Link>
          )}
        </div>
      </form>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && !modal && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!list.items.length ? (
        <Empty>
          {list.total
            ? 'در این صفحه برنامه‌ای نیست.'
            : query.q || query.status || query.kind
              ? 'برنامه‌ای با این مشخصات پیدا نشد.'
              : 'هنوز برنامه‌ای ذخیره نکرده‌اید.'}
        </Empty>
      ) : (
        <div className="wp-grid">
          {list.items.map((item) => (
            <article className="panel wp-panel" key={item.id}>
              <div>
                <span className="status">{statusLabels[item.status]}</span>
                <h2>{item.name}</h2>
              </div>
              <p>
                {item.goal || 'هدف تعیین نشده'} · {item.level || 'سطح تعیین نشده'}
              </p>
              <p>
                {fa(item.durationValue)} {unitLabels[item.durationUnit as DurationUnit]} ·{' '}
                {kindLabels[item.kind as ProgramKind]} · {fa(item.sessionCount)} جلسه در{' '}
                {item.kind === 'custom' ? 'برنامه' : 'چرخه'}
              </p>
              <small>آخرین ویرایش {dateLabel(item.updatedAt.slice(0, 10))}</small>
              <div className="wp-actions">
                <button className="text-button" onClick={() => open(item, 'details')}>
                  <FileText size={16} />
                  جزئیات
                </button>
                {item.status !== 'ARCHIVED' && (
                  <Link className="text-button" href={'/programs/builder?id=' + item.id}>
                    ویرایش
                  </Link>
                )}
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => mutate('duplicate', item.id, item.revision)}
                >
                  <Copy size={15} />
                  تکثیر
                </button>
                {item.status === 'READY' && (
                  <button className="secondary" onClick={() => open(item, 'assign')}>
                    <Users size={16} />
                    تخصیص به شاگرد
                  </button>
                )}
                {item.status !== 'ARCHIVED' && (
                  <button className="text-button" onClick={() => open(item, 'archive')}>
                    <Archive size={15} />
                    آرشیو
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {(list.total > 12 || list.page > 1) && (
        <nav className="wp-actions" aria-label="صفحه‌بندی برنامه‌ها">
          {list.page > 1 && <Link href={pageLink(list.page - 1)}>صفحهٔ قبل</Link>}
          <span>صفحهٔ {fa(list.page)}</span>
          {list.page * 12 < list.total && <Link href={pageLink(list.page + 1)}>صفحهٔ بعد</Link>}
        </nav>
      )}
      {modal && (
        <Modal
          title={modal.name}
          onClose={() => {
            if (!busy) {
              setModal(null);
              setError('');
            }
          }}
        >
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          {modal.mode === 'archive' ? (
            <>
              <p>این قالب از فهرست برنامه‌های آماده خارج شود؟ تخصیص‌های ثبت‌شده ادامه دارند.</p>
              <button
                className="primary"
                disabled={busy}
                onClick={() => mutate('archive', modal.id, modal.revision)}
              >
                تأیید آرشیو
              </button>
            </>
          ) : !definition ? (
            error ? (
              <button
                className="secondary"
                onClick={() => {
                  setError('');
                  setRetry(retry + 1);
                }}
              >
                تلاش مجدد
              </button>
            ) : (
              <p role="status">در حال دریافت برنامه…</p>
            )
          ) : modal.mode === 'assign' ? (
            <AssignmentForm
              id={modal.id}
              revision={modal.revision}
              program={definition}
              initialAthlete={query.athlete}
              initialStart={query.start}
            />
          ) : (
            <div className="form">
              <p>{definition.description}</p>
              {definition.sessions.map((s) => (
                <details key={s.id}>
                  <summary>{s.title}</summary>
                  <p>
                    {s.groups} {s.notes}
                  </p>
                  <p>
                    {s.warmup} {s.cooldown}
                  </p>
                  <ul>
                    {s.entries.map((e) => (
                      <li key={e.id}>
                        {bank.find((m) => m.id === e.movementId)?.name} · {e.sets.toLocaleString('fa-IR')} ست
                        × {e.reps.toLocaleString('fa-IR')} تکرار {e.notes}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
              {definition.sessions.length > 0 && <ProgramPreview program={definition} start={todayKey()} />}
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}
