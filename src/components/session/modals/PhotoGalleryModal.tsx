
import React, { useState, useEffect } from 'react';
import { X, Camera, Image as ImageIcon, Loader2, Upload } from 'lucide-react';
import { imageService } from '../../../services/imageService';
import PhotoLightbox from '../parts/PhotoLightbox';
import ConfirmationModal from '../../shared/ConfirmationModal';

interface PhotoGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  photoIds: string[];
  onUploadPhoto: () => void; // New
  onTakePhoto: () => void;   // New
  onDeletePhoto: (id: string) => void;
}

interface LoadedImage {
    id: string;
    url: string;
}

const PhotoGalleryModal: React.FC<PhotoGalleryModalProps> = ({ isOpen, onClose, photoIds, onUploadPhoto, onTakePhoto, onDeletePhoto }) => {
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<LoadedImage | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);

  // Load images when IDs change or modal opens
  useEffect(() => {
      if (!isOpen) {
          // Cleanup URLs when closed
          images.forEach(img => URL.revokeObjectURL(img.url));
          setImages([]);
          return;
      }

      let active = true;
      const generatedUrls: string[] = [];

      const loadImages = async () => {
          setLoading(true);
          const loaded: LoadedImage[] = [];
          
          for (const id of photoIds) {
              if (!active) break;
              try {
                  const localImg = await imageService.getImage(id);
                  if (localImg) {
                      const url = URL.createObjectURL(localImg.blob);
                      generatedUrls.push(url);
                      loaded.push({
                          id: id,
                          url: url
                      });
                  }
              } catch (e) {
                  console.error(`Failed to load image ${id}`, e);
              }
          }
          
          if (active) {
              setImages(loaded);
              setLoading(false);
          } else {
              // If cancelled/unmounted, revoke what we just created
              generatedUrls.forEach(url => URL.revokeObjectURL(url));
          }
      };

      loadImages();

      // Cleanup function for when deps change or unmount
      return () => {
          active = false;
          generatedUrls.forEach(url => URL.revokeObjectURL(url));
      };
  }, [isOpen, photoIds]); // Re-run when photoIds changes (add/delete)

  const handleDeleteConfirm = () => {
      if (photoToDelete) {
          onDeletePhoto(photoToDelete);
          setSelectedPhoto(null); // Close lightbox if open
          setPhotoToDelete(null);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/90 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
      <ConfirmationModal 
        isOpen={!!photoToDelete}
        title="刪除照片？"
        message="確定要刪除這張照片嗎？此動作無法復原。"
        confirmText="刪除"
        isDangerous={true}
        onCancel={() => setPhotoToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />

      {selectedPhoto && (
          <PhotoLightbox 
            imageSrc={selectedPhoto.url} 
            onClose={() => setSelectedPhoto(null)} 
            onDelete={() => setPhotoToDelete(selectedPhoto.id)}
          />
      )}

      {/* Header */}
      <div className="flex-none bg-slate-900 p-3 border-b border-slate-800 flex items-center justify-between z-10 gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
            <div className="p-2 bg-indigo-500/10 rounded-lg shrink-0">
                <ImageIcon size={20} className="text-indigo-400" />
            </div>
            <div className="flex flex-col min-w-0">
                <h3 className="text-base font-bold text-white truncate">遊戲照片庫</h3>
                <span className="text-[10px] text-slate-500">{photoIds.length} 張照片</span>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={onUploadPhoto} 
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold border border-slate-700 transition-colors"
            >
                <Upload size={14} /> <span className="hidden sm:inline">上傳</span>
            </button>
            <button 
                onClick={onTakePhoto} 
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md transition-colors"
            >
                <Camera size={14} /> <span className="hidden sm:inline">拍照</span>
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-full transition-colors ml-1">
                <X size={20} />
            </button>
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-4">
          {loading && images.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-2">
                  <Loader2 size={32} className="animate-spin text-indigo-500" />
                  <span className="text-sm">載入照片中...</span>
              </div>
          ) : (
              <div className="grid grid-cols-3 gap-1 auto-rows-fr">
                  {/* Image Tiles */}
                  {images.map(img => (
                      <div 
                        key={img.id} 
                        onClick={() => setSelectedPhoto(img)}
                        className="aspect-square bg-black rounded-lg overflow-hidden relative cursor-pointer group active:scale-95 transition-transform border border-slate-800"
                      >
                          <img src={img.url} className="w-full h-full object-cover" alt="Session Photo" loading="lazy" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      </div>
                  ))}
              </div>
          )}
          
          {images.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center">
                      <ImageIcon size={32} className="opacity-50" />
                  </div>
                  <p className="text-sm">尚無照片</p>
                  <p className="text-xs max-w-[200px] text-center opacity-70">點擊右上角的按鈕來新增這場遊戲的精彩時刻！</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default PhotoGalleryModal;
