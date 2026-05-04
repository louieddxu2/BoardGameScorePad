
import React, { useEffect, useState } from 'react';
import { useIntegrationTranslation } from '../../i18n/integration';

/**
 * In-App Browser Guide Component
 * Detects if the app is opened inside social media apps like LINE, FB, IG, etc.
 * Shows a friendly suggestion modal to open in system browser.
 */
export const InAppBrowserGuide: React.FC = () => {
    const { t } = useIntegrationTranslation();
    const [isInApp, setIsInApp] = useState(false);

    useEffect(() => {
        // 1. Detection logic
        const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
        const inAppKeywords = ['Line', 'FBAV', 'FBAN', 'Instagram', 'MicroMessenger', 'Threads', 'TikTok', 'Twitter', 'Reddit', 'BoardGameGeek'];

        // Check if current browser is an in-app browser
        const detected = inAppKeywords.some(keyword => new RegExp(keyword, 'i').test(ua));
        setIsInApp(detected);
    }, []);

    if (!isInApp) return null;

    return (
        <div className="fixed inset-0 w-screen h-screen z-[999999] flex items-center justify-center p-5 box-border bg-black/50 animate-in fade-in duration-500 backdrop-blur-sm">
            {/* Modal Container - Max width 2/3 of screen */}
            <div className="bg-surface-bg rounded-3xl p-6 w-[80%] max-w-[400px] text-center shadow-2xl animate-in zoom-in-95 duration-300 border border-surface-border relative">

                <div className="text-5xl mb-4">🚀</div>
                <h3 className="text-xl font-bold text-txt-primary mb-6">
                    {t('guide_inapp_title')}
                </h3>

                {/* Boxed Instruction Area */}
                <div className="bg-surface-bg-alt/50 rounded-2xl p-5 text-left border-2 border-dashed border-surface-border">
                    <p className="text-xs font-bold text-brand-primary mb-3 uppercase tracking-wider">
                        {t('guide_inapp_steps_header')}
                    </p>
                    <div className="space-y-4">
                        <p className="text-sm text-txt-primary font-bold">
                            {t('guide_inapp_step1')}
                        </p>
                        <p className="text-sm text-txt-primary font-bold">
                            {t('guide_inapp_step2')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
