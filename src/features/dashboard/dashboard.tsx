'use client';

import { Activity, ArrowLeft, Bell, BookOpen, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, ClipboardList, CreditCard, Dumbbell, LayoutDashboard, Menu, Plus, Search, Send, Sparkles, UserRound, Users, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Avatar, Back, Empty, Section } from '@/components/ui';
import { askAssistant, setCompletion, type Result } from '../training/actions';
import { counts, dateLabel, fa, isBehind, offsetDate, weekStart, weekdays, type Review, type Session, type Workspace } from '../training/model';
import { TrainingDialog, type DialogState } from './dialogs';
import { Overview, Progress, ReviewList, StudentTable, type Screen } from './overview';

const coachLinks = [
  { id: 'overview', label: 'داشبورد', icon: LayoutDashboard },
  { id: 'students', label: 'شاگردان', icon: Users },
  { id: 'plans', label: 'برنامه‌های تمرینی', icon: ClipboardList },
  { id: 'reviews', label: 'بازبینی ویدیو', icon: Video },
  { id: 'library', label: 'کتابخانه حرکات', icon: BookOpen },
  { id: 'assistant', label: 'دستیار هوشمند', icon: Sparkles },
  { id: 'subscription', label: 'اشتراک مربی', icon: CreditCard },
] as const;
const studentLinks = [
  { id: 'schedule', label: 'برنامهٔ من', icon: CalendarDays },
  { id: 'reviews', label: 'ویدیو و بازخورد', icon: Video },
  { id: 'library', label: 'کتابخانه حرکات', icon: BookOpen },
  { id: 'assistant', label: 'دستیار هوشمند', icon: Sparkles },
] as const;

export function Dashboard({ workspace, today, assistantConnected }: { workspace: Workspace; today: string; assistantConnected: boolean }) {
  const router = useRouter();
  const [coach, setCoach] = useState(true);
  const [screen, setScreen] = useState<Screen>('overview');
  const [active, setActive] = useState(workspace.students[0]?.id ?? '');
  const [studentDetail, setStudentDetail] = useState('');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [query, setQuery] = useState('');
  const [reviewFilter, setReviewFilter] = useState(false);
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState<Result>({});
  const [busy, startTransition] = useTransition();
  const [week, setWeek] = useState(0);
  const [chat, setChat] = useState<{ question: string; reply: string }[]>([]);
  const student = workspace.students.find(item => item.id === active);
  const selected = workspace.students.find(item => item.id === studentDetail);
  const links = coach ? coachLinks : studentLinks;
  const visibleSessions = coach ? workspace.sessions : workspace.sessions.filter(item => item.studentId === active);
  const visibleReviews = coach ? workspace.reviews : workspace.reviews.filter(item => visibleSessions.some(session => session.id === item.sessionId));
  const pending = workspace.reviews.filter(item => !item.feedback).length;
  const behind = workspace.students.filter(person => isBehind(workspace.sessions.filter(session => session.studentId === person.id && session.date >= offsetDate(today, -7)), today));
  const incompleteToday = visibleSessions.filter(session => session.date === today).reduce((n, session) => n + session.entries.filter(entry => !entry.done).length, 0);

  function go(next: Screen) {
    setScreen(next);
    setMenu(false);
    setStudentDetail('');
    setQuery('');
    setNotice({});
    setReviewFilter(false);
  }
  function open(state: DialogState) { setNotice({}); setDialog(state); }
  function close() { setNotice({}); setDialog(null); }
  function openStudent(id: string) { go('students'); setStudentDetail(id); }
  function openReview(review: Review) { open({ kind: 'review', id: review.id }); }
  function submit(task: () => Promise<Result>, closeOnSuccess = false) {
    if (busy) return;
    setNotice({});
    startTransition(async () => {
      try {
        const result = await task();
        if (!result.error && closeOnSuccess) setDialog(null);
        setNotice(result);
        if (!result.error) router.refresh();
      } catch {
        setNotice({ error: 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.' });
      }
    });
  }

  function sessionCards(sessions: Session[]) {
    if (!sessions.length) return <Empty>جلسه‌ای در این بازه ثبت نشده است.</Empty>;
    return <div className="session-list">{[...sessions].sort((a, b) => a.date.localeCompare(b.date)).map(session => {
      const progress = counts([session]);
      return <article className="session-card" key={session.id}>
        <div className="session-head"><div><h3>{session.title}</h3><p>{dateLabel(session.date)}{coach && ' · ' + workspace.students.find(item => item.id === session.studentId)?.name}</p></div><Progress percent={progress.percent} /></div>
        {session.entries.map(entry => {
          const movement = workspace.movements.find(item => item.id === entry.movementId);
          return <div className="entry-row" key={entry.id}>
            {coach ? <span className={`status ${entry.done ? 'good' : ''}`}>{entry.done ? 'انجام‌شده' : 'انجام‌نشده'}</span> : <input className="check" aria-label={'ثبت ' + movement?.name} type="checkbox" disabled={busy} checked={entry.done} onChange={event => { const done = event.target.checked; submit(() => setCompletion(session.id, entry.id, done)); }} />}
            <span><strong>{movement?.name}</strong><small>{fa(entry.sets)} ست × {fa(entry.reps)} تکرار</small></span>
            {movement && <button className="icon-button compact" onClick={() => open({ kind: 'tutorial', id: movement.id })} aria-label={'آموزش ' + movement.name}><BookOpen size={18} /></button>}
            {!coach && <button className="icon-button compact" onClick={() => open({ kind: 'upload', sessionId: session.id, entryId: entry.id })} aria-label={'ارسال ویدیو ' + movement?.name}><Video size={18} /></button>}
          </div>;
        })}
      </article>;
    })}</div>;
  }

  return <div className="app-shell">
    {menu && <button className="mobile-overlay" onClick={() => setMenu(false)} aria-label="بستن منو" />}
    <aside className={`sidebar ${menu ? 'is-open' : ''}`}>
      <button className="brand" onClick={() => go(coach ? 'overview' : 'schedule')}><span><Dumbbell size={25} strokeWidth={2.5} /></span><div><strong>تمرین‌یار</strong><small>مدیریت تمرین باشگاه</small></div></button>
      <div className="nav-title">فضای کار</div>
      <nav aria-label="منوی اصلی">{links.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-link ${screen === id ? 'active' : ''}`} aria-current={screen === id ? 'page' : undefined} onClick={() => go(id)}><Icon size={19} /><span>{label}</span>{coach && id === 'reviews' && pending > 0 && <small>{fa(pending)}</small>}</button>)}</nav>
      <div className="sidebar-foot">
        {coach && <button className="side-plan" onClick={() => go('subscription')}><span className="side-plan-icon"><Sparkles size={17} /></span><span><strong>اشتراک مربی</strong><small>نسخهٔ آزمایشی</small></span><ChevronLeft size={16} /></button>}
        <div className="identity"><Avatar student={coach ? undefined : student} /><div><strong>{coach ? 'مربی باشگاه' : student?.name}</strong><small>{coach ? 'حساب مربی' : 'حساب رایگان شاگرد'}</small></div></div>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <div className="breadcrumb"><button className="icon-button menu-toggle" aria-label="باز کردن منو" onClick={() => setMenu(!menu)}><Menu size={22} /></button><span>فضای {coach ? 'مربی' : 'شاگرد'}</span><ChevronLeft size={15} /><strong>{links.find(item => item.id === screen)?.label}</strong></div>
        <div className="top-actions">
          {coach && <button className="icon-button top-bell" aria-label="اعلان ویدیوهای در انتظار" onClick={() => { go('reviews'); setReviewFilter(true); }}><Bell size={19} />{pending > 0 && <i />}</button>}
          {!coach && <select className="student-switch" aria-label="انتخاب شاگرد نمونه" value={active} onChange={event => { setActive(event.target.value); setChat([]); setNotice({}); }} >{workspace.students.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select>}
          <button className="role-switch" onClick={() => { setCoach(!coach); setChat([]); setWeek(0); go(coach ? 'schedule' : 'overview'); }}><UserRound size={16} /><span>{coach ? 'نمای شاگرد' : 'نمای مربی'}</span><ChevronDown size={15} /></button>
        </div>
      </header>
      <main>
        {!dialog && (notice.ok || notice.error) && <p role="status" className={`notice main-notice ${notice.error ? 'error' : ''}`}>{notice.error || notice.ok}</p>}
        {screen === 'overview' && <Overview workspace={workspace} today={today} go={go} newPlan={() => open({ kind: 'plan' })} openStudent={openStudent} openReview={openReview} />}
        {screen === 'students' && (selected ? <>
          <div className="page-title"><div><Back onClick={() => setStudentDetail('')}>شاگردان</Back><h1>{selected.name}</h1><p>{selected.level} · {selected.goal} · {fa(selected.age)} سال · {fa(selected.weight)} کیلوگرم</p></div><button className="primary" onClick={() => open({ kind: 'plan', studentId: selected.id })}><Plus size={18} />جلسهٔ جدید</button></div>
          {selected.injury && <p className="notice">محدودیت ثبت‌شده · {selected.injury}</p>}
          <Section title="جلسات و ثبت حرکت‌ها">{sessionCards(workspace.sessions.filter(session => session.studentId === selected.id))}</Section>
        </> : <>
          <div className="page-title"><div><h1>شاگردان</h1><p>پرونده‌ها و وضعیت اجرای برنامهٔ هر شاگرد</p></div><button className="primary" onClick={() => open({ kind: 'student' })}><Plus size={18} />افزودن شاگرد</button></div>
          <Section title="فهرست شاگردان" action={<label className="search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="جست‌وجوی شاگرد" aria-label="جست‌وجوی شاگرد" /></label>}>
            <StudentTable workspace={{ ...workspace, students: workspace.students.filter(item => item.name.includes(query.trim())) }} today={today} openStudent={openStudent} />
          </Section>
        </>)}
        {(screen === 'plans' || screen === 'schedule') && (() => {
          const start = offsetDate(weekStart(today), week * 7);
          const end = offsetDate(start, 6);
          const sessions = visibleSessions.filter(session => session.date >= start && session.date <= end);
          return <>
            <div className="page-title"><div><h1>{coach ? 'برنامه‌های تمرینی' : 'برنامهٔ تمرینی من'}</h1><p>{coach ? 'جلسات شاگردان بر اساس هفتهٔ تمرین' : 'پس از انجام هر حرکت، آن را در برنامه ثبت کن.'}</p></div>{coach && <button className="primary" onClick={() => open({ kind: 'plan' })}><Plus size={18} />ساخت برنامه</button>}</div>
            {!coach && incompleteToday > 0 && <p className="notice"><Bell size={17} />برای امروز {fa(incompleteToday)} حرکت انجام‌نشده داری.</p>}
            <Section title="تقویم هفتگی" detail={dateLabel(start) + ' تا ' + dateLabel(end)} action={<div className="week-controls"><button className="icon-button compact" aria-label="هفتهٔ قبل" onClick={() => setWeek(week - 1)}><ChevronRight size={18} /></button><button className="text-button" onClick={() => setWeek(0)}>این هفته</button><button className="icon-button compact" aria-label="هفتهٔ بعد" onClick={() => setWeek(week + 1)}><ChevronLeft size={18} /></button></div>}>
              <div className="week-grid">{weekdays.map((day, index) => {
                const date = offsetDate(start, index);
                const number = sessions.filter(session => session.date === date).length;
                return <div className={date === today ? 'today' : ''} key={day}><strong>{day}</strong><small>{dateLabel(date)}</small><span>{number ? fa(number) + ' جلسه' : '—'}</span></div>;
              })}</div>{sessionCards(sessions)}
            </Section>
          </>;
        })()}
        {screen === 'reviews' && <>
          <div className="page-title"><div><h1>{coach ? 'بازبینی ویدیو' : 'ویدیو و بازخورد'}</h1><p>{coach ? 'ویدیوی اجرای حرکت را ببین و بازخورد بده.' : 'بازخورد مربی را برای ویدیوهای ارسال‌شده بخوان.'}</p></div></div>
          <Section title="ویدیوهای تمرین" action={coach && <label className="filter"><input type="checkbox" checked={reviewFilter} onChange={event => setReviewFilter(event.target.checked)} />در انتظار بازبینی</label>}>
            <ReviewList workspace={workspace} reviews={visibleReviews.filter(item => !reviewFilter || !item.feedback)} openReview={openReview} />
          </Section>
        </>}
        {screen === 'library' && <>
          <div className="page-title"><div><h1>کتابخانهٔ حرکات</h1><p>آموزش فارسی و نکته‌های اجرای هر حرکت</p></div><label className="search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="جست‌وجوی حرکت" aria-label="جست‌وجوی حرکت" /></label></div>
          <div className="library-grid">{workspace.movements.filter(item => (item.name + item.group).includes(query.trim())).map(movement => <button className="panel movement-card" key={movement.id} onClick={() => open({ kind: 'tutorial', id: movement.id })}><span className="stat-icon peach"><Dumbbell size={22} /></span><strong>{movement.name}</strong><small>{movement.group}</small><span className="text-button">{movement.video ? 'تماشای ویدیو' : coach ? 'آموزش و افزودن ویدیو' : 'راهنمای اجرا'}<ArrowLeft size={16} /></span></button>)}</div>
          {!workspace.movements.some(item => (item.name + item.group).includes(query.trim())) && <Empty>حرکتی پیدا نشد.</Empty>}
        </>}
        {screen === 'assistant' && <>
          <div className="page-title"><div><h1>دستیار هوشمند</h1><p>{assistantConnected ? 'متصل به سرویس هوش مصنوعی' : 'حالت محلی · الگوی تمرین و پاسخ‌های آماده'}</p></div>{coach && <button className="primary" onClick={() => open({ kind: 'plan', ai: true })}><Sparkles size={18} />گرفتن پیش‌نویس</button>}</div>
          {coach ? <Section title="شاگردان نیازمند پیگیری" detail="جلسات ناقص در هفت روز گذشته">
            {behind.length ? behind.map(person => <button className="review-row" key={person.id} onClick={() => openStudent(person.id)}><Avatar student={person} /><span className="review-info"><strong>{person.name}</strong><small>جلسهٔ انجام‌نشده دارد</small></span><CircleAlert size={19} /></button>) : <Empty>جلسهٔ عقب‌افتاده‌ای در این بازه وجود ندارد.</Empty>}
          </Section> : <Section title="گفت‌وگو دربارهٔ تمرین">
            {incompleteToday > 0 && <p className="notice"><Bell size={17} />امروز {fa(incompleteToday)} حرکت در برنامه‌ات باقی مانده است.</p>}
            {chat.map((message, index) => <div className="chat-pair" key={index}><p className="bubble mine">{message.question}</p><p className="bubble">{message.reply}</p></div>)}
            <form className="chat-form" onSubmit={event => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              data.set('studentId', active);
              submit(async () => {
                const result = await askAssistant(data);
                if (result.reply) {
                  const reply = result.reply;
                  setChat(previous => [...previous, { question: String(data.get('question')), reply }]);
                  form.reset();
                }
                return result;
              });
            }}><input name="question" maxLength={500} placeholder="سؤالت را دربارهٔ تمرین بنویس…" aria-label="سؤال تمرینی" required /><button className="primary" disabled={busy}><Send size={18} />ارسال</button></form>
          </Section>}
        </>}
        {screen === 'subscription' && <>
          <div className="page-title"><div><h1>اشتراک مربی</h1><p>اشتراک ماهانه برای مربی، دسترسی رایگان برای شاگرد</p></div></div>
          <Section title="نسخهٔ آزمایشی"><p className="note">درگاه پرداخت ریالی هنوز تنظیم نشده است.</p></Section>
        </>}
        <footer className="footer"><Activity size={15} /> تمرین‌یار <span>·</span> فضای {coach ? 'مربی' : 'شاگرد'}</footer>
      </main>
    </div>
    {dialog && <TrainingDialog state={dialog} workspace={workspace} today={today} coach={coach} busy={busy} notice={notice} submit={submit} close={close} />}
  </div>;
}