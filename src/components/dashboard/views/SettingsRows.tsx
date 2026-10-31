import React from 'react';
import { ChevronRight } from 'lucide-react';

/** One card per section; rows are separated by dividers and explanations live in the footer. */
export function SettingsGroup({ title, footer, children }: { title: string; footer?: string; children: React.ReactNode }) {
  return <div className="space-y-2">
    <h3 className="text-sm font-medium text-txt-secondary px-1">{title}</h3>
    <div className="rounded-xl border border-surface-border bg-surface-bg text-txt-primary divide-y divide-surface-border overflow-hidden">
      {children}
    </div>
    {footer && <p className="text-xs text-txt-muted px-1">{footer}</p>}
  </div>;
}

/** Only rows that open another screen carry the chevron. */
export function NavRow({ icon, label, status, onClick, disabled }: {
  icon: React.ReactNode; label: string; status?: string; onClick: () => void; disabled?: boolean;
}) {
  return <button type="button" disabled={disabled} onClick={onClick}
    className="w-full min-h-[52px] px-4 py-3 flex items-center gap-3 hover:bg-surface-hover disabled:opacity-50 text-left transition-colors">
    {icon}
    <span className="flex-1 min-w-0 font-medium">{label}</span>
    {status && <span className="text-sm text-txt-secondary shrink-0">{status}</span>}
    <ChevronRight size={16} className="text-txt-muted shrink-0" />
  </button>;
}

/** Every option is visible and a tap applies it directly. */
export function Segmented<T extends string>({ label, value, options, onChange, className = '' }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; className?: string;
}) {
  return <div role="radiogroup" aria-label={label}
    className={`flex rounded-lg border border-surface-border bg-surface-alt p-0.5 ${className}`}>
    {options.map(option => {
      const selected = option.value === value;
      return <button key={option.value} type="button" role="radio" aria-checked={selected}
        onClick={() => { if (!selected) onChange(option.value); }}
        className={`flex-1 min-h-[40px] px-2 rounded-md text-sm whitespace-nowrap transition-colors ${selected
          ? 'bg-surface-bg text-txt-primary font-medium shadow-sm' : 'text-txt-secondary hover:bg-surface-hover'}`}>
        {option.label}
      </button>;
    })}
  </div>;
}
