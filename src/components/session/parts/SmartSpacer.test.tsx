import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SmartSpacer from './SmartSpacer';
import { LanguageProvider } from '../../../i18n';
import { GameSession, GameTemplate } from '../../../types';

vi.mock('../../tools/MediaTool', () => ({ default: () => <div>media-tools</div> }));
vi.mock('../../tools/RandomizerTool', () => ({ default: () => <div>randomizer-tool</div> }));
vi.mock('../../tools/CountdownTool', () => ({ default: () => <div>countdown-tool</div> }));
vi.mock('../../tools/OrderTool', () => ({ default: () => <div>order-tool</div> }));
vi.mock('../../tools/MemoTool', () => ({ default: () => <div>memo-tool</div> }));

const template: GameTemplate = { id: 'template-1', name: 'Template', columns: [], createdAt: 1, updatedAt: 1 };
const session: GameSession = { id: 'session-1', templateId: 'template-1', name: 'Template', startTime: 1, players: [], status: 'active' };

const renderSpacer = (mediaOnly: boolean) => render(
  <LanguageProvider>
    <SmartSpacer session={session} template={template} onUpdateSession={vi.fn()} mediaOnly={mediaOnly} />
  </LanguageProvider>
);

describe('SmartSpacer participant tools', () => {
  it('keeps vertical scrolling owned by the toolbox instead of its input-panel ancestor', () => {
    const onAncestorTouchMove = vi.fn();
    const { container } = render(
      <div onTouchMove={onAncestorTouchMove}>
        <LanguageProvider>
          <SmartSpacer session={session} template={template} onUpdateSession={vi.fn()} />
        </LanguageProvider>
      </div>,
    );
    const scroller = container.querySelector('[data-toolbox-scroller="true"]');

    expect(scroller).toHaveClass('touch-pan-y', 'overscroll-contain');
    fireEvent.touchMove(scroller!, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    expect(onAncestorTouchMove).not.toHaveBeenCalled();
  });

  it('shows only media tools in participant mode', () => {
    renderSpacer(true);
    expect(screen.getByText('media-tools')).toBeInTheDocument();
    expect(screen.queryByText('order-tool')).not.toBeInTheDocument();
    expect(screen.queryByText('countdown-tool')).not.toBeInTheDocument();
    expect(screen.queryByText('randomizer-tool')).not.toBeInTheDocument();
    expect(screen.queryByText('memo-tool')).not.toBeInTheDocument();
  });

  it('keeps all tools for host and single-player sessions', () => {
    renderSpacer(false);
    expect(screen.getByText('media-tools')).toBeInTheDocument();
    expect(screen.getByText('order-tool')).toBeInTheDocument();
    expect(screen.getByText('countdown-tool')).toBeInTheDocument();
    expect(screen.getByText('randomizer-tool')).toBeInTheDocument();
    expect(screen.getByText('memo-tool')).toBeInTheDocument();
  });

  it('does not repeat the score-input hint inside the toolbox', () => {
    renderSpacer(false);
    expect(screen.queryByText(/點擊上方分數格開始輸入|Tap a score cell to start/)).not.toBeInTheDocument();
  });
});
