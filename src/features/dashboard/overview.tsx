'use client';

import { Activity, ArrowDownLeft, ArrowLeft, CalendarDays, CircleAlert, ClipboardCheck, Play, Plus, Sparkles, Users, Video } from 'lucide-react';
import { Avatar, Empty, Section, ViewAll } from '@/components/ui';
import { counts, dateLabel, fa, getReview, isBehind, offsetDate, weekdays, weekStart, type Review, type Workspace } from '../training/model';

export type Screen = 'overview' | 'students' | 'plans' | 'reviews' | 'library' | 'assistant' | 'subscription' | 'schedule';
type Props = {
  workspace: Workspace; today: string;
  go: (screen: Screen) => void; newPlan: () => void;
  openStudent: (id: string) => void; openReview: (review: Review) => void;
};

export function Progress({ percent }: { percent: number }) {
  return <div className="progress-wrap"><div className="progress-track" role="progressbar" aria-label="پیشرفت" aria-valuenow={percent}><span style={{ width: percent + '%' }} /></div><span>{fa(percent)}٪</span></div>;
}

export function StudentTable({ workspace, today, openStudent }: Pick<Props, 'workspace' | 'today' | 'openStudent'>) {
  if (!workspace.students.length) return <Empty>شاگردی با این مشخصات پیدا نشد.</Empty>;
  return <div className="table-scroll"><table><thead><tr><th>شاگرد</th><th>هدف تمرینی</th><th>پیشرفت تمرین</th><th>وضعیت</th><th><span className="sr-only">جزئیات</span></th></tr></thead>
    <tbody>{workspace.students.map(student => {
      const sessions = workspace.sessions.filter(item => item.studentId === student.id && item.date >= weekStart(today) && item.date <= today);
      const behind = isBehind(sessions, today);
      const progress = counts(sessions);
      return <tr key={student.id}><td><button className="person" onClick={() => openStudent(student.id)}><Avatar student={student} /><span><strong>{student.name}</strong><small>{student.level}</small></span></button></td><td>{student.goal}</td><td><Progress percent={progress.percent} /></td><td><span className={`status ${behind ? 'warning' : progress.total ? 'good' : ''}`}>{behind ? 'عقب‌افتاده' : progress.total ? 'در مسیر' : 'بدون جلسه'}</span></td><td><button className="icon-button compact" onClick={() => openStudent(student.id)} aria-label={'جزئیات ' + student.name}><ArrowDownLeft size={16} /></button></td></tr>;
    })}</tbody>
  </table></div>;
}

export function ReviewList({ workspace, reviews, openReview }: { workspace: Workspace; reviews: Review[]; openReview: Props['openReview'] }) {
  if (!reviews.length) return <Empty>ویدیویی برای بررسی وجود ندارد.</Empty>;
  return <div className="review-list">{reviews.map(review => {
    const { student, movement } = getReview(workspace, review);
    return <button className="review-row" onClick={() => openReview(review)} key={review.id}>
      <span className={`review-thumb ${student?.color ?? ''}`}><Play size={17} fill="currentColor" /></span>
      <span className="review-info"><strong>{student?.name}</strong><small>{movement?.name} · {dateLabel(review.date)}</small></span>
      <span className={`status ${review.feedback ? 'good' : 'warning'}`}>{review.feedback ? 'بررسی‌شده' : 'در انتظار'}</span>
    </button>;
  })}</div>;
}

function ActivityChart({ workspace, today }: Pick<Props, 'workspace' | 'today'>) {
  const days = Array.from({ length: 7 }, (_, index) => offsetDate(today, index - 6));
  const rows = days.map(date => ({ date, ...counts(workspace.sessions.filter(item => item.date === date)) }));
  const max = Math.max(4, ...rows.map(row => row.total));
  return <div className="chart">
    <div className="chart-labels">{[max, Math.round(max / 2), 0].map(n => <span key={n}>{fa(n)}</span>)}</div>
    <div className="plot">
      <div className="gridlines"><span/><span/><span/></div>
      {rows.map(({ date, total, done }) => <div className="chart-day" key={date}>
        <div className="bar-pair" aria-label={`${dateLabel(date)}، ${fa(done)} از ${fa(total)} حرکت`} title={`${fa(done)} از ${fa(total)} حرکت`}><span className="bar done" style={{ height: done ? (done / max * 100) + '%' : '3px' }} /><span className="bar total" style={{ height: total ? (total / max * 100) + '%' : '3px' }} /></div>
        <span className={date === today ? 'current-day' : ''}>{weekdays[(new Date(date + 'T12:00:00Z').getUTCDay() + 1) % 7]}</span>
      </div>)}
    </div>
  </div>;
}

export function Overview({ workspace, today, go, newPlan, openStudent, openReview }: Props) {
  const start = weekStart(today);
  const week = workspace.sessions.filter(session => session.date >= start && session.date <= today);
  const completed = week.filter(session => session.entries.every(entry => entry.done)).length;
  const pending = workspace.reviews.filter(item => !item.feedback).length;
  const behind = workspace.students.filter(student => isBehind(week.filter(session => session.studentId === student.id), today));
  const stats = [
    { label: 'شاگردان من', value: workspace.students.length, note: 'پرونده‌های ثبت‌شده', icon: Users, color: 'peach', screen: 'students' },
    { label: 'جلسات کامل‌شده', value: completed, note: 'از ابتدای این هفته', icon: ClipboardCheck, color: 'mint', screen: 'plans' },
    { label: 'نیاز به پیگیری', value: behind.length, note: 'شاگردان عقب‌افتاده', icon: CircleAlert, color: 'rose', screen: 'assistant' },
    { label: 'ویدیوهای در انتظار', value: pending, note: 'آمادهٔ بررسی مربی', icon: Video, color: 'violet', screen: 'reviews' },
  ] as const;
  return <>
    <div className="page-title"><div><h1>داشبورد مربی</h1><p>وضعیت تمرین و پیشرفت شاگردانت در یک نگاه</p></div><span className="date-chip"><CalendarDays size={16} />{new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full', timeZone: 'Asia/Tehran' }).format(new Date(today + 'T12:00:00Z'))}</span></div>
    <section className="hero">
      <div className="hero-content"><span className="hero-tag"><Activity size={14} /> پنل مربی</span><h2>وقتِ یک تمرین بهتره<span>.</span></h2><p>برای شاگردانت برنامه بنویس، اجرای تمرین‌ها را ببین<br className="desktop-break" /> و هر هفته کنارشان باش.</p><button className="primary" onClick={newPlan}><Plus size={18} />ساخت برنامهٔ جدید</button></div>
    </section>
    <div className="stats">{stats.map(({ label, value, note, icon: Icon, color, screen }) => <button className="stat panel" key={label} onClick={() => go(screen)}><span className={`stat-icon ${color}`}><Icon size={21} /></span><span className="stat-label">{label}</span><strong>{fa(value)}</strong><span className="stat-note">{note}</span></button>)}</div>
    <div className="overview-grid">
      <Section title="فعالیت تمرینی" detail="حرکت‌های ثبت‌شده در ۷ روز گذشته" action={<div className="legend"><span><i />انجام‌شده</span><span><i />برنامه‌ریزی‌شده</span></div>}>
        <ActivityChart workspace={workspace} today={today} />
      </Section>
      <section className="assistant-card"><span className="assistant-icon"><Sparkles size={21} /></span><h2>دستیار هوشمند</h2>
        <p>{behind.length ? `${fa(behind.length)} شاگرد تمرین عقب‌افتاده دارند. وضعیتشان را بررسی کن.` : 'برای جلسهٔ بعدی شاگردت یک پیش‌نویس بگیر.'}</p>
        {behind.length > 0 && <div className="assistant-alert"><CircleAlert size={16} /><span>{behind.map(student => student.name).join('، ')}</span></div>}
        <button onClick={() => go('assistant')}>رفتن به دستیار<ArrowLeft size={17} /></button>
      </section>
      <Section title="وضعیت شاگردان" detail="پیشرفت از ابتدای هفته" action={<ViewAll onClick={() => go('students')}>همهٔ شاگردان</ViewAll>}>
        <StudentTable workspace={{ ...workspace, students: workspace.students.slice(0, 4) }} today={today} openStudent={openStudent} />
      </Section>
      <Section title="ویدیوهای اخیر" detail="بازبینی فرم اجرای شاگردان" action={<ViewAll onClick={() => go('reviews')}>مشاهدهٔ همه</ViewAll>}>
        <ReviewList workspace={workspace} reviews={workspace.reviews.slice(0, 3)} openReview={openReview} />
      </Section>
    </div>
  </>;
}