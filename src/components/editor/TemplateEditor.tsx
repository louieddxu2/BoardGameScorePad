
import React, { useState, useEffect } from 'react';
import { GameTemplate, ScoreColumn } from '../../types';
import { Save, ArrowLeft, Layers, Minus, Plus, Image as ImageIcon, LayoutPanelLeft, LayoutTemplate } from 'lucide-react';
import { COLORS } from '../../colors';
import { useToast } from '../../hooks/useToast';
import PhotoScanner from '../scanner/PhotoScanner';
import TextureMapper from './TextureMapper';
import { generateId } from '../../utils/idGenerator';
import { imageService } from '../../services/imageService';
import { DATA_LIMITS } from '../../dataLimits';
import { useTemplateEditorTranslation } from '../../i18n/template_editor';

interface TemplateEditorProps {
    onSave: (template: GameTemplate) => void;
    onCancel: () => void;
    initialTemplate?: GameTemplate;
    allTemplates: GameTemplate[];
    initialName?: string; // New Prop
}

// Helper interface for Scanner state restoration
interface ScannerState {
    raw: string;
    points: { x: number; y: number }[];
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ onSave, onCancel, initialTemplate, allTemplates, initialName }) => {
    const { t } = useTemplateEditorTranslation();
    const [name, setName] = useState(t('tmpl_default_name'));
    const [columnCount, setColumnCount] = useState(5);

    // State Machine for Scanner Flow
    // 'scanner' state is implicit if showScanner is true.
    // 'mapper' state is implicit if rectifiedImage is present.
    const [showScanner, setShowScanner] = useState(false);

    // Data State
    const [scannerState, setScannerState] = useState<ScannerState | null>(null); // Stores raw image & points
    const [rectifiedImage, setRectifiedImage] = useState<string | null>(null); // Stores final cropped image URL for Mapper
    const [rectifiedBlob, setRectifiedBlob] = useState<Blob | null>(null); // Stores the actual Blob to save
    const [rectifiedAspectRatio, setRectifiedAspectRatio] = useState<number>(1); // [New] Store aspect ratio

    const { showToast } = useToast();

    useEffect(() => {
        if (initialTemplate) {
            setName(initialTemplate.name);
            setColumnCount(initialTemplate.columns.length);
        } else if (initialName) {
            // If no template but we have an initial name (from search), use it
            setName(initialName);
        }
    }, [initialTemplate, initialName]);

    const adjustCount = (delta: number) => {
        // Allow 0 columns for "Simple Counter" mode
        setColumnCount(prev => Math.max(0, Math.min(DATA_LIMITS.EDITOR.MAX_COLUMNS, prev + delta)));
    };

    const handleSave = () => {
        if (!name.trim()) {
            showToast({ message: t('tmpl_save_warn'), type: 'warning' });
            return;
        }

        let newColumns: ScoreColumn[] = [];

        if (initialTemplate) {
            const existing = initialTemplate.columns;
            if (columnCount <= existing.length) {
                newColumns = existing.slice(0, columnCount);
            } else {
                const addedCount = columnCount - existing.length;
                const added = Array.from({ length: addedCount }).map((_, i) => ({
                    id: generateId(DATA_LIMITS.ID_LENGTH.DEFAULT), // Short ID for new columns
                    name: t('tmpl_col_default_name', { n: existing.length + i + 1 }),
                    isScoring: true,
                    formula: 'a1',
                    inputType: 'keypad' as const,
                    rounding: 'none' as const,
                }));
                newColumns = [...existing, ...added];
            }
        } else {
            newColumns = Array.from({ length: columnCount }).map((_, i) => ({
                id: generateId(DATA_LIMITS.ID_LENGTH.DEFAULT), // Short ID for columns
                name: t('tmpl_col_default_name', { n: i + 1 }),
                isScoring: true,
                formula: 'a1',
                inputType: 'keypad' as const,
                rounding: 'none' as const,
                color: COLORS[i % COLORS.length]
            }));
        }

        const template: GameTemplate = {
            id: initialTemplate ? initialTemplate.id : generateId(), // Default 36 chars (UUID)
            name: name.trim(),
            description: initialTemplate?.description || (columnCount === 0 ? t('tmpl_desc_simple') : t('tmpl_desc_columns', { count: columnCount })),
            bggId: initialTemplate?.bggId || '', // [New] Preserve or Init BGG ID
            columns: newColumns,
            createdAt: initialTemplate ? initialTemplate.createdAt : Date.now(),
        };

        onSave(template);
    };

    const handleCreateImageBoard = () => {
        if (!name.trim()) {
            showToast({ message: t('tmpl_scan_warn'), type: 'warning' });
            return;
        }
        // If we have previous scanner state, we reuse it, otherwise clean slate
        setShowScanner(true);
    };

    const handleScannerConfirm = (result: { processed: string, raw: string, points: { x: number, y: number }[], blob?: Blob, aspectRatio: number }) => {
        if (!name.trim()) {
            showToast({ message: t('tmpl_scan_warn'), type: 'warning' });
            return;
        }
        // Save state for potential restoration
        setScannerState({ raw: result.raw, points: result.points });
        setRectifiedImage(result.processed);
        setRectifiedAspectRatio(result.aspectRatio); // Save ratio
        if (result.blob) {
            setRectifiedBlob(result.blob);
        }
        setShowScanner(false);
    };

    const handleMapperCancel = () => {
        // Go back to scanner
        setRectifiedImage(null);
        setShowScanner(true);
    };

    const handleTextureSave = async (newTemplate: GameTemplate) => {
        try {
            if (rectifiedBlob) {
                const savedImg = await imageService.saveImage(rectifiedBlob, newTemplate.id, 'template');
                newTemplate.imageId = savedImg.id;
                newTemplate.hasImage = true;
            }
            // Note: bggId is handled inside templateBuilder via importedTemplate logic
            onSave(newTemplate);
            // Clear all temp states
            setRectifiedImage(null);
            setRectifiedBlob(null);
            setScannerState(null);
        } catch (e) {
            console.error("Failed to save texture image", e);
            showToast({ message: t('tmpl_img_save_fail'), type: 'error' });
        }
    };

    // --- Conditional Renders ---

    if (rectifiedImage) {
        return (
            <TextureMapper
                imageSrc={rectifiedImage}
                initialName={name.trim()}
                initialColumnCount={columnCount}
                allTemplates={allTemplates}
                onSave={handleTextureSave}
                onCancel={handleMapperCancel}
                aspectRatio={rectifiedAspectRatio} // Pass ratio to mapper
                initialTemplate={initialTemplate} // [New] Pass full template to mapper to preserve BGG ID
            />
        );
    }

    if (showScanner) {
        return (
            <PhotoScanner
                onClose={() => setShowScanner(false)}
                onConfirm={handleScannerConfirm}
                initialImage={scannerState?.raw}
                initialPoints={scannerState?.points}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-100 relative overflow-hidden">
            {/* Header */}
            <div className="flex-none bg-slate-800 p-4 shadow-md flex items-center justify-between border-b border-slate-700">
                <button onClick={onCancel} className="p-2 hover:bg-slate-700 rounded-full text-slate-400">
                    <ArrowLeft size={24} />
                </button>
                <h2 className="text-xl font-bold">{initialTemplate ? t('tmpl_edit_title') : t('tmpl_new_title')}</h2>
                <div className="w-10"></div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
                <div className="flex flex-col items-center p-6 space-y-8 min-h-full">

                    <div className="w-full max-w-md space-y-6">

                        {/* Common Input: Name */}
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider">
                                {t('tmpl_name_label')}
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                placeholder={t('tmpl_name_ph')}
                                className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-4 text-xl font-bold text-white focus:border-emerald-500 focus:outline-none placeholder-slate-600 transition-colors"
                                autoFocus
                            />
                        </div>

                        {/* Manual Mode Content */}
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    {t('tmpl_col_count_label')} <span className="text-xs font-normal text-slate-500">{t('tmpl_no_total')}</span>
                                </label>

                                <div className="flex items-center gap-4 bg-slate-800 p-3 rounded-xl border border-slate-700">
                                    <button
                                        onClick={() => adjustCount(-1)}
                                        className="w-14 h-14 rounded-lg bg-slate-700 hover:bg-slate-600 active:scale-95 transition-all flex items-center justify-center text-white border border-slate-600"
                                    >
                                        <Minus size={24} />
                                    </button>

                                    <div className="flex-1 flex flex-col items-center justify-center">
                                        <span className="text-4xl font-black font-mono text-emerald-400">{columnCount}</span>
                                        <span className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                            <Layers size={12} /> {t('tmpl_col_unit')}
                                        </span>
                                    </div>

                                    <button
                                        onClick={() => adjustCount(1)}
                                        className="w-14 h-14 rounded-lg bg-slate-700 hover:bg-slate-600 active:scale-95 transition-all flex items-center justify-center text-white border border-slate-600"
                                    >
                                        <Plus size={24} />
                                    </button>
                                </div>
                                {columnCount === 0 && (
                                    <p className="text-center text-xs text-emerald-400 mt-1">
                                        {t('tmpl_simple_mode')}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                                <button
                                    onClick={handleCreateImageBoard}
                                    className="w-full py-4 bg-sky-800 hover:bg-sky-700 text-white text-base font-bold rounded-xl shadow-lg shadow-sky-900/50 flex flex-col items-center justify-center gap-2 transition-transform active:scale-95"
                                >
                                    <ImageIcon size={24} /> {t('tmpl_btn_img')}
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-base font-bold rounded-xl shadow-lg shadow-emerald-900/50 flex flex-col items-center justify-center gap-2 transition-transform active:scale-95"
                                >
                                    <LayoutTemplate size={24} /> {t('tmpl_btn_std')}
                                </button>
                            </div>

                            <p className="text-center text-xs text-slate-500">
                                {t('tmpl_hint')}
                            </p>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default TemplateEditor;