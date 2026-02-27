import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { LanguageProvider, Language } from '../i18n';
import { useSessionTranslation } from './session';

describe('useSessionTranslation', () => {
    const renderWithProvider = (lang: Language = 'zh-TW') => {
        vi.stubGlobal('localStorage', {
            getItem: vi.fn(() => lang),
            setItem: vi.fn(),
        });
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <LanguageProvider>{children}</LanguageProvider>
        );
        return renderHook(() => useSessionTranslation(), { wrapper });
    };

    it('should return translations in zh-TW by default', () => {
        const { result } = renderWithProvider('zh-TW');
        expect(result.current.t('session_action_end')).toBe('結束');
    });

    it('should handle parameter substitution', () => {
        const { result } = renderWithProvider('zh-TW');
        expect(result.current.t('share_photo_count', { count: 5 })).toBe('目前 5 張照片');
    });

    it('should switch to English', () => {
        const { result } = renderWithProvider('en');
        expect(result.current.t('session_action_end')).toBe('End');
    });
});
