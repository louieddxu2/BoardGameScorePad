import React, { useRef, useState } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface SwipeOptions {
  minSwipeDistance?: number; // 最小觸發距離 (慢速拖曳時)
  minFlickDistance?: number; // 快速撥動的最小距離 (避免極微小的誤觸)
  flickThreshold?: number;   // 判定為快速撥動的速度門檻 (pixels/ms)
}

export const useSwipe = (
  { onSwipeLeft, onSwipeRight }: SwipeHandlers, 
  options: SwipeOptions = {}
) => {
  // 預設參數調整：
  // 1. flickThreshold 0.3 -> 0.2 (輕輕撥動即可)
  const { 
    minSwipeDistance = 50, 
    minFlickDistance = 30,
    flickThreshold = 0.2 
  } = options;
  
  const touchStart = useRef<{ x: number, y: number } | null>(null);
  const touchStartTime = useRef<number>(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  
  // 用來鎖定本次觸控的方向，避免斜向滑動時兩邊都在動
  // null: 尚未決定, 'h': 水平滑動中, 'v': 垂直捲動中
  const axisLock = useRef<'h' | 'v' | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    };
    touchStartTime.current = Date.now();
    axisLock.current = null;
    setSwipeOffset(0);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return;

    const currentX = e.targetTouches[0].clientX;
    const currentY = e.targetTouches[0].clientY;
    
    const distanceX = currentX - touchStart.current.x;
    const distanceY = currentY - touchStart.current.y;

    // 尚未鎖定方向時，進行判斷
    if (!axisLock.current) {
        // [調整] 將鎖定門檻從 6px 調降至 5px，讓水平偵測極度靈敏，幾乎是一動即鎖定
        if (Math.abs(distanceX) > 5 || Math.abs(distanceY) > 5) {
            if (Math.abs(distanceX) > Math.abs(distanceY)) {
                axisLock.current = 'h';
            } else {
                axisLock.current = 'v';
            }
        }
    }

    // 如果判定為垂直捲動，則不處理水平位移，讓瀏覽器原生捲動生效
    if (axisLock.current === 'v') {
        return;
    }

    // 如果判定為水平滑動，則阻止瀏覽器預設行為 (如上一頁/下一頁手勢)，並更新位移
    if (axisLock.current === 'h') {
        if (e.cancelable) e.preventDefault(); // 關鍵：防止與頁面捲動衝突
        setSwipeOffset(distanceX);
    }
  };

  const onTouchEnd = () => {
    if (!touchStart.current) return;
    
    // 計算滑動時間與速度
    const timeDiff = Date.now() - touchStartTime.current;
    const velocity = Math.abs(swipeOffset) / timeDiff; // px per ms
    const isFlick = velocity > flickThreshold && Math.abs(swipeOffset) > minFlickDistance;

    // 只有在鎖定為水平滑動時才觸發切換
    if (axisLock.current === 'h') {
        // 觸發條件：(距離足夠) 或者 (速度夠快且有一定距離)
        if (swipeOffset > minSwipeDistance || (isFlick && swipeOffset > 0)) {
            onSwipeRight && onSwipeRight();
        } else if (swipeOffset < -minSwipeDistance || (isFlick && swipeOffset < 0)) {
            onSwipeLeft && onSwipeLeft();
        }
    }

    // 重置
    touchStart.current = null;
    axisLock.current = null;
    setSwipeOffset(0);
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    swipeOffset
  };
};