
import React, { useState, useEffect } from 'react';
import { X, Copy, Download, Share, Loader2, Image as ImageIcon, LayoutPanelLeft } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { GameSession, GameTemplate } from '../../../types';
import { ScreenshotLayout } from '../hooks/useSessionState';
import ScreenshotView from '../parts/ScreenshotView';
import { useToast } from '../../../hooks/useToast';

interface ScreenshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: 'full' | 'simple';
  session: GameSession;
  template: GameTemplate;
  zoomLevel: number;
  layout: ScreenshotLayout | null;
}

interface SnapshotCache {
  blob: Blob | null;
  url: string | null;
}

const ScreenshotModal: React.FC<ScreenshotModalProps> = ({
  isOpen,
  onClose,
  initialMode,
  session,
  template,
  zoomLevel,
  layout
}) => {
  const [activeMode, setActiveMode] = useState<'full' | 'simple'>(initialMode);
  
  // Cache state for both modes
  const [snapshots, setSnapshots] = useState<{
    full: SnapshotCache;
    simple: SnapshotCache;
  }>({
    full: { blob: null, url: null },
    simple: { blob: null, url: null }
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const { showToast } = useToast();
  
  // Cleanup object URLs on unmount or close
  useEffect(() => {
    if (!isOpen) {
        if (snapshots.full.url) URL.revokeObjectURL(snapshots.full.url);
        if (snapshots.simple.url) URL.revokeObjectURL(snapshots.simple.url);
        
        setSnapshots({
            full: { blob: null, url: null },
            simple: { blob: null, url: null }
        });
        setActiveMode(initialMode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Effect: Generate image for active mode if missing
  useEffect(() => {
    if (!isOpen) return;

    const generateCurrentMode = async () => {
        // If already cached, do nothing (instant switch)
        if (snapshots[activeMode].url) return;

        setIsGenerating(true);
        // Delay to allow DOM render. Crucial.
        await new Promise(r => setTimeout(r, 200));

        const targetId = `screenshot-target-${activeMode}`;
        const target = document.getElementById(targetId);

        if (!target) {
            console.error(`Target ${targetId} not found`);
            setIsGenerating(false);
            return;
        }
        
        // Ensure dimensions are valid
        if (target.offsetWidth === 0 || target.offsetHeight === 0) {
             console.error(`Target ${targetId} has 0 dimensions!`);
             setIsGenerating(false);
             return;
        }

        try {
             // Force font load
            const fontStyles = `normal ${16 * zoomLevel}px Inter`;
            await document.fonts.load(fontStyles);

            const blob = await toBlob(target, {
                backgroundColor: '#0f172a',
                pixelRatio: 2,
                width: target.offsetWidth,
                height: target.offsetHeight,
                style: { 
                    transform: 'none',
                    fontFamily: 'Inter, sans-serif'
                }
            });

            if (blob) {
                const url = URL.createObjectURL(blob);
                setSnapshots(prev => ({
                    ...prev,
                    [activeMode]: { blob, url }
                }));
            }
        } catch (err) {
            console.error("Screenshot generation failed", err);
            showToast({ message: "圖片產生失敗，請重試", type: 'error' });
        } finally {
            setIsGenerating(false);
        }
    };

    generateCurrentMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeMode]);


  const handleCopy = async () => {
    const currentBlob = snapshots[activeMode].blob;
    if (!currentBlob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': currentBlob })]);
      showToast({ message: "已複製到剪貼簿", type: 'success' });
    } catch (err) {
      console.error(err);
      showToast({ message: "複製失敗，請嘗試下載", type: 'error' });
    }
  };

  const handleDownload = () => {
    const currentBlob = snapshots[activeMode].blob;
    if (!currentBlob) return;
    const url = URL.createObjectURL(currentBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name}_${activeMode}_${new Date().toISOString().slice(0,10)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast({ message: "下載已開始", type: 'success' });
  };

  const handleShare = async () => {
    const currentBlob = snapshots[activeMode].blob;
    if (!currentBlob) return;
    try {
      const file = new File([currentBlob], `${template.name}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: template.name,
          text: `這是我們玩《${template.name}》的分數！`
        });
      } else {
        showToast({ message: "您的瀏覽器不支援直接分享圖片", type: 'warning' });
      }
    } catch (err) {
      console.log('Share canceled or failed', err);
    }
  };

  if (!isOpen) return null;

  const currentPreviewUrl = snapshots[activeMode].url;
  const showLoading = isGenerating && !currentPreviewUrl;

  return (
    // Backdrop with onClick to close
    <div 
        className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={onClose}
    >
      
      {/* 
         Hidden container with BOTH views rendered simultaneously.
         CRITICAL FIXES:
         1. position fixed, but FAR OFF SCREEN (left: -200vw) so it doesn't block interactions.
         2. top: 0 to ensure it's "in view" vertically for rendering engines if needed.
         3. pointerEvents: none to double safety against clicks.
         4. ScreenshotView now renders as static/absolute (removed fixed class inside ScreenshotView)
      */}
      <div style={{ position: 'fixed', left: '-200vw', top: 0, opacity: 0, pointerEvents: 'none' }}>
         <ScreenshotView 
            id="screenshot-target-full"
            className="absolute top-0 left-0" // Explicit positioning within the hidden container
            session={session}
            template={template}
            zoomLevel={zoomLevel}
            mode="full"
            layout={layout}
         />
         <ScreenshotView 
            id="screenshot-target-simple"
            className="absolute top-0 left-0"
            session={session}
            template={template}
            zoomLevel={zoomLevel}
            mode="simple"
            layout={layout}
         />
      </div>

      {/* Main Modal Container */}
      <div 
        className="bg-slate-900 w-[95vw] h-[90vh] max-w-6xl rounded-2xl shadow-2xl border border-slate-800 flex flex-col relative"
        onClick={e => e.stopPropagation()} // Prevent click-through closing
      >
        
        {/* Header */}
        <div className="flex-none bg-slate-800 px-4 py-3 rounded-t-2xl border-b border-slate-700 flex items-center justify-between z-10">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Share size={20} className="text-emerald-500"/> 分享結果
            </h3>
            
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                <button 
                    onClick={() => setActiveMode('full')}
                    disabled={isGenerating}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeMode === 'full' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <ImageIcon size={14} /> 完整版
                </button>
                <button 
                    onClick={() => setActiveMode('simple')}
                    disabled={isGenerating}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeMode === 'simple' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <LayoutPanelLeft size={14} /> 簡潔版
                </button>
            </div>

            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-600 rounded-full transition-colors"><X size={20} /></button>
        </div>

        {/* Preview Area */}
        <div className="flex-1 min-h-0 bg-slate-950 relative flex flex-col z-0">
            <div className="flex-1 w-full h-full p-4 overflow-hidden flex items-center justify-center">
                {showLoading ? (
                    <div className="flex flex-col items-center gap-4 text-emerald-500 animate-in fade-in zoom-in duration-300">
                        <div className="relative">
                            <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse"></div>
                            <Loader2 size={48} className="animate-spin relative z-10" />
                        </div>
                        <span className="text-sm font-bold animate-pulse tracking-wider">正在繪製圖片...</span>
                    </div>
                ) : currentPreviewUrl ? (
                    <img 
                        src={currentPreviewUrl} 
                        alt="Preview" 
                        className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-slate-800" 
                    />
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-red-400 text-sm border border-red-900/50 bg-red-900/10 px-4 py-2 rounded-lg">預覽載入失敗</span>
                        <button onClick={() => { setSnapshots(p => ({...p, [activeMode]: {url:null, blob:null}})); setActiveMode(m => m); }} className="text-xs text-slate-500 underline">重試</button>
                    </div>
                )}
            </div>
        </div>

        {/* Actions Footer */}
        <div className="flex-none p-4 bg-slate-800 rounded-b-2xl border-t border-slate-700 flex justify-center gap-4 z-10">
            <button onClick={handleCopy} disabled={isGenerating || !currentPreviewUrl} className="flex-1 max-w-[200px] flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <Copy size={18} className="text-emerald-400" />
                <span className="font-bold">複製</span>
            </button>
            <button onClick={handleDownload} disabled={isGenerating || !currentPreviewUrl} className="flex-1 max-w-[200px] flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <Download size={18} className="text-sky-400" />
                <span className="font-bold">下載</span>
            </button>
            <button onClick={handleShare} disabled={isGenerating || !currentPreviewUrl} className="flex-1 max-w-[200px] flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <Share size={18} className="text-indigo-400" />
                <span className="font-bold">分享</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default ScreenshotModal;
