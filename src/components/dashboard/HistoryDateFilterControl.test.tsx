import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../i18n';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import { ALL_HISTORY_DATES, type HistoryDateFilter } from '../../utils/historyDateFilter';
import HistoryDateFilterControl from './HistoryDateFilterControl';

vi.mock('../../hooks/useModalBackHandler', () => ({ useModalBackHandler: vi.fn(() => ({ zIndex: 120 })) }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
beforeEach(() => { localStorage.setItem('app_language', 'zh-TW'); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 2, 12)); });
const open = () => {
  fireEvent.click(screen.getByRole('button', { name: /^篩選時間:/ }));
  fireEvent.click(screen.getByRole('button', { name: '自選…' }));
};
const setup = (initial: HistoryDateFilter = ALL_HISTORY_DATES) => {
  const applied = vi.fn();
  const Harness = () => {
    const [value, setValue] = useState(initial);
    return <HistoryDateFilterControl value={value} onChange={next => { applied(next); setValue(next); }} />;
  };
  render(<LanguageProvider><Harness /></LanguageProvider>);
  return applied;
};
const setNumber = (group: string, unit: string, value: number) => {
  const section = within(screen.getByRole('region', { name: group }));
  fireEvent.click(section.getByRole('spinbutton', { name: unit }));
  const input = section.getByRole('spinbutton', { name: unit });
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.keyDown(input, { key: 'Enter' });
};

describe('history time selector', () => {
  it('orders Custom, This month, All; presets apply without opening the editor', () => {
    const applied = setup();
    fireEvent.click(screen.getByRole('button', { name: /^篩選時間:/ }));
    expect(screen.getAllByRole('button').slice(1).map(button => button.textContent)).toEqual(['自選…', '這個月', '全期間']);
    fireEvent.click(screen.getByRole('button', { name: '這個月' }));
    expect(applied).toHaveBeenLastCalledWith({ kind: 'month' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^篩選時間:/ }));
    fireEvent.click(screen.getByRole('button', { name: '全期間' }));
    expect(applied).toHaveBeenLastCalledWith({ kind: 'all' });
  });

  it('starts with one date, exposes precision and a second endpoint progressively, and cancels drafts', () => {
    const applied = setup(); open();
    expect(screen.getByRole('region', { name: '日期' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '結束日期' })).not.toBeInTheDocument();
    setNumber('日期', '日', 20);
    expect(applied).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '結束日期' }));
    expect(screen.getByRole('region', { name: '開始日期' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '結束日期' })).getByRole('spinbutton', { name: '日' })).toHaveTextContent('20');
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(applied).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^篩選時間:/ })).toHaveFocus();
    open();
    expect(within(screen.getByRole('region', { name: '日期' })).getByRole('spinbutton', { name: '日' })).toHaveTextContent('2');
  });

  it('labels year/month/day semantics, disables unused wheels, and restores an applied month', () => {
    const applied = setup(); open();
    fireEvent.click(screen.getByRole('button', { name: '月' }));
    expect(screen.getByRole('region', { name: '月份' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '日' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '年' }));
    expect(screen.getByRole('region', { name: '年份' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '月' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '月' }));
    setNumber('月份', '年', 2024); setNumber('月份', '月', 2);
    fireEvent.click(screen.getByRole('button', { name: '套用' }));
    expect(applied).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'custom', precision: 'month', range: false, start: { year: 2024, month: 2, day: 2 } }));
    expect(screen.getByRole('button', { name: /^篩選時間:/ })).toHaveTextContent('2024/02');
    fireEvent.click(screen.getByRole('button', { name: /^篩選時間:/ }));
    fireEvent.click(screen.getByRole('button', { name: /^自選/ }));
    expect(screen.getByRole('region', { name: '月份' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '年' })).toHaveTextContent('2024');
  });

  it('rejects reversed bounds, accepts equal bounds and supports unlimited endpoints', () => {
    const applied = setup(); open();
    setNumber('日期', '日', 15);
    fireEvent.click(screen.getByRole('button', { name: '結束日期' }));
    setNumber('結束日期', '日', 14);
    expect(screen.getByRole('alert')).toHaveTextContent('結束不可早於開始');
    expect(screen.getByRole('button', { name: '套用' })).toBeDisabled();
    setNumber('結束日期', '日', 15);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '結束日期 不限' }));
    expect(within(screen.getByRole('region', { name: '結束日期' })).getByRole('spinbutton', { name: '日' })).toHaveTextContent('－');
    fireEvent.click(screen.getByRole('button', { name: '套用' }));
    expect(applied).toHaveBeenLastCalledWith(expect.objectContaining({ range: true, endOpen: true }));
  });

  it('commits an active numeric input when Apply is clicked and handles escape/back cancellation', async () => {
    const user = userEvent.setup();
    const applied = setup(); open();
    await user.click(screen.getByRole('spinbutton', { name: '年' }));
    const input = screen.getByRole('spinbutton', { name: '年' });
    fireEvent.change(input, { target: { value: '2030' } });
    await user.click(screen.getByRole('button', { name: '套用' }));
    expect(applied).toHaveBeenLastCalledWith(expect.objectContaining({ start: { year: 2030, month: 11, day: 2 } }));
    fireEvent.click(screen.getByRole('button', { name: /^篩選時間:/ }));
    fireEvent.click(screen.getByRole('button', { name: /^自選/ }));
    const count = applied.mock.calls.length;
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(applied).toHaveBeenCalledTimes(count);
    fireEvent.click(screen.getByRole('button', { name: /^篩選時間:/ }));
    fireEvent.click(screen.getByRole('button', { name: /^自選/ }));
    const calls = vi.mocked(useModalBackHandler).mock.calls.filter(call => call[2] === 'history-date-filter');
    const call = calls[calls.length - 1];
    act(() => call[1]());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(applied).toHaveBeenCalledTimes(count);
  });

  it('handles the first swipe, suppresses its trailing click, and accepts the next tap immediately', () => {
    vi.stubGlobal('PointerEvent', MouseEvent);
    setup(); open();
    const wheel = screen.getByRole('group', { name: '月' });
    fireEvent.pointerDown(wheel, { button: 0, clientX: 10, clientY: 100 });
    fireEvent.pointerMove(wheel, { clientX: 10, clientY: 68 });
    fireEvent.pointerUp(wheel, { clientX: 10, clientY: 68 });
    expect(screen.getByRole('spinbutton', { name: '月' })).toHaveTextContent('12');
    fireEvent.click(screen.getByRole('spinbutton', { name: '月' }));
    expect(screen.getByRole('spinbutton', { name: '月' }).tagName).toBe('BUTTON');
    const next = within(wheel).getByRole('button', { name: '月 +1' });
    fireEvent.pointerDown(next, { button: 0, clientX: 10, clientY: 100 });
    fireEvent.pointerUp(next, { clientX: 10, clientY: 100 });
    fireEvent.click(next);
    expect(screen.getByRole('spinbutton', { name: '月' })).toHaveTextContent('1');
    fireEvent.pointerDown(wheel, { button: 0, clientX: 10, clientY: 100 });
    fireEvent.pointerMove(wheel, { clientX: 10, clientY: 68 });
    fireEvent.pointerCancel(wheel);
    expect(screen.getByRole('spinbutton', { name: '月' })).toHaveTextContent('1');
    fireEvent.wheel(wheel, { deltaY: 10 });
    expect(screen.getByRole('spinbutton', { name: '月' })).toHaveTextContent('2');
    fireEvent.wheel(wheel, { deltaY: 10, ctrlKey: true });
    expect(screen.getByRole('spinbutton', { name: '月' })).toHaveTextContent('2');
    fireEvent.pointerDown(wheel, { button: 0, clientX: 10, clientY: 100 });
    fireEvent.pointerMove(wheel, { clientX: 60, clientY: 90 });
    fireEvent.pointerUp(wheel, { clientX: 60, clientY: 68 });
    expect(screen.getByRole('spinbutton', { name: '月' })).toHaveTextContent('2');
  });

  it('renders English labels', () => {
    localStorage.setItem('app_language', 'en'); setup();
    fireEvent.click(screen.getByRole('button', { name: /^Filter dates:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Custom…' }));
    expect(screen.getByRole('dialog', { name: 'Custom play dates' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End date' })).toBeInTheDocument();
  });
});
