
import React from 'react';
import { Cloud, Search } from 'lucide-react';
import { PullActionState } from '../../../hooks/usePullAction';

interface PullActionIslandProps {
  pullY: number;
  pullX: number;
  activeState: PullActionState;
}

const PullActionIsland: React.FC<PullActionIslandProps> = ({ pullY, pullX, activeState }) => {
  // 1. 基礎可見度控制
  if (pullY < 1) return null;

  // 2. 動態高度與透明度計算
  const maxHeight = 100;
  const height = Math.min(maxHeight, pullY); 
  // 極致靈敏：從 1px 開始淡入，到 20px (觸發點) 時完全不透明
  const opacity = Math.min(1, Math.max(0, (pullY - 1) / 19)); 
  
  // 3. 焦點光環 (Focus Ring) 位置計算
  // [數學修正] 精確計算圖示中心點
  // Container Half Width: 100px (w-200px / 2)
  // Padding Left: 32px (px-8)
  // Icon Half Width: 12px (w-6 / 2)
  // Icon Center from Edge: 32 + 12 = 44px
  // Distance from Center: 100 - 44 = 56px
  const SNAP_DISTANCE = 56; 
  
  let ringTranslateX = 0;

  if (activeState === 'cloud') {
      // [鎖定模式] 直接吸附到左側按鈕中心
      ringTranslateX = -SNAP_DISTANCE;
  } else if (activeState === 'search') {
      // [鎖定模式] 直接吸附到右側按鈕中心
      ringTranslateX = SNAP_DISTANCE;
  } else {
      // [跟隨模式] 隨手指移動，但限制最大範圍
      // 係數 0.8 配合高靈敏度
      ringTranslateX = Math.max(-SNAP_DISTANCE, Math.min(SNAP_DISTANCE, pullX * 0.8));
  }

  // 4. 顏色狀態
  const isCloudActive = activeState === 'cloud';
  const isSearchActive = activeState === 'search';

  return (
    <div 
      className="absolute top-0 left-0 right-0 z-20 flex justify-center pointer-events-none overflow-hidden"
      style={{ 
        height: `${height}px`,
        opacity: opacity,
        transformOrigin: 'top',
        // 讓容器本身也有一個下拉的感覺，而不只是變高
        transform: `translateY(${Math.min(0, height - maxHeight)}px)` 
      }}
    >
      <div className="flex flex-col justify-end pb-3 items-center w-full">
        
        {/* 背景膠囊軌道 (The Track) */}
        {/* w-[200px] = 100px center. px-8 = 32px padding */}
        <div className="relative bg-slate-800/90 backdrop-blur-md rounded-full px-8 py-2.5 flex items-center justify-between w-[200px] border border-slate-700/50 shadow-xl box-border">
            
            {/* 左錨點：雲端 */}
            <div className={`transition-all duration-300 transform flex flex-col items-center justify-center w-6 h-6 ${isCloudActive ? 'scale-125 text-sky-400' : 'text-slate-500 scale-100'}`}>
                <Cloud size={20} strokeWidth={isCloudActive ? 2.5 : 2} />
            </div>

            {/* 中錨點：原點 */}
            <div className={`transition-all duration-300 transform ${activeState === 'neutral' ? 'scale-100 text-slate-400' : 'scale-50 text-slate-600'}`}>
                <div className="w-1.5 h-1.5 bg-current rounded-full" />
            </div>

            {/* 右錨點：搜尋 */}
            <div className={`transition-all duration-300 transform flex flex-col items-center justify-center w-6 h-6 ${isSearchActive ? 'scale-125 text-emerald-400' : 'text-slate-500 scale-100'}`}>
                <Search size={20} strokeWidth={isSearchActive ? 2.5 : 2} />
            </div>

            {/* 焦點光環 (The Focus Ring / Cursor) */}
            <div 
                className={`absolute top-1/2 left-1/2 -ml-6 -mt-6 w-12 h-12 rounded-full border-[3px] pointer-events-none
                    ${isCloudActive ? 'border-sky-400 bg-sky-400/20 shadow-[0_0_15px_rgba(56,189,248,0.5)]' : 
                      isSearchActive ? 'border-emerald-400 bg-emerald-400/20 shadow-[0_0_15px_rgba(52,211,153,0.5)]' : 
                      'border-slate-400/30 w-10 h-10 -ml-5 -mt-5' // Neutral 狀態稍微小一點
                    }
                `}
                style={{
                    transform: `translateX(${ringTranslateX}px)`,
                    // [關鍵動畫] 加入 transform transition，讓它在吸附時有彈跳感
                    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.2s, height 0.2s, margin 0.2s, border-color 0.2s, background-color 0.2s' 
                }}
            />
        </div>

        {/* 提示文字 */}
        <div 
            className="absolute bottom-9 opacity-0 transition-all duration-300 transform translate-y-2" 
            style={{ 
                opacity: activeState !== 'neutral' ? 1 : 0,
                transform: activeState !== 'neutral' ? 'translateY(0)' : 'translateY(4px)'
            }}
        >
             <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900/90 backdrop-blur-sm border border-slate-700 shadow-lg ${isCloudActive ? 'text-sky-400' : 'text-emerald-400'}`}>
                 {isCloudActive ? '放開管理雲端' : '放開開始搜尋'}
             </span>
        </div>

      </div>
    </div>
  );
};

export default PullActionIsland;
