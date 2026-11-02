import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onActivate?: () => void;
  onChange: (value: number) => void;
}

// Match BoardGameHelper's WheelPicker: five rows, three visible, 32px per step.
const ROW_HEIGHT = 32;
const ROW_OFFSETS = [-2, -1, 0, 1, 2];

export const HistoryDateWheel: React.FC<Props> = (props) => {
  const { label, value, min, max, disabled, onActivate, onChange } = props;
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number; y: number; id: number; lastStep: number;
    moved: boolean; captured: boolean; activated: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const latest = useRef(props);
  const valueRef = useRef(value);
  latest.current = props;
  useLayoutEffect(() => { valueRef.current = value; }, [value]);
  const move = (delta: number) => {
    const p = latest.current;
    if (p.disabled) { p.onActivate?.(); return; }
    const size = p.max - p.min + 1;
    const next = p.max === 9999 ? Math.max(p.min, Math.min(p.max, valueRef.current + delta)) :
      ((valueRef.current - p.min + delta) % size + size) % size + p.min;
    if (next !== valueRef.current) {
      valueRef.current = next;
      p.onChange(next);
    }
  };
  const moveRef = useRef(move);
  moveRef.current = move;
  useEffect(() => {
    const node = wheelRef.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      if (!event.deltaY || event.ctrlKey || event.metaKey || (latest.current.disabled && !latest.current.onActivate)) return;
      event.preventDefault();
      moveRef.current(event.deltaY > 0 ? 1 : -1);
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, []);
  const neighbor = (delta: number) => max === 9999 ?
    (value + delta < min || value + delta > max ? null : value + delta) :
    ((value - min + delta) % (max - min + 1) + max - min + 1) % (max - min + 1) + min;
  const finishDrag = (id: number, node: HTMLDivElement) => {
    const current = drag.current;
    if (!current || current.id !== id) return;
    suppressClick.current = current.moved;
    drag.current = null;
    setDragging(false);
    setOffset(0);
    if (node.hasPointerCapture?.(id)) node.releasePointerCapture(id);
  };
  const commit = () => {
    const number = Number(input);
    if (input.trim() && Number.isInteger(number) && number >= min && number <= max) onChange(number);
    setEditing(false);
  };

  return <div ref={wheelRef} className={`min-w-0 text-center select-none ${disabled && !onActivate ? '' : 'cursor-grab active:cursor-grabbing'}`}
    style={{ touchAction: 'none' }}
    role="group" aria-label={label}
    onClickCapture={event => {
      if (suppressClick.current) { suppressClick.current = false; event.preventDefault(); event.stopPropagation(); }
    }}
    onPointerDown={event => {
      suppressClick.current = false;
      if (event.isPrimary === false) {
        if (drag.current) finishDrag(drag.current.id, event.currentTarget);
        return;
      }
      if ((disabled && !onActivate) || event.button > 0 || (event.target as HTMLElement).closest('input')) return;
      drag.current = { x: event.clientX, y: event.clientY, id: event.pointerId, lastStep: 0, moved: false, captured: false, activated: false };
      setDragging(true);
      // Capture immediately on the pressed button so fast mouse drags cannot
      // escape, while an ordinary tap still dispatches its click to that button.
      const target = (event.target as HTMLElement).closest('button') ?? event.currentTarget;
      target.setPointerCapture?.(event.pointerId);
    }}
    onPointerMove={event => {
      const start = drag.current;
      if (!start || start.id !== event.pointerId) return;
      const delta = start.y - event.clientY;
      if (!start.moved && Math.abs(event.clientX - start.x) > Math.max(10, Math.abs(delta))) {
        start.moved = true;
        finishDrag(start.id, event.currentTarget);
        return;
      }
      if (Math.abs(delta) > 4) start.moved = true;
      // Defer capture until movement so a plain tap still reaches its button.
      if (start.moved && !start.captured) {
        start.captured = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
      const p = latest.current;
      if (p.disabled) {
        if (!p.onActivate || start.activated) return;
        setOffset(-Math.max(-12, Math.min(12, delta)));
        if (Math.abs(delta) >= 12) {
          start.activated = true;
          start.y = event.clientY;
          start.lastStep = 0;
          setOffset(0);
          p.onActivate();
        }
        return;
      }
      const step = Math.trunc(delta / ROW_HEIGHT);
      if (step !== start.lastStep) move(step - start.lastStep);
      start.lastStep = step;
      setOffset(-(delta - step * ROW_HEIGHT));
    }}
    onPointerUp={event => finishDrag(event.pointerId, event.currentTarget)}
    onPointerCancel={event => finishDrag(event.pointerId, event.currentTarget)}
    onLostPointerCapture={event => {
      // Touch implicitly captures on the pressed child button. Its capture loss
      // bubbles here when the wheel takes over; only our own loss ends the drag.
      if (event.target !== event.currentTarget || drag.current?.id !== event.pointerId) return;
      finishDrag(event.pointerId, event.currentTarget);
    }}>
    <div className="h-24 overflow-hidden">
      <div data-wheel-track="" style={{ transform: `translateY(${offset - ROW_HEIGHT}px)` }}
        className={`grid auto-rows-[32px] motion-reduce:transition-none ${dragging ? 'transition-none' : 'transition-transform duration-150 ease-out'}`}>
        {ROW_OFFSETS.map(delta => {
          const option = neighbor(delta);
          if (delta !== 0 && (disabled || option === null)) return <span key={delta} aria-hidden="true" />;
          if (delta === 0 && editing && !disabled) return (
            <input key={delta} autoFocus aria-label={label} type="number" inputMode="numeric" min={min} max={max}
              value={input} onChange={event => setInput(event.target.value)} onFocus={event => event.currentTarget.select()}
              onMouseUp={event => event.preventDefault()} onBlur={commit}
              onKeyDown={event => {
                if (event.key === 'Enter') { event.preventDefault(); commit(); }
                if (event.key === 'Escape') { event.stopPropagation(); setEditing(false); }
              }} className="w-full h-8 min-w-0 text-center text-base font-mono bg-app-bg border-0 border-b-2 border-brand-primary text-txt-primary" />
          );
          return <button key={delta} type="button" role={delta === 0 ? 'spinbutton' : undefined}
            aria-label={delta === 0 ? label : `${label} ${delta > 0 ? '+' : '−'}${Math.abs(delta)}`}
            aria-hidden={Math.abs(delta) === 2 || undefined} tabIndex={Math.abs(delta) === 2 ? -1 : undefined}
            aria-valuenow={delta === 0 && !disabled ? value : undefined}
            aria-valuemin={delta === 0 ? min : undefined} aria-valuemax={delta === 0 ? max : undefined} disabled={disabled && !onActivate}
            onKeyDown={event => {
              if (delta !== 0) return;
              suppressClick.current = false;
              if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault(); move(event.key === 'ArrowUp' ? 1 : -1);
              }
            }} onClick={() => {
              if (delta !== 0) { move(delta); return; }
              if (disabled) { onActivate?.(); return; }
              setInput(String(value)); setEditing(true);
            }} className={`w-full h-8 min-w-0 px-1 font-mono bg-transparent border-0 border-b-2 ${delta === 0 ?
              `text-xl font-bold ${disabled ? (onActivate ? 'text-brand-primary border-brand-primary border-dashed' : 'text-txt-muted border-transparent') : 'text-txt-primary border-brand-primary'}` :
              'text-base text-txt-muted opacity-[0.55] border-transparent hover:opacity-90'}`}>
            {disabled ? '－' : option}
          </button>;
        })}
      </div>
    </div>
  </div>;
};
