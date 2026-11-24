'use client';
export default function ProgramPageError({ reset }: { reset: () => void }) {
  return (
    <section className="panel wp-panel">
      <p role="alert">دریافت برنامه ممکن نشد. دسترسی و اتصال را بررسی کنید.</p>
      <button className="secondary" onClick={reset}>
        تلاش مجدد
      </button>
    </section>
  );
}
