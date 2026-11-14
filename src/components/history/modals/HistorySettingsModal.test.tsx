import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import type { HistoryRecord } from '../../../types';

vi.mock('../../../services/relationshipService', () => ({
  relationshipService: { processGameEnd: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../../hooks/useModalBackHandler', () => ({
  useModalBackHandler: () => ({ zIndex: 50 }),
}));
vi.mock('../../../i18n/history', () => ({
  useHistoryTranslation: () => ({ t: (key: string) => key }),
}));

import HistorySettingsModal from './HistorySettingsModal';

const START = new Date(2026, 10, 7, 20, 0).getTime();
const END = new Date(2026, 10, 7, 21, 30).getTime();

const makeRecord = (): HistoryRecord => ({
  id: 'record-1',
  templateId: 'template-1',
  gameName: 'Harmonies',
  startTime: START,
  endTime: END,
  players: [
    { id: 'p1', name: 'A', color: '#000', scores: {}, totalScore: 10 },
    { id: 'p2', name: 'B', color: '#fff', scores: {}, totalScore: 7 },
  ],
  winnerIds: ['p1'],
  scoringRule: 'HIGHEST_WINS',
} as unknown as HistoryRecord);

const renderModal = () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <HistorySettingsModal
      isOpen
      onClose={vi.fn()}
      record={makeRecord()}
      onSave={onSave}
      onRestoreTemplate={vi.fn().mockResolvedValue(undefined)}
    />
  );
  const [startInput, endInput] = Array.from(
    view.container.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]')
  );
  const save = () => {
    const buttons = view.container.querySelectorAll('button');
    fireEvent.click(buttons[buttons.length - 1]);
  };
  return { onSave, startInput, endInput, save };
};

describe('HistorySettingsModal time fields', () => {
  it('never saves a non-finite time when a time field is cleared', () => {
    const { onSave, startInput, endInput, save } = renderModal();

    // The picker's "clear" action, or deleting one segment on desktop, reports an empty value.
    fireEvent.change(endInput, { target: { value: '' } });
    fireEvent.change(startInput, { target: { value: '' } });
    save();

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as HistoryRecord;
    // A NaN endTime is not a valid IndexedDB key: the record would drop out of the
    // endTime index and disappear from the history list.
    expect(saved.endTime).toBe(END);
    expect(saved.startTime).toBe(START);
  });

  it('keeps the partially edited text on screen and applies a completed value', () => {
    const { onSave, endInput, save } = renderModal();

    fireEvent.change(endInput, { target: { value: '' } });
    expect(endInput.value).toBe('');

    fireEvent.change(endInput, { target: { value: '2026-11-07T22:15' } });
    save();

    const saved = onSave.mock.calls[0][0] as HistoryRecord;
    expect(saved.endTime).toBe(new Date(2026, 10, 7, 22, 15).getTime());
  });
});

it('restores an independent template with the saved scoring columns', async () => {
  const record = makeRecord();
  record.snapshotTemplate = {
    id: record.templateId,
    name: 'Original board',
    createdAt: 1,
    sourceTemplateId: 'Built-in-original',
    lastSyncedAt: 2,
    imageId: 'local-image',
    cloudImageId: 'cloud-image',
    columns: [{
      id: 'trees', name: 'Trees', formula: '(a1+next)×c1',
      constants: { c1: 3 }, inputType: 'keypad', isScoring: true,
    }],
  };
  record.bggId = '42';
  const onRestoreTemplate = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const view = render(<HistorySettingsModal
    isOpen record={record} onClose={onClose} onSave={vi.fn()} onRestoreTemplate={onRestoreTemplate}
  />);

  fireEvent.click(view.getByRole('button', { name: 'history_restore_btn' }));

  expect(onRestoreTemplate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    id: expect.any(String),
    name: 'Harmonies history_restore_suffix',
    columns: record.snapshotTemplate.columns,
    bggId: '42',
    defaultScoringRule: 'HIGHEST_WINS',
    imageId: 'local-image',
    cloudImageId: undefined,
    sourceTemplateId: undefined,
    lastSyncedAt: undefined,
  }));
  expect(onRestoreTemplate.mock.calls[0][0].id).not.toBe(record.templateId);
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
});
