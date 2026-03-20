import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfirmationProvider, useConfirm } from './useConfirm';

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
