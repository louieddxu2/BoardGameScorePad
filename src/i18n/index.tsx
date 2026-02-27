
import React, { createContext, useContext, useState, ReactNode } from 'react';

// --- 1. 型別定義 ---
export type Language = 'zh-TW' | 'en';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
}

// --- 2. Context & Provider ---
export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // 優先讀取 LocalStorage，否則偵測瀏覽器語言，預設 zh-TW
    const [language, setLanguageState] = useState<Language>(() => {
        const saved = localStorage.getItem('app_language');
        if (saved === 'en' || saved === 'zh-TW') return saved;
        const browserLang = navigator.language;
        return browserLang.startsWith('zh') ? 'zh-TW' : 'en';
    });

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('app_language', lang);
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
};

// --- 3. Custom Hook ---
export const useTranslation = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useTranslation must be used within a LanguageProvider');
    }
    return context;
};
