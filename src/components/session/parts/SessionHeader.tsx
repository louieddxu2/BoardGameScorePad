
import React, { useState } from 'react';
import { ArrowLeft, Share2, Edit2, Lock, Unlock, DownloadCloud, RefreshCw, UsersRound } from 'lucide-react';
import ShareMenu from '../modals/ShareMenu';
import { useSessionTranslation } from '../../../i18n/session';
import { MultiplayerConnectionStatus } from '../../../features/multiplayer/multiplayerSessionManager';

interface SessionHeaderProps {
  templateName: string;
  isEditingTitle: boolean;
  showShareMenu: boolean;
  screenshotActive: boolean;
  isEditMode: boolean; // New prop
  hasVisuals?: boolean; // New prop: Check if template has coordinate data
  hasCloudImage?: boolean; // New prop: Check if template has a cloud image ID
  onEditTitleToggle: (editing: boolean) => void;
  onTitleSubmit: (newTitle: string) => void;
  onExit: () => void;
  onShareMenuToggle: (show: boolean) => void;
  onScreenshotRequest: (mode: 'full' | 'simple') => void;
  onToggleEditMode: () => void; // New callback
  onUploadImage?: () => void; // New callback
  onCloudDownload?: () => void; // New callback
  onOpenGallery?: () => void; // New callback for gallery
  onTakePhoto?: () => void; // New callback for camera shortcut
  photoCount?: number;
  isCloudConnected?: boolean;
  shareMenuZIndex?: number; // [NEW] Dynamic zIndex from stack
  canEditTemplate?: boolean;
  canUseMediaTools?: boolean;
  onCycleMultiplayerPreview?: () => void;
  multiplayerPreviewLabel?: string;
  multiplayerPreviewPlayerNumber?: number | null;
  onOpenMultiplayerRoom?: () => void;
  multiplayerConnectionCount?: number;
  hasUnpublishedBoardUpdate?: boolean;
  onOpenMultiplayerParticipantRoom?: () => void;
  multiplayerConnectionStatus?: MultiplayerConnectionStatus;
}

const SessionHeader: React.FC<SessionHeaderProps> = ({
  templateName,
  isEditingTitle,
  showShareMenu,
  screenshotActive,
  isEditMode,
  hasVisuals,
  hasCloudImage,
  onEditTitleToggle,
  onTitleSubmit,
  onExit,
  onShareMenuToggle,
  onScreenshotRequest,
  onToggleEditMode,
  onUploadImage,
  onCloudDownload,
  onOpenGallery,
  onTakePhoto,
  photoCount,
  isCloudConnected,
  shareMenuZIndex = 40, // Default for backward compatibility/static
  canEditTemplate = true,
  canUseMediaTools = true,
  onCycleMultiplayerPreview,
  multiplayerPreviewLabel,
  multiplayerPreviewPlayerNumber,
  onOpenMultiplayerRoom,
  multiplayerConnectionCount,
  hasUnpublishedBoardUpdate = false,
  onOpenMultiplayerParticipantRoom,
  multiplayerConnectionStatus,
}) => {
  const { t } = useSessionTranslation();
  const [tempTitle, setTempTitle] = useState('');

  const handleTitleClick = () => {
    // Only allow title editing if in Edit Mode
    if (!isEditMode || !canEditTemplate) return;
    setTempTitle(templateName);
    onEditTitleToggle(true);
  };

  const handleTitleBlur = () => {
    onTitleSubmit(tempTitle);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const multiplayerButtonClass = onOpenMultiplayerRoom && multiplayerConnectionCount !== undefined
    ? hasUnpublishedBoardUpdate
      ? 'border-status-warning/60 bg-status-warning/10 text-status-warning hover:bg-status-warning/20'
      : 'border-status-info/60 bg-status-info/10 text-status-info hover:bg-status-info/20'
    : 'border-surface-border text-txt-muted hover:text-brand-primary hover:bg-surface-hover';
  const isParticipantReconnecting = onOpenMultiplayerParticipantRoom && multiplayerConnectionStatus === 'reconnecting';

  // Helper to prevent input blur when clicking buttons
  const preventBlur = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div className="safe-area-top-compact flex-none modal-bg-elevated px-2 pb-2 flex items-center justify-between border-b border-surface-border shadow-md z-20 transition-colors">
      <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
        <button
          onMouseDown={preventBlur}
          onClick={() => {
            // [Crash Fix]
            // 若正在編輯標題，點擊返回視為「確認並結束編輯」。
            // 我們不在此處呼叫 onExit()，避免同時觸發「狀態更新」與「元件卸載」導致程式崩潰。
            // 使用者看到標題儲存成功後，再按一次返回鍵即可正常退出。
            if (isEditingTitle) {
              onTitleSubmit(tempTitle);
              return;
            }

            // 若不在編輯狀態，則執行正常的退出流程
            onExit();
          }}
          className="p-2 hover:bg-surface-hover rounded-lg text-txt-muted hover:text-txt-primary shrink-0 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        {isEditingTitle ? (
          <input
            autoFocus
            type="text"
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleKeyDown}
            onFocus={(e) => e.target.select()}
            className="bg-app-bg text-txt-primary font-bold text-lg px-2 py-1 rounded border border-brand-primary w-full outline-none"
          />
        ) : (
          <div
            onClick={handleTitleClick}
            className={`font-bold text-lg truncate flex items-center gap-2 px-2 py-1 rounded transition-colors group ${isEditMode && canEditTemplate ? 'cursor-pointer hover:bg-surface-hover' : 'text-txt-primary'}`}
          >
            {templateName}
            {isEditMode && canEditTemplate && <Edit2 size={14} className="text-txt-muted opacity-0 group-hover:opacity-100 transition-opacity" />}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 relative shrink-0">
        {(onOpenMultiplayerRoom || onOpenMultiplayerParticipantRoom || onCycleMultiplayerPreview) && (
          <button
            onMouseDown={preventBlur}
            onClick={onOpenMultiplayerRoom ?? onOpenMultiplayerParticipantRoom ?? onCycleMultiplayerPreview}
            className={`relative p-2 rounded-lg transition-colors border ${isParticipantReconnecting ? 'border-status-warning/60 bg-status-warning/10 text-status-warning hover:bg-status-warning/20' : multiplayerButtonClass}`}
            title={onOpenMultiplayerRoom ? t('multiplayer_open_room') : onOpenMultiplayerParticipantRoom ? (isParticipantReconnecting ? t('multiplayer_reconnecting') : t('multiplayer_connection_title')) : multiplayerPreviewLabel}
            aria-label={onOpenMultiplayerRoom ? t('multiplayer_open_room') : onOpenMultiplayerParticipantRoom ? (isParticipantReconnecting ? t('multiplayer_reconnecting') : t('multiplayer_connection_title')) : multiplayerPreviewLabel}
          >
            <UsersRound size={20} />
            {isParticipantReconnecting && <RefreshCw size={11} className="absolute -right-1 -top-1 rounded-full border border-modal-bg bg-status-warning p-0.5 text-modal-bg animate-spin" />}
            {onOpenMultiplayerRoom && multiplayerConnectionCount !== undefined && (
              <span className={`absolute -right-1 -top-1 min-w-4 h-4 px-1 flex items-center justify-center rounded-full text-[10px] font-bold leading-none border border-modal-bg ${hasUnpublishedBoardUpdate ? 'bg-status-warning text-modal-bg' : 'bg-status-info text-white'}`} title={t('multiplayer_connected_count', { count: multiplayerConnectionCount })}>
                {multiplayerConnectionCount > 99 ? '99+' : multiplayerConnectionCount}
              </span>
            )}
            {!onOpenMultiplayerRoom && !onOpenMultiplayerParticipantRoom && multiplayerPreviewPlayerNumber !== null && multiplayerPreviewPlayerNumber !== undefined && (
              <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-brand-primary text-white text-[10px] font-bold leading-none border border-modal-bg">
                {multiplayerPreviewPlayerNumber}
              </span>
            )}
          </button>
        )}
        {/* Cloud Download Shortcut */}
        {canUseMediaTools && hasCloudImage && onCloudDownload && (
          <button
            onMouseDown={preventBlur}
            onClick={onCloudDownload}
            className="p-2 rounded-lg transition-colors border border-status-info/30 bg-status-info/10 text-status-info animate-pulse hover:bg-status-info/20"
            title={t('session_download_bg')}
          >
            <DownloadCloud size={20} />
          </button>
        )}

        {canEditTemplate && <button
          onMouseDown={preventBlur}
          onClick={onToggleEditMode}
          className={`p-2 rounded-lg transition-colors border ${isEditMode ? 'bg-brand-secondary border-brand-secondary text-white shadow-lg' : 'modal-bg-elevated border-surface-border text-txt-muted hover:text-txt-primary'}`}
          title={isEditMode ? t('session_lock_edit') : t('session_unlock_edit')}
        >
          {isEditMode ? <Unlock size={20} /> : <Lock size={20} />}
        </button>}

        {canUseMediaTools && <div className="w-px h-6 bg-surface-border mx-1"></div>}
        {canUseMediaTools && <button
          onMouseDown={preventBlur}
          onClick={() => onShareMenuToggle(!showShareMenu)}
          className="p-2 hover:bg-surface-hover hover:text-brand-secondary rounded-lg text-txt-muted transition-colors"
        >
          <Share2 size={20} />
        </button>}

        {canUseMediaTools && showShareMenu && (
          <ShareMenu
            isOpen={showShareMenu}
            onClose={() => onShareMenuToggle(false)}
            isCopying={screenshotActive}
            onScreenshotRequest={onScreenshotRequest}
            hasVisuals={hasVisuals}
            onUploadImage={onUploadImage}
            onOpenGallery={onOpenGallery}
            onTakePhoto={onTakePhoto}
            photoCount={photoCount}
            zIndex={shareMenuZIndex} // [NEW]
          />
        )}
        {canUseMediaTools && showShareMenu && (
          <div 
            className="fixed inset-0" 
            style={{ zIndex: shareMenuZIndex - 1 }} 
            onClick={() => onShareMenuToggle(false)}
          ></div>
        )}
      </div>
    </div>
  );
};

export default SessionHeader;
