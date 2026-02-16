
import React from 'react';
import { Play } from 'lucide-react';

interface DashboardFABProps {
  onClick: () => void;
  isVisible: boolean;
}

const DashboardFAB: React.FC<DashboardFABProps> = ({ onClick, isVisible }) => {
  if (!isVisible) return null;

  return (
    <button
      onClick={onClick}
      // 回復為圓形 (rounded-full)
      // 使用固定像素尺寸 (56px) 以防止縮放影響
      // 定位計算：StartGamePanel 的按鈕為 90x60，位於 bottom-0 right-0
      // 為了讓圓形按鈕 (56x56) 的中心點與面板按鈕對齊：
      // Right: (90 - 56) / 2 = 17px
      // Bottom: (60 - 56) / 2 = 2px (視覺微調為 4px)
      className="absolute bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-900/50 flex items-center justify-center z-40 transition-all active:scale-95 animate-in zoom-in duration-200"
      title="開始新遊戲"
      style={{ 
        width: '56px', 
        height: '56px',
        right: '17px',
        bottom: '4px',
        // 不使用 safe-area-inset，以確保與 fixed bottom-0 的面板按鈕在視覺上重疊
      }}
    >
      <Play size={24} fill="currentColor" className="ml-1" />
    </button>
  );
};

export default DashboardFAB;
