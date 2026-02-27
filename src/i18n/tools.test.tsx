import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { LanguageProvider, Language } from '../i18n';
import { useToolsTranslation } from './tools';

describe('useToolsTranslation', () => {
    const renderWithProvider = (lang: Language = 'zh-TW') => {
        vi.stubGlobal('localStorage', {
            getItem: vi.fn(() => lang),
            setItem: vi.fn(),
        });
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <LanguageProvider>{children}</LanguageProvider>
        );
        return renderHook(() => useToolsTranslation(), { wrapper });
    };

    it('should return tools translations', () => {
        const { result } = renderWithProvider('zh-TW');
        expect(result.current.t('tools_title')).toBe('桌遊工具箱');
    });

    it('should return English tools translations', () => {
        const { result } = renderWithProvider('en');
        expect(result.current.t('tools_title')).toBe('Tools');
    });
});
