import React, { useState } from 'react';
import { GameTemplate } from '../../../types';
import { X, Cloud } from 'lucide-react';
import { useCloudLibraryTranslation } from '../../../i18n/cloud_library';
import OfficialBoardsPanel from '../../../features/official-boards/components/OfficialBoardsPanel';
import { useOfficialBoardsTranslation } from '../../../i18n/officialBoards';
import ShareCatalogTab from './cloud-library/ShareCatalogTab';
import { isOwnerEmail } from '../../../utils/ownerAccount';
import { useCloudSession } from '../../../hooks/useCloudSession';

interface CloudLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userTemplates: GameTemplate[];
  onImport: (templates: GameTemplate[]) => void;
  userEmail?: string | null;
}

/**
 * Owner-only cloud library (the entry button is shown only for the owner's account).
 * Shared scoreboards (user uploads) and cloud built-in (official) scoreboards are
 * separate collections, each read from its own local catalog.
 */
const CloudLibraryModal: React.FC<CloudLibraryModalProps> = ({ isOpen, onClose, userTemplates, onImport, userEmail }) => {
  const ownerSession = useCloudSession();
  const { t } = useCloudLibraryTranslation();
  const { t: tOfficial } = useOfficialBoardsTranslation();
  const [tab, setTab] = useState<'share' | 'official'>('share');
  const [isBusy, setIsBusy] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop z-50 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
    >
      <div className="modal-container w-full max-w-lg flex flex-col h-[580px] max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex-none modal-bg-elevated rounded-t-2xl border-b border-surface-border p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-txt-primary flex items-center gap-2">
              <Cloud size={20} className="text-brand-primary" /> {t('lib_title')}
            </h3>
            <button
              onClick={onClose}
              disabled={isBusy}
              className="text-txt-muted hover:text-txt-primary disabled:opacity-50 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          <p className="text-xs text-txt-muted mt-1.5 leading-relaxed">{t('lib_subtitle')}</p>
          {/* Equal-width segmented tabs; both use the same box so switching never resizes them. */}
          <div className="flex gap-1 mt-3 p-1 rounded-xl modal-bg-recessed">
            {(['share', 'official'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                disabled={isBusy}
                aria-pressed={tab === key}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-60 ${tab === key ? 'bg-brand-primary text-txt-on-color' : 'text-txt-secondary hover:text-txt-primary'}`}
              >
                {key === 'share' ? tOfficial('official_tab_share') : tOfficial('official_tab_official')}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="modal-body flex-1 p-4 overflow-y-auto no-scrollbar min-h-0">
          {tab === 'official' ? (
            <OfficialBoardsPanel isAdmin={isOwnerEmail(userEmail) || ownerSession.isAdmin} />
          ) : (
            <ShareCatalogTab userTemplates={userTemplates} onImport={onImport} onBusyChange={setIsBusy} />
          )}
        </div>
      </div>
    </div>
  );
};

export default CloudLibraryModal;
