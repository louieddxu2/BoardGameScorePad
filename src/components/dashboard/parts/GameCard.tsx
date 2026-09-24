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

  if (mode === 'active' || mode === 'pinned') {
    const isActive = mode === 'active';
    return (
      <div
        onClick={onClick}
        className={`flex h-12 cursor-pointer items-center rounded-xl border bg-surface-bg shadow-ui-soft transition-colors hover:bg-surface-hover ${isActive ? 'border-brand-primary/40' : 'border-surface-border'}`}
      >
        <button
          type="button"
          aria-label={`${t(isActive ? 'card_resume' : 'card_start_new')}: ${template.name}`}
          className="flex h-full min-w-0 flex-1 items-center rounded-l-xl px-3 text-left text-sm font-bold text-txt-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <span className="truncate">{template.name}</span>
        </button>
        {isActive ? (
          onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(e); }}
              aria-label={t('card_delete')}
              title={t('card_delete')}
              className="flex h-full w-12 shrink-0 items-center justify-center text-txt-muted transition-colors hover:bg-surface-hover hover:text-status-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          )
        ) : (
          <>
            {onCopyLink && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCopyLink(e); }}
                aria-label={t('card_copy_share_link')}
                title={t('card_copy_share_link')}
                className="flex h-full w-12 shrink-0 items-center justify-center text-txt-muted transition-colors hover:bg-surface-hover hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                {isCopied ? <Check size={16} className="text-brand-primary" aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
              </button>
            )}
            {onPin && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onPin(e); }}
                aria-label={t('card_unpin')}
                title={t('card_unpin')}
                className="flex h-full w-12 shrink-0 items-center justify-center rounded-r-xl text-status-warning transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <Pin size={16} fill="currentColor" aria-hidden="true" />
              </button>
            )}
          </>
        )}
        {isActive && (
          <div className="flex h-full w-12 shrink-0 items-center justify-center rounded-r-xl text-brand-primary/80" title={t('card_resume')} aria-hidden="true">
            <PlayCircle size={20} strokeWidth={1.5} aria-hidden="true" />
          </div>
        )}
      </div>
    );
  }

  // Common Layout for User and System
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
          className="absolute top-1 right-1 p-1.5 rounded-md text-txt-muted transition-colors hover:bg-surface-hover hover:text-status-warning"
        >
          <Pin size={16} fill="none" />
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
