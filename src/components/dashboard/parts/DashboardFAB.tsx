
import React from 'react';
import { BarChart3, Play } from 'lucide-react';
import { useDashboardTranslation } from '../../../i18n/dashboard';

interface DashboardFABProps {
  onClick: () => void;
  isVisible: boolean;
  mode?: 'play' | 'stats';
  title?: string;
}

const DashboardFAB: React.FC<DashboardFABProps> = ({ onClick, isVisible, mode = 'play', title }) => {
  const { t } = useDashboardTranslation();
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
      className="absolute text-white rounded-full flex items-center justify-center z-40 transition-all duration-200 active:scale-95 animate-in zoom-in btn-fab-primary animate-guide-pulse"
      title={title || t('card_start_new')}
      style={{
        width: '56px',
        height: '56px',
        right: '17px',
        bottom: '4px',
        // 不使用 safe-area-inset，以確保與 fixed bottom-0 的面板按鈕在視覺上重疊
      }}
    >
      {mode === 'stats'
        ? <BarChart3 size={24} />
        : <Play size={24} fill="currentColor" className="ml-1" />
      }
    </button>
  );
};

export default DashboardFAB;
