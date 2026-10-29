import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfirmationProvider, useConfirm } from './useConfirm';
import { useModalBackHandler, _resetActiveCountForTesting } from './useModalBackHandler';

// Mock ConfirmationModal to avoid translation/UI dependencies
vi.mock('../components/shared/ConfirmationModal', () => ({
  default: ({ onConfirm, onCancel, title, message, hideCancel }: any) => (
    <div data-testid="mock-modal">
      <h1 data-testid="modal-title">{title}</h1>
      <p>{message}</p>
      {!hideCancel && <button onClick={onCancel}>Cancel Button</button>}
      <button onClick={onConfirm}>Confirm Button</button>
    </div>
  )
}));

const TestComponent = () => {
  const { confirm } = useConfirm();
  const [result, setResult] = React.useState<string | null>(null);

  const handleClick = async () => {
    const confirmed = await confirm({
      title: 'Confirm Title',
      message: 'Confirm Message',
    });
    setResult(confirmed ? 'confirmed' : 'cancelled');
  };

  return (
    <div>
      <button onClick={handleClick}>Open Confirm</button>
      {result && <div data-testid="result">{result}</div>}
    </div>
  );
};

describe('useConfirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('settles nested confirmation history before starting the confirmed action or a reload', async () => {
    vi.useFakeTimers();
    _resetActiveCountForTesting();
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const action = vi.fn();
    const closeSettings = vi.fn();
    function Settings() {
      useModalBackHandler(true, closeSettings, 'settings-test', { immediate: true });
      const { confirm } = useConfirm();
      return <button onClick={async () => {
        if (await confirm({ title: 'Replace', message: 'Replace data' })) action();
      }}>Start import</button>;
    }
    const view = render(<ConfirmationProvider><Settings /></ConfirmationProvider>);
    try {
      fireEvent.click(screen.getByText('Start import'));
      await act(async () => { fireEvent.click(screen.getByText('Confirm Button')); });
      await act(async () => { await vi.advanceTimersByTimeAsync(200); });
      expect(action).not.toHaveBeenCalled();
      expect(back).toHaveBeenCalledTimes(1);
      await act(async () => {
        window.dispatchEvent(new PopStateEvent('popstate'));
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(action).toHaveBeenCalledTimes(1);
      expect(closeSettings).not.toHaveBeenCalled();
      expect(back).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      vi.clearAllTimers();
      vi.useRealTimers();
      back.mockRestore();
      _resetActiveCountForTesting();
    }
  });

  it('registers a new history entry when a confirmed action immediately opens another confirmation', async () => {
    vi.useFakeTimers();
    _resetActiveCountForTesting();
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const done = vi.fn();
    function Chained() {
      const { confirm } = useConfirm();
      return <button onClick={async () => {
        if (await confirm({ title: 'First', message: 'First' })) {
          if (await confirm({ title: 'Second', message: 'Second' })) done();
        }
      }}>Start chain</button>;
    }
    const view = render(<ConfirmationProvider><Chained /></ConfirmationProvider>);
    const finishBack = async () => {
      await act(async () => {
        window.dispatchEvent(new PopStateEvent('popstate'));
        await vi.advanceTimersByTimeAsync(0);
      });
    };
    try {
      fireEvent.click(screen.getByText('Start chain'));
      fireEvent.click(screen.getByText('Confirm Button'));
      await finishBack();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Second');
      expect((window as unknown as { __modalStack: string[] }).__modalStack).toContain('global-confirm');
      fireEvent.click(screen.getByText('Confirm Button'));
      await finishBack();
      expect(done).toHaveBeenCalledTimes(1);
      expect(back).toHaveBeenCalledTimes(2);
    } finally {
      view.unmount();
      vi.clearAllTimers();
      vi.useRealTimers();
      back.mockRestore();
      _resetActiveCountForTesting();
    }
  });

  it('should open the modal and resolve with true on confirm', async () => {
    render(
      <ConfirmationProvider>
        <TestComponent />
      </ConfirmationProvider>
    );

    fireEvent.click(screen.getByText('Open Confirm'));
    expect(screen.getByTestId('modal-title')).toHaveTextContent('Confirm Title');

    const confirmButton = screen.getByText('Confirm Button');
    act(() => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument();
    });
    expect(await screen.findByTestId('result')).toHaveTextContent('confirmed');
  });

  it('should open the modal and resolve with false on cancel', async () => {
    render(
      <ConfirmationProvider>
        <TestComponent />
      </ConfirmationProvider>
    );

    fireEvent.click(screen.getByText('Open Confirm'));
    
    const cancelButton = screen.getByText('Cancel Button');
    act(() => {
      fireEvent.click(cancelButton);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument();
    });
    expect(await screen.findByTestId('result')).toHaveTextContent('cancelled');
  });

  it('should hide cancel button when hideCancel is true', async () => {
    const AlertTestComponent = () => {
      const { confirm } = useConfirm();
      return (
        <button onClick={() => confirm({ title: 'Alert', message: 'Msg', hideCancel: true })}>
          Open Alert
        </button>
      );
    };

    render(
      <ConfirmationProvider>
        <AlertTestComponent />
      </ConfirmationProvider>
    );

    fireEvent.click(screen.getByText('Open Alert'));
    
    expect(screen.queryByText('Cancel Button')).not.toBeInTheDocument();
    expect(screen.getByText('Confirm Button')).toBeInTheDocument();
  });
});
