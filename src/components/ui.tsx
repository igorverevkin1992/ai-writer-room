import React, { useEffect, useRef, useState } from 'react';

/* ────────────────────────────  кнопки  ──────────────────────────── */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  size?: 'sm' | 'md';
};

export function Button({ variant = 'subtle', size = 'md', className = '', ...rest }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const sizes = { sm: 'text-xs px-2 py-1', md: 'text-sm px-3 py-1.5' }[size];
  const variants = {
    primary: 'bg-accent text-ink-900 hover:bg-accent/85',
    subtle: 'bg-ink-700 text-paper hover:bg-ink-600 border border-ink-600',
    ghost: 'text-muted hover:text-paper hover:bg-ink-700',
    danger: 'bg-bad/15 text-bad border border-bad/40 hover:bg-bad/25',
  }[variant];
  return <button className={`${base} ${sizes} ${variants} ${className}`} {...rest} />;
}

/* ────────────────────────────  поля  ──────────────────────────── */

export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <p className="text-[11px] text-muted mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

/** Инпут с локальным состоянием: пишет в базу по blur / Ctrl+Enter. */
export function TextInput({
  value,
  onCommit,
  placeholder,
  className = '',
  mono,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
  mono?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) setDraft(value);
  }, [value]);
  return (
    <input
      className={`field ${mono ? 'font-mono' : ''} ${className}`}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => {
        dirty.current = true;
        setDraft(e.target.value);
      }}
      onBlur={() => {
        dirty.current = false;
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          dirty.current = false;
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

export function TextArea({
  value,
  onCommit,
  placeholder,
  rows = 3,
  className = '',
  mono,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  mono?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) setDraft(value);
  }, [value]);
  return (
    <textarea
      className={`field resize-y leading-relaxed ${mono ? 'font-mono text-[13px]' : ''} ${className}`}
      rows={rows}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => {
        dirty.current = true;
        setDraft(e.target.value);
      }}
      onBlur={() => {
        dirty.current = false;
        if (draft !== value) onCommit(draft);
      }}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  className = '',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <select
      className={`field ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-ink-800">
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Список строк (убеждения, правила мира, тактики). */
export function StringList({
  values,
  onChange,
  placeholder,
  addLabel = 'Добавить',
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  return (
    <div className="space-y-1.5">
      {values.map((v, i) => (
        <div key={i} className="flex gap-1.5">
          <TextInput
            value={v}
            placeholder={placeholder}
            onCommit={(next) => onChange(values.map((x, j) => (j === i ? next : x)))}
          />
          <Button
            variant="ghost"
            size="sm"
            title="Удалить"
            onClick={() => onChange(values.filter((_, j) => j !== i))}
          >
            ✕
          </Button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => onChange([...values, ''])}>
        + {addLabel}
      </Button>
    </div>
  );
}

/* ────────────────────────────  прочее  ──────────────────────────── */

export function Chip({
  tone = 'neutral',
  children,
  title,
}: {
  tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'accent';
  children: React.ReactNode;
  title?: string;
}) {
  const tones = {
    neutral: 'bg-ink-700 text-muted',
    ok: 'bg-ok/15 text-ok',
    warn: 'bg-warn/15 text-warn',
    bad: 'bg-bad/15 text-bad',
    accent: 'bg-accent/15 text-accent',
  }[tone];
  return (
    <span className={`chip ${tones}`} title={title}>
      {children}
    </span>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs uppercase tracking-[0.15em] text-muted">{children}</h2>
      {right}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted italic py-6 text-center">{children}</div>;
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto p-6">
      <div className={`card w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} my-8`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-700">
          <h3 className="font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 cursor-pointer group" title={hint}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-accent"
      />
      <span className="text-xs text-muted group-hover:text-paper leading-snug">{label}</span>
    </label>
  );
}
