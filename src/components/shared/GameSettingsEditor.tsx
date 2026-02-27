
import React, { useState } from 'react';
import { GameTemplate } from '../../types';
import { X, Save, Settings, RotateCcw, Palette, Hash } from 'lucide-react';
import { COLORS } from '../../colors';
import { isColorDark } from '../../utils/ui';
import { useCommonTranslation } from '../../i18n/common';
import { gameSettingsTranslations } from '../../i18n/gameSettings';

interface GameSettingsEditorProps {
    template: GameTemplate;
    onSave: (updates: Partial<GameTemplate>) => void;
    onClose: () => void;
}

const GameSettingsEditor: React.FC<GameSettingsEditorProps> = ({ template, onSave, onClose }) => {
    const { language } = useCommonTranslation();
    const t = (key: keyof typeof gameSettingsTranslations['zh-TW']) => {
        const dict = gameSettingsTranslations[language] || gameSettingsTranslations['zh-TW'];
        return dict[key] || key;
    };

    const [supportedColors, setSupportedColors] = useState<string[]>(template.supportedColors || []);
    const [bggId, setBggId] = useState<string>(template.bggId || '');

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

    return (
        <div className="fixed inset-0 z-[70] bg-slate-950 flex flex-col animate-in slide-in-from-bottom-5">
            {/* Header */}
            <header className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 flex-none z-20">
                <div className="flex items-center gap-2">
                    <div className="bg-slate-800 p-2 rounded text-emerald-500"><Settings size={20} /></div>
                    <div>
                        <h2 className="text-white font-bold text-lg">{t('title')}</h2>
                        <p className="text-xs text-slate-500">{t('subtitle')}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg border border-slate-700">
                    <X size={20} />
                </button>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto no-scrollbar">
                <section className="p-4 space-y-6">

                    {/* General Info Section */}
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 bg-slate-800 p-3 rounded-xl border border-slate-700">
                            <div className="p-2 bg-slate-700 rounded-lg text-slate-400 shrink-0"><Hash size={24} /></div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-200 text-sm">{t('general_section')}</h3>

                                <div className="mt-3">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('bgg_id_label')}</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={bggId}
                                        onChange={(e) => setBggId(e.target.value)}
                                        placeholder="e.g. 13"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white font-mono text-sm focus:border-emerald-500 outline-none"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                                        {t('bgg_id_desc')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Colors Section */}
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 bg-indigo-900/20 p-3 rounded-xl border border-indigo-500/30">
                            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400 shrink-0"><Palette size={24} /></div>
                            <div>
                                <h3 className="font-bold text-indigo-200 text-sm">{t('colors_section')}</h3>
                                <p className="text-xs text-indigo-300/70 mt-1 leading-relaxed whitespace-pre-wrap">
                                    {t('colors_desc')}
                                </p>
                            </div>
                        </div>

                        {/* Preview Area (Selected Order) */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase">{t('colors_selected')}</label>
                                {supportedColors.length > 0 && (
                                    <button
                                        onClick={() => setSupportedColors([])}
                                        className="text-[10px] flex items-center gap-1 text-slate-500 hover:text-slate-300 bg-slate-800 px-2 py-1 rounded-full border border-slate-700 transition-colors"
                                    >
                                        <RotateCcw size={10} /> {t('reset_default')}
                                    </button>
                                )}
                            </div>
                            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 min-h-[80px] flex flex-wrap gap-3 items-center">
                                {supportedColors.length === 0 && (
                                    <span className="text-sm text-slate-600 italic w-full text-center py-2">
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
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t('colors_palette')}</label>

                            <div className="grid grid-cols-6 sm:grid-cols-8 gap-3 justify-items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800">
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
                                                    ? 'border-white ring-2 ring-emerald-500/50 opacity-40 scale-90 grayscale-[0.5]'
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
            <footer className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/80 backdrop-blur-sm border-t border-slate-800 z-20">
                <button
                    onClick={handleSave}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                    <Save size={20} />
                    {t('btn_save')}
                </button>
            </footer>
        </div>
    );
};

export default GameSettingsEditor;
