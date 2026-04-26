

import React, { useState, useEffect } from 'react';
import { HistoryRecord, ScoringRule, SavedListItem, GameTemplate } from '../../../types';
import { X, Save, Calendar, MapPin, FileText, Settings, Database, Clock, Trophy, Hash, CopyPlus } from 'lucide-react';
import { generateId } from '../../../utils/idGenerator';
import { relationshipService } from '../../../services/relationshipService'; // Import Service
import { DATA_LIMITS } from '../../../dataLimits';
import { getRecordScoringRule, getRecordBggId } from '../../../utils/historyUtils';
import { calculateWinners } from '../../../utils/templateUtils';

import { useModalBackHandler } from '../../../hooks/useModalBackHandler';
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

    const { zIndex } = useModalBackHandler(isOpen, onClose, 'history-settings');

    if (!isOpen || !formData) return null;

    const handleFieldChange = (key: keyof HistoryRecord, value: any) => {
        setFormData(prev => prev ? ({ ...prev, [key]: value }) : null);
    };

    const handleSave = async () => {
        if (formData) {
            try {
                let finalRecord = { ...formData };

                // [AUTO-LINK LOGIC] for Locations
                if (finalRecord.location) {
                    const trimmedLoc = finalRecord.location.trim();
                    const matched = locationHistory.find(l => l.name.toLowerCase() === trimmedLoc.toLowerCase());

                    if (matched && matched.meta?.uuid) {
                        finalRecord.locationId = matched.meta.uuid;
                    } else {
                        finalRecord.locationId = generateId(DATA_LIMITS.ID_LENGTH.DEFAULT);
                    }
                } else {
                    finalRecord.locationId = undefined;
                }

                // Consistency sync for Snapshot
                if (finalRecord.snapshotTemplate && Array.isArray(finalRecord.snapshotTemplate.columns)) {
                    if (finalRecord.bggId) finalRecord.snapshotTemplate.bggId = finalRecord.bggId;
                    if (finalRecord.scoringRule) finalRecord.snapshotTemplate.defaultScoringRule = finalRecord.scoringRule;
                }

                // Recalculate winners only if players exist (Safeguard)
                if (Array.isArray(finalRecord.players) && finalRecord.scoringRule) {
                    finalRecord.winnerIds = calculateWinners(finalRecord.players, finalRecord.scoringRule);
                }

                // 1. Save changes to DB
                onSave(finalRecord);

                // 2. Trigger Relationship Service (Background)
                relationshipService.processGameEnd(finalRecord).catch(console.error);

                onClose();
            } catch (error) {
                console.error("Save failed in Settings Modal:", error);
                onClose(); // Force close even on error to prevent UI hang
            }
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
                    <label className="text-xs font-bold text-txt-muted uppercase flex items-center gap-1">
                        <Trophy size={12} /> {t('history_game_name')}
                    </label>
                    <input
                        type="text"
                        value={formData.gameName}
                        onChange={(e) => handleFieldChange('gameName', e.target.value)}
                        className="w-full bg-modal-bg-elevated border border-modal-border rounded-xl p-3 text-txt-primary focus:border-brand-primary outline-none font-bold"
                    />
                </div>

                {/* BGG ID (New Requirement) */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-txt-muted uppercase flex items-center gap-1">
                        <Hash size={12} /> {t('history_bgg_id_label')}
                    </label>
                    <input
                        type="text"
                        value={formData.bggId || ''}
                        onChange={(e) => handleFieldChange('bggId', e.target.value)}
                        placeholder={t('history_bgg_id_ph')}
                        className="w-full bg-modal-bg-elevated border border-modal-border rounded-xl p-3 text-txt-primary focus:border-brand-primary outline-none font-mono"
                    />
                    <p className="text-[10px] text-txt-muted px-1">{t('history_bgg_id_note')}</p>
                </div>

                {/* Time Section */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-txt-muted uppercase flex items-center gap-1">
                            <Clock size={12} /> {t('history_start_time')}
                        </label>
                        <input
                            type="datetime-local"
                            value={toDatetimeInput(formData.startTime)}
                            onChange={(e) => handleFieldChange('startTime', fromDatetimeInput(e.target.value))}
                            className="w-full bg-modal-bg-elevated border border-modal-border rounded-xl p-2 text-sm text-txt-primary focus:border-brand-primary outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-txt-muted uppercase flex items-center gap-1">
                            <Clock size={12} /> {t('history_end_time')}
                        </label>
                        <input
                            type="datetime-local"
                            value={toDatetimeInput(formData.endTime)}
                            onChange={(e) => handleFieldChange('endTime', fromDatetimeInput(e.target.value))}
                            className="w-full bg-modal-bg-elevated border border-modal-border rounded-xl p-2 text-sm text-txt-primary focus:border-brand-primary outline-none"
                        />
                    </div>
                </div>

                {/* Location */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-txt-muted uppercase flex items-center gap-1">
                        <MapPin size={12} /> {t('history_location')}
                    </label>
                    <input
                        type="text"
                        value={formData.location || ''}
                        onChange={(e) => handleFieldChange('location', e.target.value)}
                        placeholder={t('history_location_ph')}
                        list="location-list" // Link to datalist
                        className="w-full bg-modal-bg-elevated border border-modal-border rounded-xl p-3 text-txt-primary focus:border-brand-primary outline-none"
                    />
                    <datalist id="location-list">
                        {locationHistory.map((loc, i) => (
                            <option key={i} value={loc.name} />
                        ))}
                    </datalist>
                </div>

                {/* Scoring Rule (Top-level) */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-txt-muted uppercase flex items-center gap-1">
                        <Settings size={12} /> {t('history_rule')}
                    </label>
                    <select
                        value={formData.scoringRule}
                        onChange={(e) => handleFieldChange('scoringRule', e.target.value)}
                        className="w-full bg-modal-bg-elevated border border-modal-border rounded-xl p-3 text-txt-primary focus:border-brand-primary outline-none appearance-none"
                    >
                        {SCORING_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <p className="text-[10px] text-txt-muted px-1">{t('history_rule_warn')}</p>
                </div>

                {/* Note */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-txt-muted uppercase flex items-center gap-1">
                        <FileText size={12} /> {t('history_note')}
                    </label>
                    <textarea
                        value={formData.note || ''}
                        onChange={(e) => handleFieldChange('note', e.target.value)}
                        placeholder={t('history_note_ph')}
                        rows={4}
                        className="w-full bg-modal-bg-elevated border border-modal-border rounded-xl p-3 text-txt-primary focus:border-brand-primary outline-none resize-none"
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
                                <label className="text-xs font-bold text-brand-secondary uppercase flex items-center gap-1">
                                    <Database size={12} /> {key} (Auto-Detected)
                                </label>
                                <input
                                    type={type === 'number' ? 'number' : 'text'}
                                    value={val}
                                    onChange={(e) => handleFieldChange(key as keyof HistoryRecord, type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                                    className="w-full bg-modal-bg-elevated border border-brand-secondary/30 rounded-xl p-3 text-txt-primary focus:border-brand-secondary outline-none"
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
            className="modal-backdrop animate-in fade-in duration-200"
            style={{ zIndex }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="bg-modal-bg w-full max-w-lg rounded-2xl shadow-2xl border border-modal-border flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex-none bg-modal-header p-4 border-b border-modal-border flex items-center justify-between rounded-t-2xl">
                    <h3 className="text-lg font-bold text-txt-title flex items-center gap-2">
                        <Settings size={20} className="text-brand-primary" />
                        {t('history_settings_title')}
                    </h3>
                    <button onClick={onClose} className="text-txt-muted hover:text-txt-primary p-1 rounded-lg hover:bg-surface-hover">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 no-scrollbar">
                    {renderDynamicFields()}

                    {/* Raw Data Toggle */}
                    <div className="mt-8 pt-4 border-t border-modal-border">
                        <button
                            onClick={() => setShowRawInspector(!showRawInspector)}
                            className="flex items-center gap-2 text-xs text-txt-muted hover:text-txt-primary transition-colors w-full justify-center py-2"
                        >
                            <Database size={12} />
                            {showRawInspector ? t('history_hide_raw') : t('history_raw_data')}
                        </button>

                        {showRawInspector && (
                            <div className="mt-2 bg-black/30 p-3 rounded-lg border border-modal-border overflow-x-auto">
                                <pre className="text-[10px] text-txt-muted font-mono leading-relaxed">
                                    {JSON.stringify(formData, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>

                    {/* Restore Section (Moved to Bottom of Content) */}
                    <div className="mt-4 pt-4 border-t border-modal-border">
                        <h4 className="text-xs font-bold text-txt-muted uppercase mb-2 flex items-center gap-1">
                            {t('history_advanced_ops')}
                        </h4>
                        <button
                            onClick={handleRestore}
                            className="w-full py-3 bg-modal-bg-elevated hover:bg-surface-hover text-brand-secondary font-bold rounded-xl border border-modal-border flex items-center justify-center gap-2 transition-all active:scale-95 group"
                        >
                            <CopyPlus size={18} className="group-hover:scale-110 transition-transform" />
                            {t('history_restore_btn')}
                        </button>
                        <p className="text-[10px] text-txt-muted mt-2 text-center">
                            {t('history_restore_note')}
                        </p>
                    </div>
                </div>

                {/* Footer - Only Save Button */}
                <div className="flex-none p-4 bg-modal-footer border-t border-modal-border rounded-b-2xl">
                    <button
                        onClick={handleSave}
                        className="w-full py-3 bg-brand-primary-deep hover:bg-brand-primary text-white font-bold rounded-xl shadow-lg shadow-brand-primary/30 flex items-center justify-center gap-2 transition-transform active:scale-95"
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