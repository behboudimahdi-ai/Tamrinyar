'use client';

import { Plus, Sparkles, Trash2, Upload, Video } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Empty, Modal } from '@/components/ui';
import { addStudent, addTutorial, draftPlan, saveFeedback, savePlan, uploadReview, type Result } from '../training/actions';
import { dateLabel, fa, getReview, goalOptions, levelOptions, type Movement, type Review, type Workspace } from '../training/model';

export type DialogState =
  | { kind: 'student' }
  | { kind: 'plan'; studentId?: string; ai?: boolean }
  | { kind: 'review'; id: string }
  | { kind: 'tutorial'; id: string }
  | { kind: 'upload'; sessionId: string; entryId: string };

type Submit = (task: () => Promise<Result>, close?: boolean) => void;

function ActionForm({ handler, submit, children }: { handler: (data: FormData) => Promise<Result>; submit: Submit; children: React.ReactNode }) {
  return <form className="form" onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    submit(() => handler(data), true);
  }}>{children}</form>;
}
const options = (list: string[]) => list.map(item => <option key={item}>{item}</option>);

function PlanForm({ workspace, today, studentId, ai, busy, submit }: { workspace: Workspace; today: string; studentId?: string; ai?: boolean; busy: boolean; submit: Submit }) {
  const [selected, setSelected] = useState(studentId ?? workspace.students[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState([{ key: 0, movementId: workspace.movements[0]?.id, sets: 3, reps: 12 }]);
  const [key, setKey] = useState(1);
  function generate() {
    submit(async () => {
      const result = await draftPlan(selected);
      if (result.draft) {
        setTitle(result.draft.title);
        setRows(result.draft.entries.map((entry, index) => ({ ...entry, key: key + index })));
        setKey(key + result.draft.entries.length);
      }
      return result;
    });
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    submit(() => savePlan(data), true);
  }
  if (!workspace.students.length) return <Empty>برای ساخت جلسه ابتدا یک شاگرد اضافه کنید.</Empty>;
  return <form className="form" onSubmit={save}>
    <div className="form-grid"><label>شاگرد<select name="studentId" value={selected} onChange={event => setSelected(event.target.value)}>{workspace.students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
    <label>تاریخ جلسه<input type="date" name="date" defaultValue={today} required /></label></div>
    {ai && <button className="secondary" type="button" onClick={generate} disabled={busy}><Sparkles size={17} />گرفتن پیش‌نویس بر اساس پروندهٔ شاگرد</button>}
    <label>عنوان جلسه<input name="title" value={title} onChange={event => setTitle(event.target.value)} required maxLength={80} placeholder="مثلاً تمرین بالاتنه" /></label>
    {rows.map(row => <div className="movement-form-row" key={row.key}>
      <label>حرکت<select name="movementId" defaultValue={row.movementId}>{workspace.movements.map(movement => <option key={movement.id} value={movement.id}>{movement.name}</option>)}</select></label>
      <label>ست<input type="number" name="sets" min="1" max="12" defaultValue={row.sets} required /></label>
      <label>تکرار<input type="number" name="reps" min="1" max="120" defaultValue={row.reps} required /></label>
      <button type="button" className="icon-button" aria-label="حذف حرکت" disabled={rows.length === 1} onClick={() => setRows(rows.filter(item => item.key !== row.key))}><Trash2 size={16} /></button>
    </div>)}
    <button type="button" className="text-button" disabled={rows.length >= 15} onClick={() => {
      setRows([...rows, { key, movementId: workspace.movements[0]?.id, sets: 3, reps: 12 }]);
      setKey(key + 1);
    }}><Plus size={16} /> افزودن حرکت</button>
    <button className="primary" disabled={busy}>ثبت جلسه برای شاگرد</button>
  </form>;
}

function VideoPlayer({ id }: { id: string }) {
  return <video className="video-player" controls playsInline preload="metadata" src={'/api/clips/' + id} />;
}

function Tutorial({ movement, coach, submit, busy }: { movement: Movement; coach: boolean; submit: Submit; busy: boolean }) {
  return <>
    {movement.video ? <VideoPlayer id={movement.video} /> : <Empty>ویدیوی آموزشی این حرکت هنوز بارگذاری نشده است.</Empty>}
    <p className="note">{movement.cue}</p>
    {coach && <ActionForm handler={addTutorial} submit={submit}><input type="hidden" name="movementId" value={movement.id} /><label>ویدیوی آموزشی فارسی<input type="file" name="video" required accept="video/mp4,video/webm" /></label><button className="primary" disabled={busy}><Upload size={16} />ذخیرهٔ ویدیو</button></ActionForm>}
  </>;
}

function ReviewDetails({ workspace, review, coach, submit, busy }: { workspace: Workspace; review: Review; coach: boolean; submit: Submit; busy: boolean }) {
  const { student, movement, session, entry } = getReview(workspace, review);
  return <>
    <p className="note">{student?.name} · {movement?.name} · {dateLabel(review.date)}{entry && session && ' · ' + fa(entry.sets) + ' ست'}</p>
    {review.clipId ? <VideoPlayer id={review.clipId} /> : <Empty>این بازبینی نمونه است و فایل ویدیو ندارد.</Empty>}
    {coach ? <ActionForm handler={saveFeedback} submit={submit}><input type="hidden" name="reviewId" value={review.id} /><label>بازخورد فرم حرکت<textarea name="feedback" required maxLength={1500} rows={4} defaultValue={review.feedback} placeholder="نکته‌ای که شاگرد باید در اجرای بعدی رعایت کند…" /></label><button className="primary" disabled={busy}>ثبت بازخورد</button></ActionForm> : <p className="note">{review.feedback || 'در انتظار بازخورد مربی'}</p>}
  </>;
}

export function TrainingDialog({ state, workspace, today, coach, busy, notice, submit, close }: { state: DialogState; workspace: Workspace; today: string; coach: boolean; busy: boolean; notice: Result; submit: Submit; close: () => void }) {
  let title: string;
  let body: React.ReactNode;
  switch (state.kind) {
    case 'student':
      title = 'افزودن شاگرد';
      body = <ActionForm handler={addStudent} submit={submit}><label>نام و نام خانوادگی<input name="name" required maxLength={60} /></label>
        <div className="form-grid"><label>سن<input name="age" type="number" min="16" max="100" required /></label><label>وزن (کیلوگرم)<input name="weight" type="number" min="30" max="350" required /></label></div>
        <div className="form-grid"><label>سطح<select name="level">{options(levelOptions)}</select></label><label>هدف<select name="goal">{options(goalOptions)}</select></label></div>
        <label>آسیب‌دیدگی یا محدودیت (اختیاری)<textarea name="injury" rows={2} maxLength={500} /></label><button className="primary" disabled={busy}>افزودن شاگرد</button></ActionForm>;
      break;
    case 'plan':
      title = state.ai ? 'پیش‌نویس برنامهٔ تمرینی' : 'ساخت برنامهٔ جدید';
      body = <PlanForm workspace={workspace} today={today} studentId={state.studentId} ai={state.ai} submit={submit} busy={busy} />;
      break;
    case 'review': {
      const review = workspace.reviews.find(item => item.id === state.id);
      title = 'بازبینی ویدیوی تمرین';
      body = review ? <ReviewDetails workspace={workspace} review={review} coach={coach} submit={submit} busy={busy} /> : <Empty>ویدیو پیدا نشد.</Empty>;
      break;
    }
    case 'tutorial': {
      const movement = workspace.movements.find(item => item.id === state.id);
      title = movement?.name ?? 'آموزش حرکت';
      body = movement ? <Tutorial movement={movement} coach={coach} submit={submit} busy={busy} /> : <Empty>حرکت پیدا نشد.</Empty>;
      break;
    }
    case 'upload':
      title = 'ارسال ویدیو برای مربی';
      body = <ActionForm handler={uploadReview} submit={submit}><input type="hidden" name="sessionId" value={state.sessionId} /><input type="hidden" name="entryId" value={state.entryId} /><label>فایل ویدیو<input type="file" name="video" required accept="video/mp4,video/webm" /></label><p className="note">MP4 یا WebM، حداکثر ۵۰ مگابایت</p><button className="primary" disabled={busy}><Video size={17} />ارسال ویدیو</button></ActionForm>;
      break;
  }
  return <Modal title={title} onClose={close}>{body}{(notice.error || notice.ok) && <p role="status" className={`notice ${notice.error ? 'error' : ''}`}>{notice.error || notice.ok}</p>}</Modal>;
}