import React from 'react';
import { GameTemplate } from '../../../types';
import { Copy, RefreshCw, Trash2, Pin, Check, Share2, UploadCloud, ImageIcon, PlayCircle, Code, Link2 } from 'lucide-react';
import { useDashboardTranslation } from '../../../i18n/dashboard';

interface GameCardProps {
  template: GameTemplate;
  mode: 'active' | 'pinned' | 'user' | 'system';
  onClick: () => void;
  // Actions
  onDelete?: (e: React.MouseEvent) => void;
  onPin?: (e: React.MouseEvent) => void;
  onCopyJSON?: (e: React.MouseEvent) => void;
  onCopyLink?: (e: React.MouseEvent) => void;
  onCloudBackup?: (e: React.MouseEvent) => void;
  onSystemCopy?: (e: React.MouseEvent) => void;
  onSystemRestore?: (e: React.MouseEvent) => void;
  // State
  isCopied?: boolean;
  systemOverride?: boolean;
  // Cloud Sync Status
  isConnected?: boolean;
  isAutoConnectEnabled?: boolean;
}

const GameCard: React.FC<GameCardProps> = ({
  template,
  mode,
  onClick,
  onDelete,
  onPin,
  onCopyJSON,
  onCopyLink,
  onCloudBackup,
  onSystemCopy,
  onSystemRestore,
  isCopied,
  systemOverride,
  isConnected,
  isAutoConnectEnabled
}) => {
  const { t } = useDashboardTranslation();

  // Logic: Compare lastSyncedAt with updatedAt
  const isSynced = (template.lastSyncedAt || 0) >= (template.updatedAt || 0);

  // Logic: Image Status
  // globalVisuals implies a grid structure is set up.
  // isLocalImageAvailable (injected by hook) tells us if the file exists.
  const hasGrid = !!template.globalVisuals;
  const isLocalImageReady = (template as any).isLocalImageAvailable;

  const renderImageStatus = () => {
    if (!hasGrid) return null;

    // Use p-1.5 to align perfectly with adjacent buttons (which have p-1.5)
    // Size 16 matches the Trash icon size
    if (isLocalImageReady) {
      return (
        <div title={t('card_img_ready')} className="p-1.5 text-brand-primary opacity-90">
          <ImageIcon size={16} />
        </div>
      );
    } else {
      return (
        <div title={t('card_img_missing')} className="p-1.5 text-txt-muted opacity-60">
          <ImageIcon size={16} />
        </div>
      );
    }
  };

  const baseClasses = "bg-surface-bg rounded-xl border border-surface-border p-3 shadow-ui-soft hover:bg-surface-hover transition-all cursor-pointer relative flex flex-col h-20 group";

  if (mode === 'active') {
    return (
      <div onClick={onClick} className={`${baseClasses} border-brand-primary/40 hover:border-surface-border-hover`}>
        <div className="flex items-start justify-between gap-1 pr-10">
          <h3 className="text-sm font-bold text-txt-primary leading-tight line-clamp-2 group-hover:text-txt-card-hover transition-colors">{template.name}</h3>
        </div>
        <div className="absolute top-1/2 right-3 -translate-y-1/2 text-brand-primary/80">
          <PlayCircle size={36} strokeWidth={1.5} />
        </div>
        <button onClick={onDelete} className="absolute bottom-1 left-1 p-1.5 text-txt-muted hover:text-status-danger hover:bg-surface-hover rounded-md transition-colors">
          <Trash2 size={16} />
        </button>
      </div>
    );
  }

  // Common Layout for Pinned, User, System
  return (
    <div 
      onClick={onClick} 
      className={`${baseClasses} hover:border-surface-border-hover hover:shadow-ui-floating hover:-translate-y-0.5 active:scale-[0.98] ${mode === 'system' ? 'hover:border-brand-secondary/20' : 'hover:border-brand-primary/20'}`}
    >
      <div className="flex items-start justify-between gap-1 pr-7">
        <h3 className={`text-sm font-bold leading-tight line-clamp-2 group-hover:text-txt-card-hover transition-colors ${mode === 'system' ? 'text-txt-primary pr-2 opacity-90' : 'text-txt-primary'}`}>{template.name}</h3>
      </div>

      {/* Pin Button */}
      {onPin && (
        <button
          onClick={onPin}
          className={`absolute top-1 right-1 p-1.5 rounded-md transition-colors ${mode === 'pinned' ? 'text-status-warning bg-surface-hover/50 hover:bg-surface-hover' : 'text-txt-muted hover:text-status-warning hover:bg-surface-hover'}`}
        >
          <Pin size={16} fill={mode === 'pinned' ? "currentColor" : "none"} />
        </button>
      )}

      {/* Bottom Actions (Left) */}
      <div className="absolute bottom-1 left-1 flex gap-1 items-center">
        {onDelete && (
          <button onClick={onDelete} className="p-1.5 text-txt-muted hover:text-status-danger hover:bg-surface-hover rounded-md transition-colors">
            <Trash2 size={16} />
          </button>
        )}

        {/* System Specific Actions */}
        {mode === 'system' && (
          systemOverride ? (
            <button onClick={onSystemRestore} className="flex items-center gap-1 text-[9px] text-status-warning font-normal border border-status-warning/30 px-1.5 py-0.5 rounded hover:bg-status-warning/10">
              <RefreshCw size={8} /> {t('card_restore_builtin')}
            </button>
          ) : (
            <button onClick={onSystemCopy} className="flex items-center gap-1 text-[10px] text-txt-primary font-bold bg-surface-hover/50 hover:bg-surface-hover px-1.5 py-1 rounded-md">
              <Copy size={11} /> {t('card_create_copy')}
            </button>
          )
        )}

        {/* Image Status Indicator - Placed here for better visibility and layout balance */}
        {template.hasImage && (
          <div className="p-1.5 rounded-lg border border-status-warning/30 bg-status-warning/20 text-status-warning flex items-center justify-center shadow-ui-soft backdrop-blur-[2px] transition-all group-hover:bg-status-warning/40 group-hover:scale-110 active:scale-95" title={t('card_img_ready')}>
            <ImageIcon size={14} strokeWidth={2.5} />
          </div>
        )}
      </div>

      {/* Bottom Actions (Right) */}
      <div className="absolute bottom-1 right-1 flex gap-1">
        {/* Only show Upload button if NOT synced (Actionable) */}
        {onCloudBackup && isAutoConnectEnabled && isConnected && !isSynced && (
          <button
            onClick={(e) => { e.stopPropagation(); onCloudBackup(e); }}
            className="p-1.5 text-status-warning/80 hover:text-status-warning hover:bg-surface-hover rounded transition-colors"
            title={t('card_backup_hint')}
          >
            <UploadCloud size={14} />
          </button>
        )}
        {onCopyLink ? (
          <button
            onClick={(e) => { e.stopPropagation(); onCopyLink(e); }}
            className="p-1.5 text-txt-muted hover:text-brand-primary rounded transition-colors"
            title={t('card_copy_share_link')}
          >
            {isCopied ? <Check size={14} className="text-brand-primary" /> : <Link2 size={14} />}
          </button>
        ) : onCopyJSON ? (
          <button
            onClick={(e) => { e.stopPropagation(); onCopyJSON(e); }}
            className="p-1.5 text-txt-muted hover:text-brand-primary rounded transition-colors"
          >
            {isCopied ? <Check size={14} className="text-brand-primary" /> : <Code size={14} />}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default GameCard;
