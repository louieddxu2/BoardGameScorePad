
import { useState, useRef, useEffect, useCallback } from 'react';
import { imageService } from '../services/imageService';
import { compressAndResizeImage } from '../utils/imageProcessing';

type PhotoSource = 'camera' | 'upload';
type PhotoErrorType = 'save' | 'compress' | 'delete';

interface UsePhotoManagerProps {
  /** 照片關聯的容器 ID（session.id 或 record.id） */
  contextId: string;
  /** 當前所有照片 ID 清單 */
  currentPhotoIds: string[];
  /** 照片新增後回調（含完整清單與來源） */
  onPhotosAdded: (updatedIds: string[], source: PhotoSource) => void;
  /** 照片刪除後回調（含更新後的完整清單） */
  onPhotoDeleted: (updatedIds: string[]) => void;
  /** 操作失敗時回調（由呼叫端決定如何提示使用者） */
  onError?: (type: PhotoErrorType) => void;
}

/**
 * 共用的照片管理 Hook。
 *
 * 封裝照片的壓縮、儲存、刪除、CameraView 狀態控制。
 * 不負責 UI 狀態（Gallery 開關、ShareMenu、toast）— 由呼叫端透過回調自行處理。
 */
export const usePhotoManager = ({
  contextId,
  currentPhotoIds,
  onPhotosAdded,
  onPhotoDeleted,
  onError,
}: UsePhotoManagerProps) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // 使用 Ref 避免非同步操作中的過時閉包
  const contextIdRef = useRef(contextId);
  const currentIdsRef = useRef(currentPhotoIds);
  const callbacksRef = useRef({ onPhotosAdded, onPhotoDeleted, onError });

  useEffect(() => { contextIdRef.current = contextId; }, [contextId]);
  useEffect(() => { currentIdsRef.current = currentPhotoIds; }, [currentPhotoIds]);
  useEffect(() => { callbacksRef.current = { onPhotosAdded, onPhotoDeleted, onError }; });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const openCamera = useCallback(() => setIsCameraOpen(true), []);
  const closeCamera = useCallback(() => setIsCameraOpen(false), []);
  const openPhotoLibrary = useCallback(() => galleryInputRef.current?.click(), []);

  /**
   * CameraView 批次拍攝後的處理。
   * 壓縮每張照片 → 存入 IndexedDB → 呼叫 onPhotosAdded → 關閉相機。
   */
  const handleCameraBatchCapture = useCallback(async (blobs: Blob[]) => {
    if (blobs.length === 0) {
      setIsCameraOpen(false);
      return;
    }

    const newPhotoIds: string[] = [];

    for (const blob of blobs) {
      try {
        const optimizedBlob = await compressAndResizeImage(blob, 1, 1920);
        const savedImg = await imageService.saveImage(
          optimizedBlob,
          contextIdRef.current,
          'session'
        );
        newPhotoIds.push(savedImg.id);
      } catch (err) {
        console.error('Failed to save camera capture', err);
      }
    }

    if (newPhotoIds.length > 0) {
      callbacksRef.current.onPhotosAdded(
        [...currentIdsRef.current, ...newPhotoIds],
        'camera'
      );
    }

    setIsCameraOpen(false);
  }, []);

  /**
   * 從檔案選擇器上傳照片的處理（綁定至 hidden <input onChange>）。
   * 壓縮 → 存入 IndexedDB → 呼叫 onPhotosAdded。
   */
  const handlePhotoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const objectUrl = URL.createObjectURL(file);

        compressAndResizeImage(objectUrl, 1, 1920)
          .then(async (compressedBlob) => {
            try {
              const savedImg = await imageService.saveImage(
                compressedBlob,
                contextIdRef.current,
                'session'
              );
              callbacksRef.current.onPhotosAdded(
                [...currentIdsRef.current, savedImg.id],
                'upload'
              );
            } catch (err) {
              console.error('Photo save failed', err);
              callbacksRef.current.onError?.('save');
            } finally {
              URL.revokeObjectURL(objectUrl);
            }
          })
          .catch((err) => {
            console.error('Photo compression failed', err);
            callbacksRef.current.onError?.('compress');
            URL.revokeObjectURL(objectUrl);
          });
      }
      e.target.value = '';
    },
    []
  );

  /**
   * 刪除照片。
   * 從 IndexedDB 移除 → 呼叫 onPhotoDeleted。
   */
  const handleDeletePhoto = useCallback(async (id: string) => {
    try {
      await imageService.deleteImage(id);
      const updatedIds = currentIdsRef.current.filter((pid) => pid !== id);
      callbacksRef.current.onPhotoDeleted(updatedIds);
    } catch (err) {
      console.error('Photo delete failed', err);
      callbacksRef.current.onError?.('delete');
    }
  }, []);

  return {
    isCameraOpen,
    openCamera,
    closeCamera,
    handleCameraBatchCapture,
    handlePhotoSelect,
    handleDeletePhoto,
    openPhotoLibrary,
    photoInputRef,
    galleryInputRef,
  };
};
