import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CameraView from './CameraView';

vi.mock('../../hooks/useModalBackHandler', () => ({ useModalBackHandler: () => ({ zIndex: 100 }) }));
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../i18n/scanner', () => ({ useScannerTranslation: () => ({ t: (key: string) => key }) }));

const context = { translate: vi.fn(), rotate: vi.fn(), drawImage: vi.fn() };
let encodedSizes: number[][];
const blob = new Blob(['captured'], { type: 'image/jpeg' });

beforeEach(() => {
  vi.clearAllMocks();
  encodedSizes = [];
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('innerWidth', 400);
  vi.stubGlobal('innerHeight', 800);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
  } });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as any);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback) {
    encodedSizes.push([this.width, this.height]);
    callback(blob);
  });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const motion = (x: number, y: number) => {
  const event = new Event('devicemotion');
  Object.defineProperty(event, 'accelerationIncludingGravity', { value: { x, y, z: 0 } });
  fireEvent(window, event);
};

const openCamera = async () => {
  const onCapture = vi.fn();
  const view = render(<CameraView onCapture={onCapture} onClose={vi.fn()} singleShot />);
  await act(async () => {}); // Camera stream attaches asynchronously.
  const video = document.querySelector('video')!;
  Object.defineProperties(video, { videoWidth: { value: 1200 }, videoHeight: { value: 800 } });
  const shutter = document.querySelector('svg.lucide-camera')!.closest('button')!;
  return { ...view, onCapture, shutter };
};

describe('camera orientation and capture', () => {
  it.each([false, true])('rotates physical capture only when native landscape layout is %s', async nativeLandscape => {
    if (nativeLandscape) {
      vi.stubGlobal('innerWidth', 800);
      vi.stubGlobal('innerHeight', 400);
    }
    const { onCapture, shutter } = await openCamera();
    motion(2.4, 1.2); // Tabletop tilt below the previous absolute threshold.
    fireEvent.click(shutter);
    expect(encodedSizes).toEqual([nativeLandscape ? [1200, 800] : [800, 1200]]);
    expect(context.rotate.mock.calls).toEqual(nativeLandscape ? [] : [[-Math.PI / 2]]);
    expect(onCapture).toHaveBeenCalledExactlyOnceWith([blob]);
  });

  it('requests iOS motion permission only on a tap and still allows manual rotation while flat', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('DeviceMotionEvent', class extends Event { static requestPermission = requestPermission; });
    const { onCapture, shutter } = await openCamera();
    const rotate = document.querySelector('svg.lucide-rotate-ccw')!.closest('button')!;
    expect(requestPermission).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(rotate); });
    motion(0, 0);
    fireEvent.click(rotate); // After granting permission, manual fallback must remain usable.
    motion(0.1, 0.2);
    fireEvent.click(shutter);
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(encodedSizes).toEqual([[800, 1200]]);
    expect(context.rotate).toHaveBeenCalledExactlyOnceWith(-Math.PI / 2);
    expect(onCapture).toHaveBeenCalledExactlyOnceWith([blob]);
  });
});
