import React from 'react';
import { X, Share, MoreVertical, PlusSquare, Download, Smartphone } from 'lucide-react';
import { useAppTranslation } from '../../i18n/app';
import { useCommonTranslation } from '../../i18n/common';

interface InstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InstallGuideModal: React.FC<InstallGuideModalProps> = ({ isOpen, onClose }) => {
  const { t: tApp } = useAppTranslation();
  const { t: tCommon } = useCommonTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-modal-backdrop backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="modal-container w-full max-w-sm flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-bg-elevated p-4 border-b border-surface-border flex items-center justify-between">
          <h3 className="text-lg font-bold text-txt-primary flex items-center gap-2">
            <Download size={20} className="text-brand-primary" />
            {tApp('install_title')}
          </h3>
          <button onClick={onClose} className="text-txt-muted hover:text-txt-primary transition-colors"><X size={24} /></button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 overflow-y-auto max-h-[70vh] modal-body">

          <p className="text-sm text-txt-muted leading-relaxed">
            {tApp('install_desc')}
          </p>

          {/* iOS Section */}
          <div className="modal-bg-recessed rounded-xl p-4 border border-surface-border space-y-3">
            <h4 className="text-txt-primary font-bold flex items-center gap-2 border-b border-surface-border pb-2">
              <span className="modal-bg-elevated p-1 rounded text-txt-muted"><Smartphone size={16} /></span>
              iOS (iPhone/iPad)
            </h4>
            <ol className="space-y-3 text-sm text-txt-secondary">
              <li className="flex items-start gap-3">
                <span className="flex-none bg-brand-secondary/20 text-brand-secondary w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                <span>
                  {tApp('install_ios_step1')} <span className="inline-flex items-center gap-1 modal-bg-elevated px-1.5 py-0.5 rounded text-status-info mx-1 border border-surface-border"><Share size={12} /> {tCommon('share')}</span> {tApp('install_ios_step1_suffix')}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-none bg-brand-secondary/20 text-brand-secondary w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                <span>
                  {tApp('install_ios_step2')} <span className="inline-flex items-center gap-1 modal-bg-elevated px-1.5 py-0.5 rounded text-txt-primary mx-1 border border-surface-border"><PlusSquare size={12} /> {tApp('install_ios_add')}</span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-none bg-brand-secondary/20 text-brand-secondary w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">3</span>
                <span>{tApp('install_ios_step3')}</span>
              </li>
            </ol>
          </div>

          {/* Android Section */}
          <div className="modal-bg-recessed rounded-xl p-4 border border-surface-border space-y-3">
            <h4 className="text-txt-primary font-bold flex items-center gap-2 border-b border-surface-border pb-2">
              <span className="modal-bg-elevated p-1 rounded text-txt-muted"><Smartphone size={16} /></span>
              Android (Chrome)
            </h4>
            <ol className="space-y-3 text-sm text-txt-secondary">
              <li className="flex items-start gap-3">
                <span className="flex-none bg-brand-primary/20 text-brand-primary w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                <span>
                  {tApp('install_android_step1')} <span className="inline-flex items-center gap-1 modal-bg-elevated px-1.5 py-0.5 rounded text-txt-primary mx-1 border border-surface-border"><MoreVertical size={12} /> {tApp('install_android_menu')}</span> {tApp('install_android_step1_suffix')}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-none bg-brand-primary/20 text-brand-primary w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                <span>
                  {tApp('install_android_step2')} <span className="font-bold text-txt-primary">「{tApp('install_android_install')}」</span> {tApp('install_android_step2_or')} <span className="font-bold text-txt-primary">「{tApp('install_android_add')}」</span>
                </span>
              </li>
            </ol>
          </div>

        </div>

        <div className="p-4 modal-bg-elevated border-t border-surface-border">
          <button onClick={onClose} className="w-full py-3 bg-brand-primary hover:filter hover:brightness-110 text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg">
            {tCommon('understand')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallGuideModal;