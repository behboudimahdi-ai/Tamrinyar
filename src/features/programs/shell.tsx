'use client';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '../dashboard/shell';
export function ProgramShell({ children, pending }: { children: React.ReactNode; pending: number }) {
  const router = useRouter();
  return (
    <DashboardShell
      coach
      screen="plans"
      pending={pending}
      openPending={() => router.push('/?view=reviews&pending=1')}
      go={(view) => router.push(view === 'plans' ? '/programs' : '/?view=' + view)}
    >
      {children}
    </DashboardShell>
  );
}
