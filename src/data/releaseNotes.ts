// User-facing release notes shown in Settings → About.
// One entry per main release; prepare the first entry before merging into main.
// Routine V3test publishes do not require release-note updates.
// Follow the Release Notes rules in AGENTS.md.

export type ReleaseNoteKind = 'new' | 'improved' | 'fixed';

export interface ReleaseNoteItem {
  kind: ReleaseNoteKind;
  zh: string;
  /** Omit when the item should not appear in English. */
  en?: string;
}

export interface ReleaseNote {
  /** Main release date (YYYY-MM-DD); omitted until the entry is ready to merge into main. */
  date?: string;
  /** Version name used in earlier announcements, when there was one. */
  version?: string;
  items: ReleaseNoteItem[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    date: '2026-11-07',
    items: [
      { kind: 'new', zh: '新增設定頁，集中介面設定、備份與匯入。',
        en: 'Settings brings appearance, language, backup and imports together.' },
      { kind: 'new', zh: 'ZIP 備份含照片；還原覆蓋本機資料，略過缺損項目。',
        en: 'ZIP backups include photos. Restoring replaces local data and skips missing or damaged items.' },
      { kind: 'new', zh: '還原前預覽備份，本機紀錄較新時提醒。',
        en: 'Preview backups before restoring, with a warning about newer local records.' },
      { kind: 'new', zh: '設定頁新增更新日誌。', en: 'Update history is available in Settings.' },
      { kind: 'new', zh: '歷史清單、統計與照片回顧可依年月日或範圍篩選。',
        en: 'Filter history, statistics and photo recaps by day, month, year or range.' },
      { kind: 'new', zh: '照片回顧標示日期範圍與精選數量，單款可選多場照片。',
        en: 'Recaps show dates and selection counts; one-game views can use multiple plays.' },
      { kind: 'improved', zh: '搜尋先保留明顯較相關的結果，再優先顯示近期遊戲。',
        en: 'Search keeps clear leading matches first, then prioritizes recently played games.' },
      { kind: 'improved', zh: '下一步改為向下，移除方向設定。',
        en: 'Next advances downward; the direction setting is removed.' },
      { kind: 'improved', zh: '手機版系統資料檢視器加寬關聯名稱欄。',
        en: 'Widened the relation name column in the mobile System Data Inspector.' },
      { kind: 'fixed', zh: '儲存遊戲紀錄後，才記住結束時的人數。',
        en: 'Remember the final player count only after saving to history.' },
      { kind: 'fixed', zh: '搜尋結果缺少人數資料時，不再預設為 4 人。',
        en: 'Search no longer assumes four players when player-count data is missing.' },
      { kind: 'fixed', zh: '長圖預覽可完整捲看。', en: 'Tall previews scroll fully.' },
      { kind: 'fixed', zh: '長確認訊息可捲動，按鈕保持可見。',
        en: 'Long confirmations scroll while buttons stay visible.' },
      { kind: 'fixed', zh: '首頁按鈕縮放時間距固定。', en: 'Home button spacing stays fixed while zoomed.' },
      { kind: 'fixed', zh: '離開遊戲時取消未完成的雲端背景圖下載。',
        en: 'Leaving a game cancels unfinished cloud background downloads.' },
    ],
  },
  // main: 235a6aa..59dd1ab (fast-forward on 2026-10-28).
  {
    date: '2026-10-28',
    items: [
      { kind: 'new', zh: '新增暖紙淺色與鼠尾草綠色系。', en: 'Added Warm paper and Sage themes.' },
      { kind: 'improved', zh: '調整淺色文字與表格樣式，簡化首頁層次。',
        en: 'Refined light-theme text, tables and home sections.' },
      { kind: 'improved', zh: '照片名牌依明暗切換深淺樣式，皇冠移至右上角。',
        en: 'Photo brightness selects dark or light name plates; crowns sit at the top right.' },
      { kind: 'fixed', zh: '一般介面與分享照片保留自選文字色。',
        en: 'Standard UI and shared photos preserve chosen text colors.' },
      { kind: 'fixed', zh: '單款回顧省略款數。', en: 'Recaps omit redundant game counts.' },
      { kind: 'fixed', zh: '修正白色總分預覽難以辨識。', en: 'Fixed unreadable white total previews.' },
    ],
  },
  // main: 7ee54b6..235a6aa (fast-forward on 2026-10-19).
  {
    date: '2026-10-19',
    items: [
      { kind: 'new', zh: '分享照片可標示合作遊戲結果。', en: 'Shared photos can show cooperative outcomes.' },
      { kind: 'new', zh: '照片瀏覽支援滑動預覽，並保存旋轉。',
        en: 'Swipe between photo previews; rotations are saved.' },
      { kind: 'new', zh: '計分板修改會自動同步給房間成員。',
        en: 'Board edits sync to participants automatically.' },
      { kind: 'improved', zh: '分享版面依照片調整標題與配色。',
        en: 'Shared photo titles and colors adapt to the photo.' },
      { kind: 'improved', zh: '建立房間前顯示說明並確認。',
        en: 'Room creation includes an explanation and confirmation.' },
      { kind: 'improved', zh: '多人連線狀態統一為角落徽章。', en: 'Multiplayer status uses corner badges.' },
      { kind: 'fixed', zh: '修正多人輸入順序、重連與離開房間問題。',
        en: 'Fixed multiplayer input ordering, reconnects and room exits.' },
      { kind: 'fixed', zh: '修正 Google Drive 同時備份造成的錯誤。',
        en: 'Fixed conflicts between concurrent Google Drive backups.' },
      { kind: 'fixed', zh: 'BG Stats 匯入補上 BGG 編號。', en: 'BG Stats imports fill missing BGG IDs.' },
      { kind: 'fixed', zh: '計分表空白處可拖曳。', en: 'Score grids can pan from empty space.' },
    ],
  },
  // main: 8d345e0..9727c61 (two merges on 2026-10-02; 2026-10-03 only updated tooling/cache).
  {
    date: '2026-10-02',
    items: [
      { kind: 'improved', zh: '按鈕與選項文字依空間調整字級，縮放時間距固定。',
        en: 'Button and option text fits available space; zoom keeps spacing fixed.' },
      { kind: 'improved', zh: '調整甜蜜國度選項版面。' },
      { kind: 'fixed', zh: '修正雙指縮放誤觸，以及照片縮放與拖曳衝突。',
        en: 'Fixed pinch-triggered taps and photo zoom/drag conflicts.' },
      { kind: 'fixed', zh: '拖曳排序依插入線位置放下。', en: 'Reordering follows the insertion line.' },
    ],
  },
  // main: b35011d..8d345e0 (merged on 2026-09-30).
  {
    date: '2026-09-30',
    items: [
      { kind: 'new', zh: '快速開始列出最近遊戲，最多五款。', en: 'Quick start lists up to five recent games.' },
      { kind: 'new', zh: '內建計分板新增甜蜜國度。' },
      { kind: 'improved', zh: '開局時推薦地點與人數。', en: 'Setup suggests location and player count.' },
      { kind: 'improved', zh: '進行中與釘選遊戲改為整列可點。',
        en: 'Active and pinned games are clickable across the row.' },
      { kind: 'fixed', zh: '備忘錄在鍵盤開啟時保持可見。', en: 'Memos stay visible above the keyboard.' },
      { kind: 'fixed', zh: '快速返回可關閉多層視窗。', en: 'Rapid back presses close stacked dialogs.' },
      { kind: 'fixed', zh: '簡易計分板儲存後保留釘選。', en: 'Simple boards stay pinned after saving.' },
    ],
  },
  // main: 78437d1..b35011d (merged on 2026-09-02).
  {
    date: '2026-09-02',
    items: [
      { kind: 'new', zh: '統計面板可搜尋。', en: 'Search statistics.' },
      { kind: 'new', zh: '工具箱顯示本局照片。', en: 'Session photos in the toolbox.' },
      { kind: 'improved', zh: '競爭遊戲全員零分時顯示勝負。',
        en: 'Competitive games show outcomes when all scores are zero.' },
      { kind: 'improved', zh: '加大玩家名稱建議按鈕。', en: 'Larger player name suggestions.' },
      { kind: 'fixed', zh: '修正 iPhone 與 Android 的輸入面板遮擋與跑位。',
        en: 'Fixed toolbar overlap and score-panel positioning on iPhone Safari and Android.' },
    ],
  },
  // main: 9f8c367..78437d1 (merged on 2026-08-21; the tip also includes a documentation commit).
  {
    date: '2026-08-21',
    items: [
      { kind: 'improved', zh: '玩家、人數與地點推薦納入近期習慣與名次。',
        en: 'Player, count and location suggestions use recent habits and rankings.' },
      { kind: 'improved', zh: '抽起始玩家優先採用手動確認人選，並區分同名玩家。',
        en: 'Starter draws favor manually confirmed candidates and distinguish same-name players.' },
      { kind: 'fixed', zh: '滑動後點擊數字鍵盤更穩定。', en: 'Keypad taps after a swipe are more reliable.' },
      { kind: 'fixed', zh: '單人競爭遊戲顯示勝利皇冠。', en: 'Solo competitive games show the winner crown.' },
    ],
  },
  // main: 2269814..9f8c367 (fast-forward on 2026-08-07).
  {
    date: '2026-08-07',
    items: [
      { kind: 'new', zh: '多人同步計分：掃 QR Code 加入，各自輸入，由房主保存。',
        en: 'Multiplayer scoring via QR code; the host saves the result.' },
      { kind: 'new', zh: '歷史統計含勝率、最高分與玩家紀錄，支援日期、地點及人數篩選。',
        en: 'History stats show win rates, high scores and player records, with date, location and player-count filters.' },
      { kind: 'new', zh: '照片回顧拼貼支援裁切、換圖與分享。',
        en: 'Photo recaps: crop, replace photos and share.' },
      { kind: 'new', zh: '多人觸碰螢幕抽順位，並推薦玩家與顏色。',
        en: 'Touch-based turn-order draws, with player and color suggestions.' },
      { kind: 'new', zh: '線上計分板庫支援批次匯入，遊戲中可升級完整計分板。',
        en: 'Online scoreboards support batch import and upgrades during play.' },
      { kind: 'new', zh: 'AI 簡易產生器提供結果預覽與等待狀態。',
        en: 'Simple AI generation with result previews and wait status.' },
      { kind: 'new', zh: '計分表滑到底開啟工具箱。', en: 'Scroll below the grid to open the toolbox.' },
      { kind: 'improved', zh: '雲端還原支援釘選與介面設定。', en: 'Cloud restores pins and UI settings.' },
      { kind: 'fixed', zh: '修正 iPhone 全螢幕安全區域。', en: 'Fixed iPhone fullscreen safe areas.' },
    ],
  },
  // main: bac3b5a..2269814. The scanner commit followed the May 12 merge.
  {
    date: '2026-05-18',
    items: [
      { kind: 'new', zh: 'AI 依規則書照片產生計分板。',
        en: 'AI generates scoreboards from rulebook photos.' },
      { kind: 'fixed', zh: '修正合作模式皇冠與歷史總分列重疊。',
        en: 'Fixed cooperative crowns overlapping history totals.' },
    ],
  },
  // main: e6b1d5b..bac3b5a (two merges on 2026-05-12).
  {
    date: '2026-05-12',
    items: [
      { kind: 'new', zh: '進階搜尋支援人數與情境篩選、模糊比對及排序。',
        en: 'Advanced search adds player-count and scenario filters, fuzzy matching and ranking.' },
      { kind: 'improved', zh: '標示 BGG 資料來源。', en: 'BGG data attribution.' },
      { kind: 'fixed', zh: 'BGG 匯入保留西元前年份。', en: 'BGG imports preserve BC years.' },
    ],
  },
  // main: 506dd97..e6b1d5b.
  {
    date: '2026-05-04',
    items: [
      { kind: 'new', zh: '新增 iOS 安裝教學。', en: 'Added an iOS install guide.' },
      { kind: 'improved', zh: '人數鎖定與遊戲搜尋整合。', en: 'Player-count locks filter game search.' },
    ],
  },
  // main: 8a2deb2..506dd97.
  {
    date: '2026-05-03',
    items: [
      { kind: 'new', zh: '內建瀏覽器開啟時，提示改用一般瀏覽器。',
        en: 'In-app browsers prompt users to open a standard browser.' },
    ],
  },
  // main: a8590c4..8a2deb2.
  {
    date: '2026-04-30',
    items: [
      { kind: 'improved', zh: '搜尋提示可從 BG Stats 或 BGG 匯入遊戲。',
        en: 'Search suggests importing games from BG Stats or BGG.' },
      { kind: 'fixed', zh: '歷史回顧備忘錄可保存與顯示。', en: 'History memos save and display correctly.' },
    ],
  },
  // main: 97a9349..a8590c4.
  {
    date: '2026-04-28',
    items: [
      { kind: 'improved', zh: '玩家編輯整合顏色與名稱，精簡手機鍵盤版面。',
        en: 'Combined player name/color editing and compact mobile keypads.' },
    ],
  },
  // main: 2b47296..7e6c415. Later color fixes do not make light mode a new April 30 feature.
  {
    date: '2026-04-24',
    items: [
      { kind: 'new', zh: '支援淺色模式。', en: 'Light mode support.' },
    ],
  },
  // main: 18a0dbc..9a0983d (three merges on 2026-04-11).
  {
    date: '2026-04-11',
    items: [
      { kind: 'fixed', zh: '修正 iOS 鍵盤偵測。', en: 'Fixed iOS keyboard detection.' },
    ],
  },
  // main: 67cf393..18a0dbc.
  {
    date: '2026-04-02',
    items: [
      { kind: 'new', zh: '計分項目支援多選，舊資料自動轉換。',
        en: 'Multi-select score items with automatic data migration.' },
      { kind: 'improved', zh: '輸入面板加入滑動提示。', en: 'The input panel shows a swipe hint.' },
    ],
  },
  // main: ffbbf87..67cf393.
  {
    date: '2026-03-29',
    items: [
      { kind: 'new', zh: '新增跨玩家加總。', en: 'Cross-player sums.' },
      { kind: 'improved', zh: '統一視窗返回鍵操作。', en: 'Unified dialog back-button handling.' },
      { kind: 'fixed', zh: '修正歷史紀錄當機及項目設定未保存。',
        en: 'Fixed a history crash and unsaved item settings.' },
    ],
  },
  // main: b0f01ee..b866264.
  {
    date: '2026-03-15',
    items: [
      { kind: 'improved', zh: '截圖支援英文長字斷字。', en: 'English hyphenation in screenshots.' },
      { kind: 'fixed', zh: '修正計分規則與勝者判定。', en: 'Fixed scoring rules and winner selection.' },
    ],
  },
  // main: 37d20cc..a62dfb9.
  {
    date: '2026-03-12',
    items: [
      { kind: 'fixed', zh: '修正雲端同步略過項目與計分板刪除問題。',
        en: 'Fixed skipped sync items and cloud scoreboard deletion.' },
    ],
  },
  // main: cd13d18..a91431a (two merges on 2026-03-08).
  {
    date: '2026-03-08',
    items: [
      { kind: 'fixed', zh: '保留開局選擇，修正簡易計分板釘選。',
        en: 'Preserved setup selections and fixed simple-board pinning.' },
    ],
  },
  // main: 037244c..cd13d18.
  {
    date: '2026-03-04',
    items: [
      { kind: 'new', zh: '計分板可透過連結分享匯入，並顯示下載次數。',
        en: 'Share and import scoreboards by link, with download counts.' },
      { kind: 'new', zh: '支援共用變數與合併儲存格。', en: 'Shared variables and merged cells.' },
      { kind: 'improved', zh: '調整單位、倍數與快速按鈕文字空間。',
        en: 'Refined units, multipliers and quick-button text space.' },
      { kind: 'improved', zh: '英文長字自動斷字。', en: 'English words hyphenate automatically.' },
    ],
  },
  // main: f533726..037244c.
  {
    date: '2026-02-28',
    items: [
      { kind: 'new', zh: '支援中英雙語。', en: 'Chinese and English UI.' },
      { kind: 'fixed', zh: '修正搜尋別名與更新後畫面未刷新。',
        en: 'Fixed search aliases and stale screens after updates.' },
    ],
  },
  // main: 9af4cb1..f533726; these fixes followed the V3.5 announcement on February 21.
  {
    date: '2026-02-22',
    items: [
      { kind: 'improved', zh: '點選清單選項後不再自動跳項。', en: 'List selections no longer auto-advance.' },
      { kind: 'fixed', zh: '修正橫向照片上下顛倒。', en: 'Fixed upside-down landscape photos.' },
    ],
  },
  // main: bfa3c46..9af4cb1; date/version confirmed by the original introduction document.
  {
    date: '2026-02-21',
    version: 'V3.5',
    items: [
      { kind: 'new', zh: '匯入 BG Stats 紀錄，也可匯出 BG Stats 格式。',
        en: 'Import BG Stats records; export in BG Stats format.' },
      { kind: 'new', zh: '匯入 BGG／GeekGroup 收藏供搜尋。',
        en: 'Search games from imported BGG or GeekGroup collections.' },
      { kind: 'new', zh: '自動推薦地點、人數、玩家與顏色。',
        en: 'Automatic location, count, player and color suggestions.' },
      { kind: 'new', zh: '工具箱收納遊戲工具，可從計分板下方開啟。',
        en: 'Game tools in a toolbox below the scoreboard.' },
      { kind: 'new', zh: '目錄右下角可快速搜尋並開始計分。',
        en: 'Quick search at the library’s bottom right starts scoring.' },
      { kind: 'new', zh: '分享照片可隱藏玩家名稱。', en: 'Shared photos can hide player names.' },
    ],
  },
  // main: 5aa9d13..bfa3c46. V3 features are also described in the original introduction.
  {
    date: '2026-01-27',
    version: 'V3',
    items: [
      { kind: 'new', zh: '以實體計分紙照片當背景，劃分計分格。',
        en: 'Use a paper score-sheet photo as a background and mark its cells.' },
      { kind: 'new', zh: '公式支援排名與乘積累加，也可直接輸入總分。',
        en: 'Rank formulas, summed products and direct total entry.' },
      { kind: 'new', zh: '保存遊戲紀錄與地點。', en: 'Save game records with locations.' },
      { kind: 'new', zh: 'Google Drive 備份與還原。', en: 'Google Drive backup and restore.' },
      { kind: 'fixed', zh: '修正重複的新遊戲提示與清單標籤。',
        en: 'Fixed repeated new-game notices and list labels.' },
    ],
  },
  // main: dff89b8..5aa9d13. Storage fixes followed the initial V2 release.
  {
    date: '2025-12-27',
    items: [
      { kind: 'fixed', zh: '修正計分板存檔。', en: 'Fixed scoreboard saving.' },
    ],
  },
  // main: d0331e4..4db6bf1; the original introduction confirms V2 and 23 built-in boards.
  {
    date: '2025-12-21',
    version: 'V2',
    items: [
      { kind: 'new', zh: '分項累加可記多筆輸入，並撤回最後一筆。',
        en: 'Running totals keep multiple entries and undo the last.' },
      { kind: 'new', zh: '線性查表：可設定「超過幾個後，每多幾個加幾分」。',
        en: 'Linear lookups such as "after 3, every 2 more adds 5 points".' },
      { kind: 'new', zh: '快速按鈕可自訂標籤、數值、顏色及排列，並支援累加修正值。',
        en: 'Custom button labels, values, colors and layouts, plus additive modifiers.' },
      { kind: 'new', zh: '簡潔截圖隱藏單位與累加細項。', en: 'Simple captures hide units and entry details.' },
      { kind: 'improved', zh: '內建計分板增加到 23 款。', en: 'Built-in scoreboards increased to 23.' },
      { kind: 'fixed', zh: '修正 iOS 截圖下載與玩家改名。',
        en: 'Fixed iOS captures/downloads and player renaming.' },
    ],
  },
  {
    date: '2025-12-07',
    version: 'V1',
    items: [
      { kind: 'new', zh: '首次推出可安裝的桌遊計分板。',
        en: 'First release: an installable board game score pad.' },
      { kind: 'new', zh: '自訂數量、排名與勾選計分，支援倍率、查表與總分加總。',
        en: 'Custom count, rank or checkbox scoring, with multipliers, lookups and totals.' },
      { kind: 'new', zh: '內建桌遊計分板，並可分享自製計分板。',
        en: 'Built-in scoreboards and shareable custom boards.' },
      { kind: 'new', zh: '記住玩家名稱，下次開局一點即加入；截圖保存結果。',
        en: 'Player names are remembered for quick setup; save results as screenshots.' },
    ],
  },
];
