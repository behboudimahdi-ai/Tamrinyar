import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
const shared = globalThis as typeof globalThis & { trainingDb?: PrismaClient };
export function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('اتصال به پایگاه داده تنظیم نشده است.');
  return (shared.trainingDb ??= new PrismaClient({ adapter: new PrismaPg({ connectionString }) }));
}
export function localDemo() {
  return (
    !process.env.DATABASE_URL &&
    (process.env.NODE_ENV !== 'production' || process.env.TAMRINYAR_DEMO_MODE === 'true')
  );
}
