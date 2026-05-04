
import React from 'react';
import { useIntegrationTranslation } from '../../i18n/integration';
import { Share } from 'lucide-react';

interface IOSPwaGuideProps {
    onClose: () => void;
}

/**
 * iOS PWA Guide Component
 * Encourages iOS users to add the app to their home screen to avoid 7-day storage clearing.
 */
export const IOSPwaGuide: React.FC<IOSPwaGuideProps> = ({ onClose }) => {
    const { t } = useIntegrationTranslation();

    const handleConfirm = () => {
        // Record last shown time to respect the "once per day" rule
        localStorage.setItem('ios_pwa_guide_last_shown', new Date().toISOString());
        onClose();
    };

    return (
        <div className="fixed inset-0 w-screen h-screen z-[999999] flex items-center justify-center p-5 box-border bg-black/50 animate-in fade-in duration-500 backdrop-blur-sm">
            <div className="bg-surface-bg rounded-3xl p-6 w-[90%] max-w-[400px] text-center shadow-2xl animate-in zoom-in-95 duration-300 border border-surface-border relative">

                <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary mx-auto mb-4">
                    <Share size={32} />
                </div>

                <h3 className="text-xl font-bold text-txt-primary mb-3">
                    {t('guide_ios_pwa_title')}
                </h3>
                
                <p className="text-sm text-txt-muted mb-8 leading-relaxed">
                    {t('guide_ios_pwa_desc')}
                </p>

                {/* Boxed Instruction Area */}
                <div className="bg-surface-bg-alt/50 rounded-2xl p-5 text-left border-2 border-dashed border-surface-border mb-8">
                    <div className="space-y-4">
                        <p className="text-sm text-txt-primary font-bold">
                            {t('guide_ios_pwa_step1')}
                        </p>
                        <p className="text-sm text-txt-primary font-bold">
                            {t('guide_ios_pwa_step2')}
                        </p>
                    </div>
                </div>

                <button 
                    onClick={handleConfirm}
                    className="w-full py-4 bg-brand-primary text-white rounded-2xl font-bold hover:bg-brand-primary-alt transition-colors shadow-lg shadow-brand-primary/20"
                >
                    {t('guide_ios_pwa_close')}
                </button>
            </div>
        </div>
    );
};

/**
 * Utility to check if the guide should be triggered for the current environment and state
 */
export const shouldTriggerIOSPwaGuide = (): boolean => {
    // 1. Check if iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (/Macintosh/.test(navigator.userAgent) && 'ontouchend' in document);
    
    // 2. Check if already in standalone mode (PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone;

    if (!isIOS || isStandalone) return false;

    // 3. Check frequency (once per day)
    const lastShown = localStorage.getItem('ios_pwa_guide_last_shown');
    if (lastShown) {
        const lastDate = new Date(lastShown);
        const now = new Date();
        const diffInHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
        if (diffInHours < 24) return false;
    }

    return true;
};
