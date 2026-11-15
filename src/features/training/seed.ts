import { offsetDate, type Workspace } from './model';

export function seed(today: string): Workspace {
  const students = [
    { name: 'آرمان رضایی', age: 27, weight: 78, level: 'متوسط', goal: 'عضله‌سازی', color: 'violet' },
    { name: 'سارا محمدی', age: 25, weight: 64, level: 'متوسط', goal: 'افزایش قدرت', color: 'sky' },
    { name: 'کیان احمدی', age: 22, weight: 73, level: 'مبتدی', goal: 'آمادگی عمومی', color: 'peach' },
    { name: 'نیلوفر کریمی', age: 29, weight: 68, level: 'متوسط', goal: 'کاهش وزن', color: 'mint' },
    { name: 'امیر حسینی', age: 30, weight: 86, level: 'پیشرفته', goal: 'عضله‌سازی', color: 'rose' },
  ].map((student, index) => ({ ...student, id: 'student-' + index, injury: '' }));
  const movements = [
    { id: 'squat', name: 'اسکوات هالتر', group: 'پایین‌تنه', cue: 'کف پا را روی زمین نگه دار و زانوها را هم‌جهت پنجه‌ها حرکت بده.' },
    { id: 'bench', name: 'پرس سینه دمبل', group: 'بالاتنه', cue: 'کتف‌ها را روی نیمکت ثابت نگه دار و دمبل‌ها را با کنترل پایین بیاور.' },
    { id: 'pull', name: 'لت سیم‌کش', group: 'بالاتنه', cue: 'آرنج‌ها را به سمت پایین بکش و از تاب‌دادن تنه خودداری کن.' },
    { id: 'lunge', name: 'لانج دمبل', group: 'پایین‌تنه', cue: 'در طول حرکت تنه را ثابت نگه دار و قدم را کنترل کن.' },
    { id: 'plank', name: 'پلانک', group: 'میان‌تنه', cue: 'بدن را در یک خط نگه دار و نفس کشیدن را ادامه بده.' },
    { id: 'row', name: 'قایقی سیم‌کش', group: 'بالاتنه', cue: 'سینه را بالا نگه دار و حرکت را با عقب‌کشیدن آرنج‌ها انجام بده.' },
  ];
  const sessions = students.flatMap((student, index) => [-4, -2, 0, 2].map((offset, day) => {
    const id = `session-${index}-${day}`;
    return {
      id, studentId: student.id, title: ['بالاتنه', 'پایین‌تنه', 'تمرین تمام بدن', 'قدرت و میان‌تنه'][day],
      date: offsetDate(today, offset),
      entries: [0, 1, 2].map((position) => ({
        id: `${id}-${position}`,
        movementId: movements[(day * 2 + position) % movements.length].id,
        sets: 3, reps: position === 0 ? 8 : 12,
        done: day < 2 ? (index !== 2 && (index !== 4 || position === 0)) : day === 2 && index === 0 && position < 2,
      })),
    };
  }));
  return {
    students, movements, sessions,
    reviews: [
      { id: 'sample-1', sessionId: 'session-0-1', entryId: 'session-0-1-0', date: today, feedback: '' },
      { id: 'sample-2', sessionId: 'session-1-0', entryId: 'session-1-0-1', date: offsetDate(today, -1), feedback: '' },
      { id: 'sample-3', sessionId: 'session-3-1', entryId: 'session-3-1-1', date: offsetDate(today, -2), feedback: 'سرعت بخش برگشت حرکت را کمتر کن.' },
    ],
  };
}