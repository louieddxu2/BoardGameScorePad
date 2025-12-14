
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// 模擬 window.matchMedia (JSDOM 不支援)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// 模擬 ResizeObserver
(globalThis as any).ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// 模擬 window.visualViewport (這是您 App 最核心的 Mobile 鍵盤偵測邏輯)
// 預設為全螢幕
class VisualViewportMock extends EventTarget {
  width = 1024;
  height = 768;
  offsetLeft = 0;
  offsetTop = 0;
  pageLeft = 0;
  pageTop = 0;
  scale = 1;
  onresize = null;
  onscroll = null;
}
window.visualViewport = new VisualViewportMock() as unknown as VisualViewport;

// 模擬 scrollIntoView (JSDOM 未實作)
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// 模擬 LocalStorage
const localStorageMock = (function() {
  let store: Record<string, string> = {};
  return {
    getItem: function(key: string) {
      return store[key] || null;
    },
    setItem: function(key: string, value: string) {
      store[key] = value.toString();
    },
    removeItem: function(key: string) {
      delete store[key];
    },
    clear: function() {
      store = {};
    }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
