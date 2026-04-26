
import React, { useState } from 'react';
import { GameTemplate } from '../../types';
import { X, Save, Settings, RotateCcw, Palette, Hash } from 'lucide-react';
import { COLORS } from '../../colors';
import { isColorDark } from '../../utils/ui';
import { useConfirm } from '../../hooks/useConfirm';
import { useCommonTranslation } from '../../i18n/common';
import { gameSettingsTranslations } from '../../i18n/gameSettings';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';

interface GameSettingsEditorProps {
    isOpen: boolean;
    template: GameTemplate;
    onSave: (updates: Partial<GameTemplate>) => void;
    onClose: () => void;
}

const GameSettingsEditor: React.FC<GameSettingsEditorProps> = ({ isOpen, template, onSave, onClose }) => {
    const { language } = useCommonTranslation();
    const t = (key: keyof typeof gameSettingsTranslations['zh-TW']) => {
        const dict = gameSettingsTranslations[language] || gameSettingsTranslations['zh-TW'];
        return dict[key] || key;
    };

    const [supportedColors, setSupportedColors] = useState<string[]>(template.supportedColors || []);
    const [bggId, setBggId] = useState<string>(template.bggId || '');

    const { confirm } = useConfirm();
    const { t: tCommon } = useCommonTranslation();
    const { zIndex } = useModalBackHandler(isOpen, onClose, 'game-settings');

    if (!isOpen) return null;

    const toggleColor = (color: string) => {
        if (supportedColors.includes(color)) {
            setSupportedColors(prev => prev.filter(c => c !== color));
        } else {
            setSupportedColors(prev => [...prev, color]);
        }
    };

    const handleSave = () => {
        onSave({
            supportedColors,
            bggId: bggId.trim()
        });
    };

    const handleResetColorsClick = async () => {
        // 調用全域確認
        const ok = await confirm({
            title: t('reset_default'),
            message: t('reset_colors_confirm_msg'),
            confirmText: tCommon('confirm'),
            isDangerous: true
        });

        if (ok) {
            setSupportedColors([]);
        }
    };


    return (
        <div 
            className="fixed inset-0 bg-app-bg-deep flex flex-col animate-in slide-in-from-bottom-5"
            style={{ zIndex }}
        >
            {/* Header */}
            <header className="flex items-center justify-between p-4 bg-app-bg border-b border-surface-border flex-none z-20">
                <div className="flex items-center gap-2">
                    <div className="bg-surface-bg p-2 rounded text-brand-primary"><Settings size={20} /></div>
                    <div>
                        <h2 className="text-txt-title font-bold text-lg">{t('title')}</h2>
                        <p className="text-xs text-txt-muted">{t('subtitle')}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 text-txt-secondary hover:text-txt-title bg-surface-bg rounded-lg border border-surface-border">
                    <X size={20} />
                </button>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto no-scrollbar">
                <section className="p-4 space-y-6">

                    {/* General Info Section */}
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 bg-surface-bg p-3 rounded-xl border border-surface-border">
                            <div className="p-2 bg-surface-hover rounded-lg text-txt-secondary shrink-0"><Hash size={24} /></div>
                            <div className="flex-1">
                                <h3 className="font-bold text-txt-primary text-sm">{t('general_section')}</h3>

                                <div className="mt-3">
                                    <label className="block text-xs font-bold text-txt-muted uppercase mb-1">{t('bgg_id_label')}</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={bggId}
                                        onChange={(e) => setBggId(e.target.value)}
                                        placeholder="e.g. 13"
                                        className="w-full bg-app-bg-deep border border-surface-border rounded-lg p-2 text-txt-primary font-mono text-sm focus:border-brand-primary outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Colors Section */}
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 bg-brand-secondary/10 p-3 rounded-xl border border-brand-secondary/30">
                            <div className="p-2 bg-brand-secondary/20 rounded-lg text-brand-secondary shrink-0"><Palette size={24} /></div>
                            <div>
                                <h3 className="font-bold text-brand-secondary text-sm">{t('colors_section')}</h3>
                                <p className="text-xs text-txt-secondary mt-1 leading-relaxed whitespace-pre-wrap">
                                    {t('colors_desc')}
                                </p>
                            </div>
                        </div>

                        {/* Preview Area (Selected Order) */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold text-txt-muted uppercase">{t('colors_selected')}</label>
                                {supportedColors.length > 0 && (
                                    <button
                                        onClick={handleResetColorsClick}
                                        className="text-[10px] flex items-center gap-1 text-txt-muted hover:text-txt-primary bg-surface-bg px-2 py-1 rounded-full border border-surface-border transition-colors"
                                    >
                                        <RotateCcw size={10} /> {t('reset_default')}
                                    </button>
                                )}
                            </div>
                            <div className="bg-app-bg-deep border border-surface-border rounded-xl p-4 min-h-[80px] flex flex-wrap gap-3 items-center">
                                {supportedColors.length === 0 && (
                                    <span className="text-sm text-txt-muted italic w-full text-center py-2">
                                        {t('reset_default')} {t('colors_auto_assign')}
                                    </span>
                                )}
                                {supportedColors.map((c, i) => (
                                    <button
                                        key={c}
                                        onClick={() => toggleColor(c)}
                                        className="w-10 h-10 rounded-full shadow-lg border-2 border-white/20 flex items-center justify-center relative animate-in zoom-in duration-200 group hover:scale-110 transition-transform"
                                        style={{ backgroundColor: c }}
                                    >
                                        <span className={`text-sm font-bold font-mono ${isColorDark(c) ? 'text-white/90' : 'text-black/60'}`}>
                                            {i + 1}
                                        </span>
                                        <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <X size={16} className="text-white" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Palette Area */}
                        <div>
                            <label className="block text-xs font-bold text-txt-muted uppercase mb-2">{t('colors_palette')}</label>

                            <div className="grid grid-cols-6 sm:grid-cols-8 gap-3 justify-items-center bg-app-bg-deep/50 p-4 rounded-xl border border-surface-border">
                                {COLORS.map(c => {
                                    const isSelected = supportedColors.includes(c);
                                    const selectedIndex = supportedColors.indexOf(c) + 1;
                                    const isDark = isColorDark(c);

                                    return (
                                        <button
                                            key={c}
                                            onClick={() => toggleColor(c)}
                                            className={`w-10 h-10 rounded-full shadow-sm border-2 transition-all flex items-center justify-center relative
                                          ${isSelected
                                                    ? 'border-white ring-2 ring-brand-primary/50 opacity-40 scale-90 grayscale-[0.5]'
                                                    : 'border-transparent opacity-100 hover:scale-110 active:scale-95'
                                                }
                                          ${isDark && !isSelected ? 'ring-1 ring-white/10' : ''}
                                      `}
                                            style={{ backgroundColor: c }}
                                        >
                                            {isSelected && (
                                                <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-black'}`}>
                                                    {selectedIndex}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                </section>
            </main>

            {/* Footer */}
            <footer className="p-4 bg-app-bg border-t border-surface-border flex-none mt-auto">
                <button
                    onClick={handleSave}
                    className="w-full py-3 bg-brand-primary-deep hover:bg-brand-primary text-white font-bold rounded-xl shadow-lg shadow-brand-primary/30 flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                    <Save size={20} />
                    {t('btn_save')}
                </button>
            </footer>
        </div>
    );
};

export default GameSettingsEditor;
