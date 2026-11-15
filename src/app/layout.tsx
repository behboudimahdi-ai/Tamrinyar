import type { Metadata } from 'next';
import '@fontsource-variable/vazirmatn';
import './globals.css';

export const metadata: Metadata = {
  title: 'تمرین‌یار | پنل مربی',
  description: 'برنامه‌ریزی تمرین و پیگیری شاگردان باشگاه',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}