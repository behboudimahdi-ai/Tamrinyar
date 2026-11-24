'use client';

import { ArrowLeft, Bell, BookOpen, CircleAlert, Dumbbell, Plus, Search, Send, Sparkles, Video } from 'lucide-react';
import {DashboardShell} from './shell';
import Link from 'next/link';
import type {Actor} from '../programs/access';
import type {AssignmentInfo} from '../programs/athlete';
import {AthletePrograms,PersonalCalendar,SessionExtras} from '../programs/athlete-panel';
import { useRouter } from 'next/navigation';
import { useOptimistic, useState, useTransition } from 'react';
import { Avatar, Back, Empty, Section } from '@/components/ui';
import { askAssistant, setCompletion, type Result } from '../training/actions';
import { counts, dateLabel, fa, isBehind, offsetDate, type Review, type Session, type Workspace } from '../training/model';
import { TrainingDialog, type DialogState } from './dialogs';
import { Overview, Progress, ReviewList, StudentTable, type Screen } from './overview';

export function Dashboard({workspace,today,assistantConnected,account,initialView,initialStudent,programs=[]}: {
  workspace:Workspace; today:string; assistantConnected:boolean; account?: Actor; initialView?:Screen;
  initialStudent?:string; programs?:AssignmentInfo[];
}) {
  const router = useRouter();
  const [coach, setCoach] = useState(account?.role !== 'ATHLETE');
  const [screen, setScreen] = useState<Screen>(initialView ?? 'overview');
  const [active, setActive] = useState(account?.athleteId ?? workspace.students[0]?.id ?? '');
  const [studentDetail, setStudentDetail] = useState(initialStudent ?? '');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [query, setQuery] = useState('');
  const [reviewFilter, setReviewFilter] = useState(false);
  const [notice, setNotice] = useState<Result>({});
  const [busy, startTransition] = useTransition();
  const [pendingChecks, markCheck] = useOptimistic<Record<string,boolean>,{id:string;done:boolean}>({},(state,change)=>({...state,[change.id]:change.done}));
  const [chat, setChat] = useState<{ question: string; reply: string }[]>([]);
  const student = workspace.students.find(item => item.id === active);
  const selected = workspace.students.find(item => item.id === studentDetail);
  const visibleSessions = coach ? workspace.sessions : workspace.sessions.filter(item => item.studentId === active);
  const visibleReviews = coach ? workspace.reviews : workspace.reviews.filter(item => visibleSessions.some(session => session.id === item.sessionId));
  const pending = workspace.reviews.filter(item => !item.feedback).length;
  const behind = workspace.students.filter(person => isBehind(workspace.sessions.filter(session => session.studentId === person.id && session.date >= offsetDate(today, -7)), today));
  const incompleteToday = visibleSessions.filter(session => session.date === today).reduce((n, session) => n + session.entries.filter(entry => !entry.done).length, 0);

  function go(next: Screen) {
    if (next === 'plans') { router.push('/programs'); return; }
    if (account) { router.push('/?view='+next); return; }
    setScreen(next);
    setStudentDetail('');
    setQuery('');
    setNotice({});
    setReviewFilter(false);
  }
  function open(state: DialogState) { setNotice({}); setDialog(state); }
  function close() { setNotice({}); setDialog(null); }
  function openStudent(id: string) { if(account) {router.push('/?view=students&athlete='+encodeURIComponent(id));return;} go('students'); setStudentDetail(id); }
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
            {coach ? <span className={`status ${entry.done ? 'good' : ''}`}>{entry.done ? 'انجام‌شده' : 'انجام‌نشده'}</span> : <input className="check" aria-label={'ثبت ' + movement?.name} type="checkbox" disabled={busy} checked={pendingChecks[session.id+'/'+entry.id] ?? entry.done} onChange={event => { const done = event.target.checked; submit(() => {markCheck({id:session.id+'/'+entry.id,done});return setCompletion(session.id, entry.id, done);}); }} />}
            <span><strong>{movement?.name}</strong><small>{fa(entry.sets)} ست × {fa(entry.reps)} تکرار</small></span>
            {movement && <button className="icon-button compact" onClick={() => open({ kind: 'tutorial', id: movement.id })} aria-label={'آموزش ' + movement.name}><BookOpen size={18} /></button>}
            {!coach && <button className="icon-button compact" onClick={() => open({ kind: 'upload', sessionId: session.id, entryId: entry.id })} aria-label={'ارسال ویدیو ' + movement?.name}><Video size={18} /></button>}
          </div>;
        })}
        <SessionExtras session={session} coach={coach} bank={workspace.movements} today={today}/>
        {account && coach && <Link className="text-button" href={'/programs/builder?'+new URLSearchParams({athlete:session.studentId,session:session.id})}>ذخیره به‌عنوان الگو</Link>}
      </article>;
    })}</div>;
  }

  return <><DashboardShell coach={coach} student={student} screen={screen} go={go} pending={pending}
    openPending={()=>setReviewFilter(true)} active={active} students={workspace.students}
    onStudent={account?undefined:(id)=>{setActive(id);setChat([]);setNotice({});}}
    onSwitch={account?undefined:()=>{setCoach(!coach);setChat([]);go(coach?'schedule':'overview');}}>

        {!dialog && (notice.ok || notice.error) && <p role="status" className={`notice main-notice ${notice.error ? 'error' : ''}`}>{notice.error || notice.ok}</p>}
        {screen === 'overview' && <Overview workspace={workspace} today={today} go={go} newPlan={() => account ? router.push('/programs/builder') : open({ kind: 'plan' })} openStudent={openStudent} openReview={openReview} />}
        {screen === 'students' && (selected ? <>
          <div className="page-title"><div><Back onClick={() => account ? go('students') : setStudentDetail('')}>شاگردان</Back><h1>{selected.name}</h1><p>{selected.level} · {selected.goal} · {fa(selected.age)} سال · {fa(selected.weight)} کیلوگرم</p></div><button className="primary" onClick={() => open({ kind: 'plan', studentId: selected.id })}><Plus size={18} />جلسهٔ جدید</button></div>
          {selected.injury && <p className="notice">محدودیت ثبت‌شده · {selected.injury}</p>}
          {account && <AthletePrograms programs={programs} sessions={workspace.sessions} today={today} coach athleteId={selected.id}/>}
          <PersonalCalendar today={today} sessions={workspace.sessions.filter(s=>s.studentId===selected.id)} render={sessionCards}/>
          <Section title="سوابق تمرینی">{sessionCards(workspace.sessions.filter(s=>s.studentId===selected.id && s.date<=today))}</Section>
          <Section title="بازخورد مربی"><ReviewList workspace={workspace} reviews={workspace.reviews.filter(r=>workspace.sessions.some(s=>s.studentId===selected.id && s.id===r.sessionId))} openReview={openReview}/></Section>
        </> : <>
          <div className="page-title"><div><h1>شاگردان</h1><p>پرونده‌ها و وضعیت اجرای برنامهٔ هر شاگرد</p></div><button className="primary" onClick={() => open({ kind: 'student' })}><Plus size={18} />افزودن شاگرد</button></div>
          <Section title="فهرست شاگردان" action={<label className="search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="جست‌وجوی شاگرد" aria-label="جست‌وجوی شاگرد" /></label>}>
            <StudentTable workspace={{ ...workspace, students: workspace.students.filter(item => item.name.includes(query.trim())) }} today={today} openStudent={openStudent} />
          </Section>
        </>)}
        {screen === 'schedule' && !coach && <>
          <div className="page-title"><div><h1>برنامهٔ تمرینی من</h1><p>پس از انجام هر حرکت، آن را در برنامه ثبت کن.</p></div></div>
          {incompleteToday>0 && <p className="notice"><Bell size={17}/>برای امروز {fa(incompleteToday)} حرکت انجام‌نشده داری.</p>}
          {account && <AthletePrograms programs={programs} sessions={visibleSessions} today={today} coach={false} athleteId={active}/>}
          <PersonalCalendar today={today} sessions={visibleSessions} render={sessionCards}/>
        </>}
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
    </DashboardShell>
    {dialog && <TrainingDialog state={dialog} workspace={workspace} today={today} coach={coach} busy={busy} notice={notice} submit={submit} close={close} />}
  </>;
}
