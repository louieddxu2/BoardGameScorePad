
import React, { useState, useRef } from 'react';
import { GameTemplate } from '../../types';
import PhotoScanner from '../scanner/PhotoScanner';
import TextureMapper from '../editor/TextureMapper';
import { UIState } from './hooks/useSessionState';

interface SessionImageFlowProps {
  uiState: UIState;
  setUiState: React.Dispatch<React.SetStateAction<UIState>>;
  template: GameTemplate;
  baseImage: string | null;
  onScannerConfirm: (result: { processed: string; raw: string; points: any[]; blob?: Blob; aspectRatio: number; intent?: 'save' | 'edit_grid' }) => void;
  onUpdateTemplate: (template: GameTemplate) => void;
}

const SessionImageFlow: React.FC<SessionImageFlowProps> = ({
  uiState,
  setUiState,
  template,
  baseImage,
  onScannerConfirm,
  onUpdateTemplate
}) => {
  const { isScannerOpen, isTextureMapperOpen, scannerInitialImage, scannerFixedRatio } = uiState;
  
  // Local state to store scanner data for restoration when going back from TextureMapper
  const [restoreState, setRestoreState] = useState<{
      raw: string;
      points: {x: number, y: number}[];
  } | null>(null);

  // Flag to ignore the subsequent onClose call from PhotoScanner when confirming
  const isTransitioningRef = useRef(false);

  // Wrapper to intercept confirmation and save state only if data is valid
  const handleScannerConfirmWrapper = (result: { processed: string; raw: string; points: any[]; blob?: Blob; aspectRatio: number; intent?: 'save' | 'edit_grid' }) => {
      // Validate points structure to prevent crashes upon restoration
      const isValidPoints = Array.isArray(result.points) && 
                            result.points.length === 4 && 
                            result.points.every((p: any) => p && typeof p.x === 'number' && typeof p.y === 'number');

      if (result.intent === 'edit_grid') {
          if (result.raw && isValidPoints) {
              setRestoreState({ raw: result.raw, points: result.points });
              isTransitioningRef.current = true;
          }
      } else {
          setRestoreState(null);
      }
      onScannerConfirm(result);
  };

  // Handle Texture Mapper Save (From "Modify Grid" flow)
  const handleTextureSave = (updatedTemplate: GameTemplate) => {
      const mergedTemplate = {
          ...template,
          ...updatedTemplate,
          id: template.id,
          sourceTemplateId: template.sourceTemplateId
      };
      
      onUpdateTemplate(mergedTemplate);
      setRestoreState(null);
      setUiState(p => ({ ...p, isTextureMapperOpen: false }));
  };

  // Handle Texture Mapper Cancel/Back
  const handleTextureCancel = () => {
      // Only restore if we have valid state
      const isValidRestore = restoreState && 
                             restoreState.raw && 
                             Array.isArray(restoreState.points) && 
                             restoreState.points.length === 4;

      if (isValidRestore) {
          // Go back to scanner with restored state
          setUiState(p => ({ ...p, isTextureMapperOpen: false, isScannerOpen: true }));
      } else {
          // Just close if no state to restore
          setUiState(p => ({ ...p, isTextureMapperOpen: false }));
      }
  };

  const handleScannerClose = () => {
      // If we are transitioning to Edit Grid, do NOT clear the restore state or close logic here.
      // The onScannerConfirm has already handled the state transition (closing scanner, opening mapper).
      if (isTransitioningRef.current) {
          isTransitioningRef.current = false;
          return;
      }
      
      setRestoreState(null);
      setUiState(p => ({ ...p, isScannerOpen: false, scannerInitialImage: null }));
  };

  if (isScannerOpen) {
      return (
          <PhotoScanner 
              onClose={handleScannerClose} 
              onConfirm={handleScannerConfirmWrapper}
              initialImage={scannerInitialImage || restoreState?.raw || undefined}
              initialPoints={restoreState?.points}
              fixedAspectRatio={scannerFixedRatio}
              template={template} 
          />
      );
  }

  if (isTextureMapperOpen && baseImage) {
      return (
          <TextureMapper
              imageSrc={baseImage}
              initialName={template.name}
              initialColumnCount={template.columns.length}
              allTemplates={[]} 
              onSave={handleTextureSave}
              onCancel={handleTextureCancel}
              aspectRatio={template.globalVisuals?.aspectRatio || 1}
          />
      );
  }

  return null;
};

export default SessionImageFlow;
