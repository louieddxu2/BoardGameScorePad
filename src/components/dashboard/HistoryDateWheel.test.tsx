import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  pointer(wheel, 'pointerup', 68);
  pointer(wheel, 'lostpointercapture', 68);
  expect(screen.getByRole('spinbutton', { name: 'Month' })).toHaveTextContent('12');
  expect(changed).toHaveBeenCalledExactlyOnceWith(12);
  fireEvent.click(center);
  expect(screen.getByRole('spinbutton', { name: 'Month' }).tagName).toBe('BUTTON');
});

it('cancels only when the wheel itself loses the active pointer capture', () => {
  const { changed, wheel, center } = setup();
  pointer(center, 'pointerdown', 100);
  pointer(center, 'pointermove', 68);
  pointer(wheel, 'lostpointercapture', 68);
  pointer(wheel, 'pointerup', 68);
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getByRole('spinbutton', { name: 'Month' })).toHaveTextContent('11');
});

it('ignores move, release and capture-loss events from another pointer', () => {
  const { changed, wheel, center } = setup();
  pointer(center, 'pointerdown', 100);
  pointer(center, 'pointermove', 92);
  pointer(wheel, 'pointermove', 36, 8);
  pointer(wheel, 'pointerup', 36, 8);
  pointer(wheel, 'lostpointercapture', 36, 8);
  pointer(wheel, 'pointercancel', 36, 8);
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
  expect(changed).not.toHaveBeenCalled();
  pointer(center, 'pointerdown', 100, 9);
  pointer(center, 'pointermove', 68, 9);
  pointer(center, 'lostpointercapture', 68, 9);
  pointer(wheel, 'pointerup', 68, 9);
  expect(changed).toHaveBeenCalledExactlyOnceWith(12);
});
