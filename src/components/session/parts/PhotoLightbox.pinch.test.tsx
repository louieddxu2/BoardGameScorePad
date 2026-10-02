import React, { useEffect } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import { getMobileZoomGestureState, useMobileZoom } from '../../../hooks/useMobileZoom';
import { ToastProvider } from '../../../hooks/useToast';
import { suppressInvalidTouchClick } from '../../../utils/touchGesture';
import PhotoLightbox from './PhotoLightbox';

const Harness = () => {
  useMobileZoom();
  useEffect(() => {
    window.addEventListener('click', suppressInvalidTouchClick, true);
    return () => window.removeEventListener('click', suppressInvalidTouchClick, true);
  }, []);
  return <LanguageProvider><ToastProvider>
    <PhotoLightbox images={[{ id: 'photo', url: 'data:image/png;base64,AA==' }]}
      initialIndex={0} onClose={() => {}} onDelete={() => {}} manageBackHistory={false} />
  </ToastProvider></LanguageProvider>;
};

const first = { identifier: 1, clientX: 100, clientY: 100 };
const second = { identifier: 2, clientX: 200, clientY: 100 };
const pinch = (image: HTMLElement) => {
  fireEvent.touchStart(image, { touches: [first], changedTouches: [first] });
  fireEvent.touchStart(image, { touches: [first, second], changedTouches: [second] });
  fireEvent.touchMove(image, {
    touches: [first, { ...second, clientX: 220 }], changedTouches: [second],
  });
};
const release = (image: HTMLElement) => {
  fireEvent.touchEnd(image, { touches: [first], changedTouches: [second] });
  fireEvent.touchEnd(image, { touches: [], changedTouches: [first] });
};

describe('photo viewer pinch isolation', () => {
  let previousFontSize: string;
  let previousZoomProperty: string;
  let previousSavedZoom: string | null;
  beforeEach(() => {
    previousFontSize = document.documentElement.style.fontSize;
    previousZoomProperty = document.documentElement.style.getPropertyValue('--app-zoom-level');
    previousSavedZoom = localStorage.getItem('app_zoom_level');
    localStorage.removeItem('app_zoom_level');
  });
  afterEach(() => {
    cleanup();
    document.documentElement.style.fontSize = previousFontSize;
    if (previousZoomProperty) document.documentElement.style.setProperty('--app-zoom-level', previousZoomProperty);
    else document.documentElement.style.removeProperty('--app-zoom-level');
    if (previousSavedZoom === null) localStorage.removeItem('app_zoom_level');
    else localStorage.setItem('app_zoom_level', previousSavedZoom);
  });

  it.each([1, 1.3])('zooms the real image without changing the saved %s app zoom', (appZoom) => {
    localStorage.setItem('app_zoom_level', String(appZoom));
    render(<Harness />);
    const image = screen.getByAltText('Full view');
    pinch(image);
    expect(image.style.transform).toContain('scale(1.2)');
    expect(document.documentElement.style.fontSize).toBe(`${16 * appZoom}px`);
    expect(document.documentElement.style.getPropertyValue('--app-zoom-level')).toBe(String(appZoom));
    expect(localStorage.getItem('app_zoom_level')).toBe(String(appZoom));
    expect(getMobileZoomGestureState().active).toBe(true);
    fireEvent.touchEnd(image, { touches: [first], changedTouches: [second] });
    expect(getMobileZoomGestureState().active).toBe(true);
    fireEvent.touchEnd(image, { touches: [], changedTouches: [first] });
    expect(getMobileZoomGestureState()).toMatchObject({ active: false, suppressClick: true });
  });

  it('still pans a zoomed photo on a fresh single-finger gesture', () => {
    render(<Harness />);
    const image = screen.getByAltText('Full view');
    pinch(image);
    release(image);
    const moved = { ...first, clientX: 120, clientY: 130 };
    fireEvent.touchStart(image, { touches: [first], changedTouches: [first] });
    fireEvent.touchMove(image, { touches: [moved], changedTouches: [moved] });
    fireEvent.touchEnd(image, { touches: [], changedTouches: [moved] });
    expect(image.style.transform).toBe('translate(20px, 30px) scale(1.2)');
    expect(document.documentElement.style.fontSize).toBe('16px');
  });

  it('rejects trailing pinch clicks but accepts a fresh reset tap immediately', () => {
    render(<Harness />);
    const image = screen.getByAltText('Full view');
    const reset = screen.getByTitle('Reset View');
    pinch(image);
    release(image);
    fireEvent.click(reset, { detail: 0 });
    fireEvent.click(reset, { detail: 1 });
    expect(image.style.transform).toContain('scale(1.2)');
    fireEvent.touchStart(reset, { touches: [first], changedTouches: [first] });
    fireEvent.touchEnd(reset, { touches: [], changedTouches: [first] });
    fireEvent.click(reset, { detail: 1 });
    expect(image.style.transform).toBe('translate(0px, 0px) scale(1)');
    expect(document.documentElement.style.fontSize).toBe('16px');
  });
});
