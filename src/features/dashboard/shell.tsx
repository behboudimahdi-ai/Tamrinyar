'use client';
import { useState, type ReactNode } from 'react';
import {
  Activity,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  Menu,
  Sparkles,
  UserRound,
  Users,
  Video,
} from 'lucide-react';
import { Avatar } from '@/components/ui';
import { fa, type Student } from '../training/model';
import type { Screen } from './overview';
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

export function DashboardShell({
  coach,
  student,
  screen,
  go,
  pending = 0,
  openPending,
  onSwitch,
  onStudent,
  students = [],
  active = '',
  children,
}: {
  coach: boolean;
  student?: Student;
  screen: Screen;
  go: (s: Screen) => void;
  pending?: number;
  openPending?: () => void;
  onSwitch?: () => void;
  onStudent?: (id: string) => void;
  students?: Student[];
  active?: string;
  children: ReactNode;
}) {
  const [menu, setMenu] = useState(false),
    links = coach ? coachLinks : studentLinks;
  function navigate(screen: Screen) {
    setMenu(false);
    go(screen);
  }
  return (
    <div className="app-shell">
      {menu && <button className="mobile-overlay" onClick={() => setMenu(false)} aria-label="بستن منو" />}
      <aside className={`sidebar ${menu ? 'is-open' : ''}`}>
        <button className="brand" onClick={() => navigate(coach ? 'overview' : 'schedule')}>
          <span>
            <Dumbbell size={25} strokeWidth={2.5} />
          </span>
          <div>
            <strong>تمرین‌یار</strong>
            <small>مدیریت تمرین باشگاه</small>
          </div>
        </button>
        <div className="nav-title">فضای کار</div>
        <nav aria-label="منوی اصلی">
          {links.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-link ${screen === id ? 'active' : ''}`}
              aria-current={screen === id ? 'page' : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {coach && id === 'reviews' && pending > 0 && <small>{fa(pending)}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          {coach && (
            <button className="side-plan" onClick={() => navigate('subscription')}>
              <span className="side-plan-icon">
                <Sparkles size={17} />
              </span>
              <span>
                <strong>اشتراک مربی</strong>
                <small>نسخهٔ آزمایشی</small>
              </span>
              <ChevronLeft size={16} />
            </button>
          )}
          <div className="identity">
            <Avatar student={coach ? undefined : student} />
            <div>
              <strong>{coach ? 'مربی باشگاه' : student?.name}</strong>
              <small>{coach ? 'حساب مربی' : 'حساب رایگان شاگرد'}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button menu-toggle"
              aria-label="باز کردن منو"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={22} />
            </button>
            <span>فضای {coach ? 'مربی' : 'شاگرد'}</span>
            <ChevronLeft size={15} />
            <strong>{links.find((item) => item.id === screen)?.label}</strong>
          </div>
          <div className="top-actions">
            {coach && (
              <button
                className="icon-button top-bell"
                aria-label="اعلان ویدیوهای در انتظار"
                onClick={() => {
                  navigate('reviews');
                  openPending?.();
                }}
              >
                <Bell size={19} />
                {pending > 0 && <i />}
              </button>
            )}
            {onStudent && !coach && (
              <select
                className="student-switch"
                aria-label="انتخاب شاگرد نمونه"
                value={active}
                onChange={(event) => onStudent(event.target.value)}
              >
                {students.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            )}
            {!onSwitch ? (
              <button
                className="role-switch"
                onClick={async () => {
                  const data = new FormData();
                  data.set('action', 'logout');
                  const result = await fetch('/api/session', { method: 'POST', body: data });
                  if (result.ok) location.assign('/login');
                }}
              >
                <UserRound size={16} />
                خروج
              </button>
            ) : (
              <button className="role-switch" onClick={onSwitch}>
                <UserRound size={16} />
                <span>{coach ? 'نمای شاگرد' : 'نمای مربی'}</span>
                <ChevronDown size={15} />
              </button>
            )}
          </div>
        </header>
        <main>
          {children}
          <footer className="footer">
            <Activity size={15} /> تمرین‌یار <span>·</span> فضای {coach ? 'مربی' : 'شاگرد'}
          </footer>
        </main>
      </div>
    </div>
  );
}
