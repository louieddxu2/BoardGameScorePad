
import React, { useState, useEffect } from 'react';
import { HistoryRecord, ScoringRule, SavedListItem, GameTemplate } from '../../../types';
import { X, Save, Calendar, MapPin, FileText, Settings, Database, Clock, Trophy, Hash, CopyPlus } from 'lucide-react';
import { generateId } from '../../../utils/idGenerator';
import { relationshipService } from '../../../services/relationshipService'; // Import Service
import { DATA_LIMITS } from '../../../dataLimits';

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

const SCORING_OPTIONS: { value: ScoringRule, label: string }[] = [
    { value: 'HIGHEST_WINS', label: '競爭：最高分贏' },
    { value: 'LOWEST_WINS', label: '競爭：最低分贏' },
    { value: 'COOP', label: '合作模式' },
    { value: 'COMPETITIVE_NO_SCORE', label: '競爭(不計勝負)' },
    { value: 'COOP_NO_SCORE', label: '合作(不計勝負)' },
];

const HistorySettingsModal: React.FC<HistorySettingsModalProps> = ({ isOpen, onClose, record, onSave, locationHistory = [], onRestoreTemplate }) => {
  const [formData, setFormData] = useState<HistoryRecord | null>(null);
  const [showRawInspector, setShowRawInspector] = useState(false);

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen && record) {
      // Deep clone to safely edit nested snapshotTemplate if needed
      setFormData(JSON.parse(JSON.stringify(record)));
    }
  }, [isOpen, record]);

  if (!isOpen || !formData) return null;

  const handleFieldChange = (key: keyof HistoryRecord, value: any) => {
    setFormData(prev => prev ? ({ ...prev, [key]: value }) : null);
  };

  const handleDeepChange = (path: string[], value: any) => {
      setFormData(prev => {
          if (!prev) return null;
          const newData = { ...prev };
          let current: any = newData;
          for (let i = 0; i < path.length - 1; i++) {
              current = current[path[i]];
          }
          current[path[path.length - 1]] = value;
          return newData;
      });
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
          name: `${formData.gameName} (還原)`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastSyncedAt: undefined,
          cloudImageId: undefined,
          sourceTemplateId: undefined // Detach
      };
      
      await onRestoreTemplate(newTemplate);
      onClose();
  };

  // --- Dynamic Field Renderer ---
  // This analyzes the data structure and renders appropriate inputs
  const renderDynamicFields = () => {
      // Define known priority fields that we want to show with specific UI
      const priorityKeys = ['gameName', 'location', 'startTime', 'endTime', 'note'];
      const hiddenKeys = ['id', 'templateId', 'players', 'winnerIds', 'snapshotTemplate', 'locationId'];
      
      // 1. Render Priority Fields (Specific UI)
      return (
          <div className="space-y-4">
              {/* Game Name */}
              <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                      <Trophy size={12} /> 遊戲名稱
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
                      <Hash size={12} /> BoardGameGeek ID
                  </label>
                  <input
                      type="text"
                      value={formData.snapshotTemplate?.bggId || ''}
                      onChange={(e) => handleDeepChange(['snapshotTemplate', 'bggId'], e.target.value)}
                      placeholder="例如：12345"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 outline-none font-mono"
                  />
                  <p className="text-[10px] text-slate-500 px-1">* 此 ID 將儲存於此歷史紀錄的計分板備份中</p>
              </div>

              {/* Time Section */}
              <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                          <Clock size={12} /> 開始時間
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
                          <Clock size={12} /> 結束時間
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
                      <MapPin size={12} /> 地點
                  </label>
                  <input
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => handleFieldChange('location', e.target.value)}
                      placeholder="例如：家裡、桌遊店..."
                      list="location-list" // Link to datalist
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 outline-none"
                  />
                  <datalist id="location-list">
                      {locationHistory.map((loc, i) => (
                          <option key={i} value={loc.name} />
                      ))}
                  </datalist>
              </div>

              {/* Scoring Rule (Extracted from snapshotTemplate) */}
              <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                      <Settings size={12} /> 競爭 / 合作模式
                  </label>
                  <select 
                      value={formData.snapshotTemplate?.defaultScoringRule || 'HIGHEST_WINS'}
                      onChange={(e) => handleDeepChange(['snapshotTemplate', 'defaultScoringRule'], e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 outline-none appearance-none"
                  >
                      {SCORING_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                  </select>
                  <p className="text-[10px] text-slate-500 px-1">* 此設定將改變歷史紀錄中的規則標記 (不會自動重算贏家)</p>
              </div>

              {/* Note */}
              <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                      <FileText size={12} /> 筆記 / 備註
                  </label>
                  <textarea
                      value={formData.note || ''}
                      onChange={(e) => handleFieldChange('note', e.target.value)}
                      placeholder="紀錄這場遊戲的趣事、戰術或心得..."
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
      className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
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
            詳細資訊設定
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
                    {showRawInspector ? "隱藏完整結構" : "檢視完整資料結構 (Debug)"}
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
                    進階操作
                </h4>
                <button 
                    onClick={handleRestore}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all active:scale-95 group"
                >
                    <CopyPlus size={18} className="group-hover:scale-110 transition-transform"/>
                    還原計分板至遊戲庫
                </button>
                <p className="text-[10px] text-slate-500 mt-2 text-center">
                    提取此紀錄的計分板架構，另存為新模板。
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
            儲存變更
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistorySettingsModal;
