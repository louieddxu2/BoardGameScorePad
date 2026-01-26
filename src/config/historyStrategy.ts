
import { AppView } from '../types';

/**
 * 歷史紀錄防護牆策略 (History Wall Strategy)
 * 
 * 定義 App 在不同狀態下，應該在瀏覽器歷史紀錄中保留多少「緩衝層」。
 * 
 * - 層數 0: 完全不保護，按上一頁直接由瀏覽器處理（通常會離開頁面）。
 * - 層數 1: 最低限度保護。防止「一次」誤觸導致 App 關閉。適合目錄頁。
 * - 層數 3: 高度保護。防止連續誤觸。適合遊戲進行中，確保資料安全。
 */

const WALL_DEPTH_CONFIG: Record<AppView, number> = {
    // [低風險區] 目錄頁：只需防止手滑按到一次上一頁
    [AppView.DASHBOARD]: 1,
    
    // [低風險區] 模板編輯器：雖然有資料，但在編輯模式下我們通常依賴 React State 的保留，
    // 且編輯器有自己的取消/儲存按鈕，防護 1 層即可。
    [AppView.TEMPLATE_CREATOR]: 1,

    // [高風險區] 進行中遊戲：絕對不能因為連按兩下上一頁就退出
    // 這邊設定 3 層，讓使用者有足夠的「後悔空間」
    [AppView.ACTIVE_SESSION]: 3,

    // [高風險區] 歷史回顧：為了避免在查看詳細資料時意外退出整個 App
    // 雖然資料是唯讀的，但保持與 Session 一致的體驗較佳
    [AppView.HISTORY_REVIEW]: 3,
};

/**
 * 計算當前狀態所需的目標牆壁厚度
 * 
 * @param view 目前的應用程式視圖
 * @param hasPendingTemplate 是否正在「遊戲設定彈窗」(GameSetupModal) 中
 */
export const getTargetHistoryDepth = (view: AppView, hasPendingTemplate: boolean): number => {
    // 特殊規則：如果正在設定新遊戲 (Pending Template)，
    // 我們視為「準遊戲狀態」，給予 1 層防護即可 (因為還沒開始計分，風險較低，且 SetupModal 自己有 Back Handler)
    if (hasPendingTemplate) {
        return 1;
    }

    // 預設規則：查表
    return WALL_DEPTH_CONFIG[view] ?? 1;
};
