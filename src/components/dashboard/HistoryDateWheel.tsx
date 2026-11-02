import React, { useEffect, useRef, useState } from 'react';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onActivate?: () => void;
  onChange: (value: number) => void;
}

export const HistoryDateWheel: React.FC<Props> = (props) => {
  const { label, value, min, max, disabled, onActivate, onChange } = props;
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [offset, setOffset] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const suppressClick = useRef(false);
  const latest = useRef(props);
  latest.current = props;
  const move = (delta: number) => {
    const p = latest.current;
    if (p.disabled) { p.onActivate?.(); return; }
    const size = p.max - p.min + 1;
    const next = p.max === 9999 ? Math.max(p.min, Math.min(p.max, p.value + delta)) :
      ((p.value - p.min + delta) % size + size) % size + p.min;
    if (next !== p.value) p.onChange(next);
  };
  const moveRef = useRef(move);
  moveRef.current = move;
  useEffect(() => {
    const node = wheelRef.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      if (!event.deltaY || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      moveRef.current(event.deltaY > 0 ? 1 : -1);
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, []);
  const neighbor = (delta: number) => max === 9999 ? Math.max(min, Math.min(max, value + delta)) :
    ((value - min + delta) % (max - min + 1) + max - min + 1) % (max - min + 1) + min;
  const commit = () => {
    const number = Number(input);
    if (input.trim() && Number.isInteger(number) && number >= min && number <= max) onChange(number);
    setEditing(false);
  };

  return <div ref={wheelRef} className="min-w-0 flex-1 text-center select-none" style={{ touchAction: 'pan-x pinch-zoom' }}
    role="group" aria-label={label}
    onClickCapture={event => {
      if (suppressClick.current) { suppressClick.current = false; event.preventDefault(); event.stopPropagation(); }
    }}
    onPointerDown={event => {
      suppressClick.current = false;
      if (event.isPrimary === false) { drag.current = null; setOffset(0); return; }
      if (event.button > 0 || (event.target as HTMLElement).tagName === 'INPUT') return;
      drag.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    }}
    onPointerMove={event => {
      const start = drag.current;
      if (!start || start.id !== event.pointerId) return;
      const dy = event.clientY - start.y;
      if (Math.abs(event.clientX - start.x) > Math.max(10, Math.abs(dy))) {
        drag.current = null; setOffset(0); return;
      }
      if (Math.abs(dy) > 5) {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setOffset(Math.max(-28, Math.min(28, dy)));
      }
    }}
    onPointerUp={event => {
      const start = drag.current;
      if (!start || start.id !== event.pointerId) return;
      drag.current = null;
      setOffset(0);
      const distance = start.y - event.clientY;
      if (Math.abs(distance) >= 12) {
        suppressClick.current = true;
        move(Math.sign(distance) * Math.max(1, Math.round(Math.abs(distance) / 32)));
      }
    }}
    onPointerCancel={event => {
      if (drag.current?.id !== event.pointerId) return;
      drag.current = null; setOffset(0); suppressClick.current = true;
    }}
    onLostPointerCapture={event => {
      // Touch implicitly captures on the pressed child button. Its capture loss
      // bubbles here when the wheel takes over; only our own loss ends the drag.
      if (event.target !== event.currentTarget || drag.current?.id !== event.pointerId) return;
      drag.current = null; setOffset(0); suppressClick.current = true;
    }}>
    <div style={{ transform: `translateY(${offset}px)` }}>
      <button type="button" disabled={disabled} aria-label={`${label} −1`} onClick={() => move(-1)}
        className="w-full h-11 text-sm font-mono text-txt-muted disabled:invisible">{neighbor(-1)}</button>
      {editing && !disabled ? <input autoFocus aria-label={label} type="number" inputMode="numeric" min={min} max={max}
        value={input} onChange={event => setInput(event.target.value)} onFocus={event => event.currentTarget.select()}
        onMouseUp={event => event.preventDefault()} onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); commit(); }
          if (event.key === 'Escape') { event.stopPropagation(); setEditing(false); }
        }} className="w-full h-12 min-w-0 text-center text-base font-mono bg-app-bg border border-brand-primary rounded-lg text-txt-primary" /> :
        <button type="button" role="spinbutton" aria-label={label} aria-valuenow={disabled ? undefined : value}
          aria-valuemin={min} aria-valuemax={max} disabled={disabled && !onActivate}
          onKeyDown={event => {
            suppressClick.current = false;
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault(); move(event.key === 'ArrowUp' ? 1 : -1);
            }
          }} onClick={() => {
            if (disabled) { onActivate?.(); return; }
            setInput(String(value)); setEditing(true);
          }} className="w-full h-12 min-w-0 rounded-lg bg-surface-bg border border-surface-border text-xl sm:text-2xl font-mono text-txt-primary disabled:text-txt-muted">
          {disabled ? '－' : value}
        </button>}
      <button type="button" disabled={disabled} aria-label={`${label} +1`} onClick={() => move(1)}
        className="w-full h-11 text-sm font-mono text-txt-muted disabled:invisible">{neighbor(1)}</button>
    </div>
  </div>;
};
