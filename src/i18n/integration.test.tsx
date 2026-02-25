import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { LanguageProvider, Language } from '../i18n';
import { useIntegrationTranslation } from './integration';

describe('useIntegrationTranslation', () => {
    const renderWithProvider = (lang: Language = 'zh-TW') => {
        vi.stubGlobal('localStorage', {
            getItem: vi.fn(() => lang),
            setItem: vi.fn(),
        });
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <LanguageProvider>{children}</LanguageProvider>
        );
        return renderHook(() => useIntegrationTranslation(), { wrapper });
    };

    it('should return integration translations', () => {
        const { result } = renderWithProvider('zh-TW');
        expect(result.current.t('bgg_import_title')).toBe('BGG 字典匯入');
    });

    it('should handle parameter substitution', () => {
        const { result } = renderWithProvider('zh-TW');
        expect(result.current.t('bgg_msg_import_success', { count: 10 })).toBe('成功更新 10 個現有遊戲，並擴充 BGG 字典');
    });

    it('should return English integration translations', () => {
        const { result } = renderWithProvider('en');
        expect(result.current.t('bgg_import_title')).toBe('BGG Dictionary Import');
    });
});
