

import React, { useState, useEffect } from 'react';
import { HistoryRecord, ScoringRule, SavedListItem, GameTemplate } from '../../../types';
import { X, Save, Calendar, MapPin, FileText, Settings, Database, Clock, Trophy, Hash, CopyPlus } from 'lucide-react';
import { generateId } from '../../../utils/idGenerator';
import { relationshipService } from '../../../services/relationshipService'; // Import Service
import { DATA_LIMITS } from '../../../dataLimits';
import { getRecordScoringRule, getRecordBggId } from '../../../utils/historyUtils';

import { useHistoryTranslation } from '../../../i18n/history';

interface HistorySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: HistoryRecord;
    onSave: (updatedRecord: HistoryRecord) => Promise<void>; // Make async
    locationHistory?: SavedListItem[];
    onRestoreTemplate: (template: GameTemplate) => Promise<void>;
}

// Helper: Convert timestamp to HTML input datetime-local string (YYYY-MM-DDThh:mm)
const toDatetimeInput = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    // Adjust for timezone offset to show local time in input
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
    return localISOTime;
};

// Helper: Convert HTML input string back to timestamp
const fromDatetimeInput = (val: string) => {
    return new Date(val).getTime();
};

const HistorySettingsModal: React.FC<HistorySettingsModalProps> = ({ isOpen, onClose, record, onSave, locationHistory = [], onRestoreTemplate }) => {
    const [formData, setFormData] = useState<HistoryRecord | null>(null);
    const [showRawInspector, setShowRawInspector] = useState(false);
    const { t } = useHistoryTranslation();

    const SCORING_OPTIONS: { value: ScoringRule, label: string }[] = [
        { value: 'HIGHEST_WINS', label: t('history_mode_highest') },
        { value: 'LOWEST_WINS', label: t('history_mode_lowest') },
        { value: 'COOP', label: t('history_mode_coop') },
        { value: 'COMPETITIVE_NO_SCORE', label: t('history_mode_comp_no_score') },
        { value: 'COOP_NO_SCORE', label: t('history_mode_coop_no_score') },
    ];

    // Initialize form data when modal opens
    useEffect(() => {
        if (isOpen && record) {
            // Deep clone to safely edit
            const initialForm = JSON.parse(JSON.stringify(record));

            // Ensure scoringRule is populated from fallback if missing (migration)
            // Note: getRecordScoringRule handles the fallback logic centrally
            if (!initialForm.scoringRule) {
                initialForm.scoringRule = getRecordScoringRule(record);
            }

            // Ensure bggId is populated if missing
            if (!initialForm.bggId) {
                initialForm.bggId = getRecordBggId(record) || '';
            }

            setFormData(initialForm);
        }
    }, [isOpen, record]);

    if (!isOpen || !formData) return null;

    const handleFieldChange = (key: keyof HistoryRecord, value: any) => {
        setFormData(prev => prev ? ({ ...prev, [key]: value }) : null);
    };

    const handleSave = async () => {
        if (formData) {
            // [AUTO-LINK LOGIC] for Locations
            // If user typed a location, try to match it with history to get UUID
            let finalRecord = { ...formData };

            if (finalRecord.location) {
                const trimmedLoc = finalRecord.location.trim();
                // Check if name matches any existing record (case-insensitive)
                const matched = locationHistory.find(l => l.name.toLowerCase() === trimmedLoc.toLowerCase());

                if (matched && matched.meta?.uuid) {
                    // Link ID found!
                    finalRecord.locationId = matched.meta.uuid;
                } else {
                    // [New] No match in history -> Generate NEW UUID instantly
                    // This ensures the record has a linked ID even if it's the first time
                    finalRecord.locationId = generateId(DATA_LIMITS.ID_LENGTH.DEFAULT);
                }
            } else {
                // Location cleared
                finalRecord.locationId = undefined;
            }

            // Also ensure BGG ID in snapshot matches (consistency)
            if (finalRecord.bggId) {
                if (!finalRecord.snapshotTemplate) {
                    // Should technically exist, but guard against weird state
                    finalRecord.snapshotTemplate = {} as any;
                }
                finalRecord.snapshotTemplate.bggId = finalRecord.bggId;
            }

            // Also ensure defaultScoringRule in snapshot matches (consistency)
            if (finalRecord.scoringRule) {
                if (!finalRecord.snapshotTemplate) {
                    finalRecord.snapshotTemplate = {} as any;
                }
                finalRecord.snapshotTemplate.defaultScoringRule = finalRecord.scoringRule;
            }

            // 1. Save changes to DB
            await onSave(finalRecord);

            // 2. Trigger Relationship Service (checking for location patch)
            // Note: processGameEnd handles its own checks (log table) to avoid redundant processing
            relationshipService.processGameEnd(finalRecord).catch(console.error);

            onClose();
        }
    };

    const handleRestore = async () => {
        if (!formData || !formData.snapshotTemplate) return;

        const newId = generateId();
        const newTemplate: GameTemplate = {
            ...formData.snapshotTemplate,
            id: newId,
            name: `${formData.gameName} ${t('history_restore_suffix')}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastSyncedAt: undefined,
            cloudImageId: undefined,
            sourceTemplateId: undefined, // Detach
            // Apply current form values
            bggId: formData.bggId,
            defaultScoringRule: formData.scoringRule
        };

        await onRestoreTemplate(newTemplate);
        onClose();
    };

    // --- Dynamic Field Renderer ---
    // This analyzes the data structure and renders appropriate inputs
    const renderDynamicFields = () => {
        // Define known priority fields that we want to show with specific UI
        const priorityKeys = ['gameName', 'location', 'startTime', 'endTime', 'note', 'scoringRule', 'bggId'];
        const hiddenKeys = ['id', 'templateId', 'players', 'winnerIds', 'snapshotTemplate', 'locationId', 'bgStatsId', 'photoCloudIds', 'photos', 'cloudFolderId'];

        // 1. Render Priority Fields (Specific UI)
        return (
            <div className="space-y-4">
                {/* Game Name */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                        <Trophy size={12} /> {t('history_game_name')}
                    </label>
                    <input
                        type="text"
                        value={formData.gameName}
                        onChange={(e) => handleFieldChange('gameName', e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 outline-none font-bold"
                    />
                </div>

                {/* BGG ID (New Requirement) */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                        <Hash size={12} /> {t('history_bgg_id_label')}
                    </label>
                    <input
                        type="text"
                        value={formData.bggId || ''}
                        onChange={(e) => handleFieldChange('bggId', e.target.value)}
                        placeholder={t('history_bgg_id_ph')}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 outline-none font-mono"
                    />
                    <p className="text-[10px] text-slate-500 px-1">{t('history_bgg_id_note')}</p>
                </div>

                {/* Time Section */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                            <Clock size={12} /> {t('history_start_time')}
                        </label>
                        <input
                            type="datetime-local"
                            value={toDatetimeInput(formData.startTime)}
                            onChange={(e) => handleFieldChange('startTime', fromDatetimeInput(e.target.value))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-sm text-white focus:border-emerald-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                            <Clock size={12} /> {t('history_end_time')}
                        </label>
                        <input
                            type="datetime-local"
                            value={toDatetimeInput(formData.endTime)}
                            onChange={(e) => handleFieldChange('endTime', fromDatetimeInput(e.target.value))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-sm text-white focus:border-emerald-500 outline-none"
                        />
                    </div>
                </div>

                {/* Location */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                        <MapPin size={12} /> {t('history_location')}
                    </label>
                    <input
                        type="text"
                        value={formData.location || ''}
                        onChange={(e) => handleFieldChange('location', e.target.value)}
                        placeholder={t('history_location_ph')}
                        list="location-list" // Link to datalist
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 outline-none"
                    />
                    <datalist id="location-list">
                        {locationHistory.map((loc, i) => (
                            <option key={i} value={loc.name} />
                        ))}
                    </datalist>
                </div>

                {/* Scoring Rule (Top-level) */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                        <Settings size={12} /> {t('history_rule')}
                    </label>
                    <select
                        value={formData.scoringRule}
                        onChange={(e) => handleFieldChange('scoringRule', e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 outline-none appearance-none"
                    >
                        {SCORING_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <p className="text-[10px] text-slate-500 px-1">{t('history_rule_warn')}</p>
                </div>

                {/* Note */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                        <FileText size={12} /> {t('history_note')}
                    </label>
                    <textarea
                        value={formData.note || ''}
                        onChange={(e) => handleFieldChange('note', e.target.value)}
                        placeholder={t('history_note_ph')}
                        rows={4}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 outline-none resize-none"
                    />
                </div>

                {/* Auto-Detected Extra Fields (Dynamic Reflection) */}
                {Object.keys(formData).map(key => {
                    if (priorityKeys.includes(key) || hiddenKeys.includes(key)) return null;
                    const val = (formData as any)[key];
                    const type = typeof val;

                    if (type === 'string' || type === 'number') {
                        return (
                            <div key={key} className="space-y-1 animate-in fade-in">
                                <label className="text-xs font-bold text-indigo-400 uppercase flex items-center gap-1">
                                    <Database size={12} /> {key} (Auto-Detected)
                                </label>
                                <input
                                    type={type === 'number' ? 'number' : 'text'}
                                    value={val}
                                    onChange={(e) => handleFieldChange(key as keyof HistoryRecord, type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                                    className="w-full bg-slate-800 border border-indigo-500/30 rounded-xl p-3 text-white focus:border-indigo-500 outline-none"
                                />
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
        );
    };

    return (
        <div
            className="modal-backdrop z-[100] animate-in fade-in duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-800 flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex-none bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between rounded-t-2xl">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Settings size={20} className="text-emerald-500" />
                        {t('history_settings_title')}
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-700">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 no-scrollbar">
                    {renderDynamicFields()}

                    {/* Raw Data Toggle */}
                    <div className="mt-8 pt-4 border-t border-slate-800">
                        <button
                            onClick={() => setShowRawInspector(!showRawInspector)}
                            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors w-full justify-center py-2"
                        >
                            <Database size={12} />
                            {showRawInspector ? t('history_hide_raw') : t('history_raw_data')}
                        </button>

                        {showRawInspector && (
                            <div className="mt-2 bg-black/30 p-3 rounded-lg border border-slate-700 overflow-x-auto">
                                <pre className="text-[10px] text-slate-400 font-mono leading-relaxed">
                                    {JSON.stringify(formData, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>

                    {/* Restore Section (Moved to Bottom of Content) */}
                    <div className="mt-4 pt-4 border-t border-slate-800">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                            {t('history_advanced_ops')}
                        </h4>
                        <button
                            onClick={handleRestore}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all active:scale-95 group"
                        >
                            <CopyPlus size={18} className="group-hover:scale-110 transition-transform" />
                            {t('history_restore_btn')}
                        </button>
                        <p className="text-[10px] text-slate-500 mt-2 text-center">
                            {t('history_restore_note')}
                        </p>
                    </div>
                </div>

                {/* Footer - Only Save Button */}
                <div className="flex-none p-4 bg-slate-800 border-t border-slate-700 rounded-b-2xl">
                    <button
                        onClick={handleSave}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2 transition-transform active:scale-95"
                    >
                        <Save size={18} />
                        {t('history_save_btn')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HistorySettingsModal;