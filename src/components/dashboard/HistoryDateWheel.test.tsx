import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { HistoryDateWheel } from './HistoryDateWheel';

afterEach(() => cleanup());

const pointer = (target: Element, type: string, y: number, id = 7) => {
  // JSDOM does not implement native pointer capture. Retain real pointer IDs and
  // dispatch the browser's bubbling capture events explicitly when ownership changes.
  const event = Object.assign(new MouseEvent(type, { bubbles: true, button: 0, clientX: 10, clientY: y }), {
    pointerId: id, pointerType: 'touch', isPrimary: true,
  });
  fireEvent(target, event);
};
const setup = () => {
  const changed = vi.fn();
  const Harness = () => {
    const [value, setValue] = useState(11);
    return <HistoryDateWheel label="Month" value={value} min={1} max={12}
      onChange={next => { changed(next); setValue(next); }} />;
  };
  render(<Harness />);
  const wheel = screen.getByRole('group', { name: 'Month' });
  const center = screen.getByRole('spinbutton', { name: 'Month' });
  wheel.setPointerCapture = vi.fn();
  center.setPointerCapture = vi.fn();
  return { changed, wheel, center };
};

it('keeps dragging when touch capture transfers from the pressed button to the wheel', () => {
  const { changed, wheel, center } = setup();
  pointer(center, 'pointerdown', 100);
  pointer(center, 'gotpointercapture', 100);
  pointer(center, 'pointermove', 92);
  // The first vertical movement captures on the parent; the child's implicit
  // capture is lost before the next movement/up and that loss bubbles upward.
  pointer(center, 'lostpointercapture', 92);
  pointer(wheel, 'gotpointercapture', 92);
  pointer(wheel, 'pointermove', 68);
  expect(screen.getByRole('spinbutton', { name: 'Month' })).toHaveTextContent('12');
  pointer(wheel, 'pointerup', 68);
  pointer(wheel, 'lostpointercapture', 68);
  expect(screen.getByRole('spinbutton', { name: 'Month' })).toHaveTextContent('12');
  expect(changed).toHaveBeenCalledExactlyOnceWith(12);
  fireEvent.click(center);
  expect(screen.getByRole('spinbutton', { name: 'Month' }).tagName).toBe('BUTTON');
});

it('ends the drag at the last selected value when the wheel itself loses capture', () => {
  const { changed, wheel, center } = setup();
  pointer(center, 'pointerdown', 100);
  pointer(center, 'pointermove', 68);
  pointer(wheel, 'lostpointercapture', 68);
  pointer(wheel, 'pointermove', 36);
  pointer(wheel, 'pointerup', 36);
  expect(changed).toHaveBeenCalledExactlyOnceWith(12);
  expect(screen.getByRole('spinbutton', { name: 'Month' })).toHaveTextContent('12');
});

it('ignores move, release and capture-loss events from another pointer', () => {
  const { changed, wheel, center } = setup();
  pointer(center, 'pointerdown', 100);
  pointer(center, 'pointermove', 92);
  pointer(wheel, 'pointermove', 36, 8);
  pointer(wheel, 'pointerup', 36, 8);
  pointer(wheel, 'lostpointercapture', 36, 8);
  pointer(wheel, 'pointercancel', 36, 8);
  pointer(wheel, 'pointermove', 68);
  pointer(wheel, 'pointerup', 68);
  expect(changed).toHaveBeenCalledExactlyOnceWith(12);
});

it('cancels a native interrupted drag and immediately accepts the next drag from a button', () => {
  const { changed, wheel, center } = setup();
  pointer(center, 'pointerdown', 100);
  pointer(center, 'pointermove', 68);
  pointer(wheel, 'pointercancel', 68);
  pointer(wheel, 'lostpointercapture', 68);
  pointer(wheel, 'pointerup', 68);
  expect(changed).toHaveBeenCalledExactlyOnceWith(12);
  pointer(center, 'pointerdown', 100, 9);
  pointer(center, 'pointermove', 68, 9);
  pointer(center, 'lostpointercapture', 68, 9);
  pointer(wheel, 'pointerup', 68, 9);
  expect(changed.mock.calls).toEqual([[12], [1]]);
});

it('follows the finger continuously, steps at the original 32px pitch, and snaps only the remaining offset', () => {
  const { changed, wheel, center } = setup();
  pointer(center, 'pointerdown', 100);
  pointer(center, 'pointermove', 84);
  const track = wheel.querySelector<HTMLElement>('[data-wheel-track]');
  expect(track).toHaveStyle('transform: translateY(-48px)');
  expect(changed).not.toHaveBeenCalled();
  pointer(wheel, 'pointermove', 64);
  expect(screen.getByRole('spinbutton', { name: 'Month' })).toHaveTextContent('12');
  expect(track).toHaveStyle('transform: translateY(-36px)');
  pointer(wheel, 'pointermove', 28);
  expect(screen.getByRole('spinbutton', { name: 'Month' })).toHaveTextContent(/^1$/);
  pointer(wheel, 'pointermove', 60);
  expect(screen.getByRole('spinbutton', { name: 'Month' })).toHaveTextContent('12');
  pointer(wheel, 'pointerup', 60);
  expect(track).toHaveStyle('transform: translateY(-32px)');
  expect(changed.mock.calls).toEqual([[12], [1], [12]]);
});

it('does not turn a partial drag into an extra step on release', () => {
  const { changed, wheel, center } = setup();
  pointer(center, 'pointerdown', 100);
  pointer(center, 'pointermove', 84);
  pointer(wheel, 'pointerup', 84);
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getByRole('spinbutton', { name: 'Month' })).toHaveTextContent('11');
  fireEvent.click(center);
  expect(screen.getByRole('spinbutton', { name: 'Month' }).tagName).toBe('BUTTON');
});

it('captures the pressed button immediately and preserves an ordinary tap and numeric editing', () => {
  const { changed, center } = setup();
  pointer(center, 'pointerdown', 100);
  expect(center.setPointerCapture).toHaveBeenCalledExactlyOnceWith(7);
  pointer(center, 'pointerup', 100);
  fireEvent.click(center);
  const input = screen.getByRole('spinbutton', { name: 'Month' });
  expect(input.tagName).toBe('INPUT');
  fireEvent.change(input, { target: { value: '3' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(changed).toHaveBeenCalledExactlyOnceWith(3);
  expect(screen.getByRole('spinbutton', { name: 'Month' })).toHaveTextContent(/^3$/);
});

it('preserves every crossed value when several movements arrive before the parent rerenders', () => {
  const { changed, wheel, center } = setup();
  pointer(center, 'pointerdown', 100);
  act(() => {
    pointer(center, 'pointermove', 68);
    pointer(wheel, 'pointermove', 36);
  });
  expect(screen.getByRole('spinbutton', { name: 'Month' })).toHaveTextContent(/^1$/);
  expect(changed.mock.calls).toEqual([[12], [1]]);
});

it('restores an unlimited endpoint during the drag, then steps from the activation point', () => {
  const activated = vi.fn(), changed = vi.fn();
  const Harness = () => {
    const [disabled, setDisabled] = useState(true);
    const [value, setValue] = useState(11);
    return <HistoryDateWheel label="Month" value={value} min={1} max={12} disabled={disabled}
      onActivate={disabled ? () => { activated(); setDisabled(false); } : undefined}
      onChange={next => { changed(next); setValue(next); }} />;
  };
  render(<Harness />);
  const center = screen.getByRole('spinbutton', { name: 'Month' });
  const wheel = screen.getByRole('group', { name: 'Month' });
  pointer(center, 'pointerdown', 100);
  pointer(center, 'pointermove', 84);
  expect(center).toHaveTextContent('11');
  expect(activated).toHaveBeenCalledTimes(1);
  expect(changed).not.toHaveBeenCalled();
  pointer(wheel, 'pointermove', 52);
  expect(center).toHaveTextContent('12');
  pointer(wheel, 'pointerup', 52);
  expect(changed).toHaveBeenCalledExactlyOnceWith(12);
  expect(activated).toHaveBeenCalledTimes(1);
});

it('keeps excluded precision disabled and shows blank rows at year limits', () => {
  const changed = vi.fn();
  const { rerender } = render(<HistoryDateWheel label="Year" value={1} min={1} max={9999} onChange={changed} />);
  expect(screen.queryByRole('button', { name: 'Year −1' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Year +1' }));
  expect(changed).toHaveBeenCalledExactlyOnceWith(2);
  rerender(<HistoryDateWheel label="Year" value={9999} min={1} max={9999} onChange={changed} />);
  expect(screen.queryByRole('button', { name: 'Year +1' })).not.toBeInTheDocument();
  changed.mockClear();
  rerender(<HistoryDateWheel label="Year" value={2026} min={1} max={9999} disabled onChange={changed} />);
  const wheel = screen.getByRole('group', { name: 'Year' });
  pointer(wheel, 'pointerdown', 100);
  pointer(wheel, 'pointermove', 36);
  pointer(wheel, 'pointerup', 36);
  expect(screen.getByRole('spinbutton', { name: 'Year' })).toBeDisabled();
  expect(changed).not.toHaveBeenCalled();
});
