
import React, { useEffect, useState } from 'react';
import { useIntegrationTranslation } from '../../i18n/integration';
import { X } from 'lucide-react';

/**
 * In-App Browser Guide Component
 * Detects if the app is opened inside social media apps like LINE, FB, IG, etc.
 * Shows a friendly suggestion modal to open in system browser.
 */
export const InAppBrowserGuide: React.FC = () => {
    const { t } = useIntegrationTranslation();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // 1. Detection logic
        const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
        const inAppKeywords = ['Line', 'FBAV', 'FBAN', 'Instagram', 'MicroMessenger', 'Threads'];

        // Check if current browser is an in-app browser
        const isInApp = inAppKeywords.some(keyword => new RegExp(keyword, 'i').test(ua));

        // [Requirement] Only show once per session or if detected
        const hasDismissed = sessionStorage.getItem('dismissed_inapp_guide');

        if (isInApp && !hasDismissed) {
            setIsVisible(true);
        }
    }, []);

    const handleDismiss = () => {
        setIsVisible(false);
        sessionStorage.setItem('dismissed_inapp_guide', 'true');
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 w-screen h-screen z-[999999] flex items-center justify-center p-5 box-border bg-black/30 animate-in fade-in duration-500">
            {/* Modal Container - Max width 2/3 of screen */}
            <div className="bg-surface-bg rounded-3xl p-6 w-[66%] max-w-[400px] text-center shadow-2xl animate-in zoom-in-95 duration-300 border border-surface-border relative">

                {/* Close Button (X) */}
                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-surface-bg-alt text-txt-muted transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="text-5xl mb-4">🚀</div>
                <h3 className="text-xl font-bold text-txt-primary mb-3">
                    {t('guide_inapp_title')}
                </h3>
                <p className="text-base text-txt-primary font-medium mb-8">
                    {t('guide_inapp_desc')}
                </p>

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

                <button 
                    onClick={handleDismiss}
                    className="mt-8 text-xs text-txt-muted hover:text-txt-primary transition-colors underline underline-offset-4"
                >
                    {t('guide_inapp_close')}
                </button>
            </div>
        </div>
    );
};
