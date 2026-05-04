
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { shouldTriggerIOSPwaGuide } from './IOSPwaGuide';

describe('shouldTriggerIOSPwaGuide', () => {
    const originalUserAgent = navigator.userAgent;
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
        // Clear localStorage
        localStorage.clear();
        
        // Mock matchMedia
        window.matchMedia = vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));
    });

    afterEach(() => {
        // Reset mocks
        Object.defineProperty(navigator, 'userAgent', { value: originalUserAgent, configurable: true });
        window.matchMedia = originalMatchMedia;
        vi.restoreAllMocks();
    });

    const setUA = (ua: string) => {
        Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
    };

    it('should return true for iOS in browser mode', () => {
        setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
        expect(shouldTriggerIOSPwaGuide()).toBe(true);
    });

    it('should return false for iOS in standalone mode', () => {
        setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
        window.matchMedia = vi.fn().mockImplementation(query => ({
            matches: query === '(display-mode: standalone)',
        }));
        
        expect(shouldTriggerIOSPwaGuide()).toBe(false);
    });

    it('should return false for non-iOS devices (e.g. Android)', () => {
        setUA('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36');
        expect(shouldTriggerIOSPwaGuide()).toBe(false);
    });

    it('should return false if shown less than 24 hours ago', () => {
        setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
        
        // Mock shown 5 hours ago
        const fiveHoursAgo = new Date(new Date().getTime() - 5 * 60 * 60 * 1000).toISOString();
        localStorage.setItem('ios_pwa_guide_last_shown', fiveHoursAgo);
        
        expect(shouldTriggerIOSPwaGuide()).toBe(false);
    });

    it('should return true if shown more than 24 hours ago', () => {
        setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
        
        // Mock shown 25 hours ago
        const twentyFiveHoursAgo = new Date(new Date().getTime() - 25 * 60 * 60 * 1000).toISOString();
        localStorage.setItem('ios_pwa_guide_last_shown', twentyFiveHoursAgo);
        
        expect(shouldTriggerIOSPwaGuide()).toBe(true);
    });
});
