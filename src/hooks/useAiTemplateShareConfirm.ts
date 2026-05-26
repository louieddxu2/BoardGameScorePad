import { useState, useEffect } from 'react';
import { AppView, GameTemplate } from '../types';
import { useConfirm } from './useConfirm';
import { useToast } from './useToast';
import { useSessionTranslation } from '../i18n/session';
import { uploadTemplateToCloud } from '../services/templateShareService';
import { hasPendingAiShare, consumePendingAiShare } from '../utils/pendingAiShare';

/**
 * Custom hook to manage the confirmation modal and side-effects for uploading
 * AI-generated templates to the cloud template library when returning to the dashboard.
 */
export const useAiTemplateShareConfirm = (view: AppView) => {
  const [pendingAiTemplateToShare, setPendingAiTemplateToShare] = useState<GameTemplate | null>(null);
  const { confirm } = useConfirm();
  const { showToast } = useToast();
  const { t: tSession } = useSessionTranslation();

  useEffect(() => {
    if (view === AppView.DASHBOARD && pendingAiTemplateToShare) {
      const templateToShare = pendingAiTemplateToShare;
      setPendingAiTemplateToShare(null); // Reset immediately to prevent multiple triggers

      (async () => {
        const shouldShare = await confirm({
          title: tSession('session_ai_upload_confirm_title'),
          message: tSession('session_ai_upload_confirm_msg', { name: templateToShare.name }),
          confirmText: tSession('session_ai_upload_confirm_yes'),
          cancelText: tSession('session_ai_upload_confirm_no'),
        });

        if (shouldShare) {
          try {
            await uploadTemplateToCloud(templateToShare);
            showToast({ message: tSession('toast_ai_upload_success'), type: 'success' });
          } catch (err) {
            console.warn('[useAiTemplateShareConfirm] AI template upload failed:', err);
          }
        }
      })();
    }
  }, [view, pendingAiTemplateToShare, confirm, showToast, tSession]);

  const captureAiTemplateForSharing = (template: GameTemplate | null) => {
    if (!template || template.columns.length < 3) return;

    if (hasPendingAiShare(template.id)) {
      consumePendingAiShare(template.id);
      setPendingAiTemplateToShare(template);
    }
  };

  return { captureAiTemplateForSharing };
};
