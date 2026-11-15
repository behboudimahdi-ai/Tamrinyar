'use client';

import { ArrowLeft, ChevronLeft, X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { Student } from '@/features/training/model';

export function Avatar({ student, size = '' }: { student?: Student; size?: string }) {
  return <span className={`avatar ${student?.color ?? 'peach'} ${size}`} aria-hidden="true">{student?.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('') ?? 'م'}</span>;
}

export function Section({ title, detail, action, children, className = '' }: { title: string; detail?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="section-head"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>{children}</section>;
}

export function ViewAll({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="text-button" onClick={onClick}>{children}<ChevronLeft size={15} /></button>;
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-body">
      <header><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="بستن" onClick={onClose}><X size={20} /></button></header>
      {children}
    </div>
  </dialog>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Back({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button className="text-button" onClick={onClick}><ArrowLeft size={15} />{children}</button>;
}