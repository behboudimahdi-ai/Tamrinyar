import { connection } from 'next/server';
import { Dashboard } from '@/features/dashboard/dashboard';
import { todayKey } from '@/features/training/model';
import { readWorkspace } from '@/features/training/store';

export default async function Home() {
  await connection();
  return <Dashboard workspace={await readWorkspace()} today={todayKey()} assistantConnected={Boolean(process.env.AI_URL && process.env.AI_MODEL && process.env.AI_WORKSPACE_CONSENT === 'true')} />;
}