// User-facing release notes shown in Settings → About.
// One entry per main release; prepare the first entry before merging into main.
// Routine V3test publishes do not require release-note updates.
// Follow the Release Notes rules in AGENTS.md.

export type ReleaseNoteKind = 'new' | 'improved' | 'fixed';

export interface ReleaseNoteItem {
  kind: ReleaseNoteKind;
  zh: string;
  en: string;
}

export interface ReleaseNote {
  /** Main release date (YYYY-MM-DD); omitted until the entry is ready to merge into main. */
  date?: string;
  /** Version name used in earlier announcements, when there was one. */
  version?: string;
  items: ReleaseNoteItem[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  // Pending: changes after main at 59dd1ab. Set the date before merging into main.
  {
    items: [
      { kind: 'new', zh: '新增設定頁，集中介面設定、備份與匯入。',
        en: 'Settings brings appearance, language, backup and imports together.' },
      { kind: 'new', zh: 'ZIP 備份含照片；還原會覆蓋本機資料。',
        en: 'ZIP backups include photos; restoring replaces local data.' },
      { kind: 'new', zh: '還原前預覽備份，本機紀錄較新時提醒。',
        en: 'Preview backups before restoring, with a warning about newer local records.' },
      { kind: 'new', zh: '設定頁新增更新日誌。', en: 'Update history is available in Settings.' },
      { kind: 'new', zh: '歷史紀錄新增年月日與範圍篩選，套用至清單、統計與照片回顧。',
        en: 'Filter history, statistics and photo recaps by day, month, year or range.' },
      { kind: 'new', zh: '照片回顧標示日期範圍與張數；僅一款遊戲時可選用多場照片。',
        en: 'Recaps show date ranges and photo counts, using multiple plays when a stats view contains one game.' },
      { kind: 'improved', zh: '搜尋先保留明顯較相關的結果，再優先顯示近期遊戲。',
        en: 'Search keeps clear leading matches first, then prioritizes recently played games.' },
      { kind: 'improved', zh: '下一步改為向下，移除方向設定。',
        en: 'Next advances downward; the direction setting is removed.' },
      { kind: 'fixed', zh: '儲存遊戲紀錄後，才記住結束時的人數。',
        en: 'Remember the final player count only after saving to history.' },
      { kind: 'fixed', zh: '搜尋結果缺少人數資料時，不再預設為 4 人。',
        en: 'Search no longer assumes four players when player-count data is missing.' },
      { kind: 'fixed', zh: '長圖預覽可完整捲看。', en: 'Tall previews scroll fully.' },
      { kind: 'fixed', zh: '長確認訊息可捲動，按鈕保持可見。',
        en: 'Long confirmations scroll while buttons stay visible.' },
      { kind: 'fixed', zh: '首頁按鈕縮放時間距固定。', en: 'Home button spacing stays fixed while zoomed.' },
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
      { kind: 'fixed', zh: '介面與分享照片保留玩家自選文字顏色。',
        en: 'Player text colors stay unchanged in the app and shared photos.' },
      { kind: 'fixed', zh: '單款照片回顧省略局數。', en: 'Single-game recaps omit play counts.' },
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
      { kind: 'improved', zh: '調整甜蜜國度選項版面。', en: 'Refined Sweet Lands option layouts.' },
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
      { kind: 'new', zh: '新增甜蜜國度。', en: 'Added Sweet Lands.' },
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
      { kind: 'improved', zh: '全員零分時只顯示勝負，分享照片亦同。',
        en: 'Zero-score games show outcomes only, including shared photos.' },
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
  {
    date: '2026-05-18',
    items: [
      { kind: 'new', zh: 'AI 規則書掃描：拍下規則書即可自動產生計分板。',
        en: 'AI rulebook scanner: photograph a rulebook to generate a scoreboard.' },
      { kind: 'new', zh: '進階搜尋：可依人數及派對、家庭、合作等情境篩選，並支援模糊搜尋與排序。',
        en: 'Advanced search with player count and party, family or cooperative filters, plus fuzzy matching and ranking.' },
      { kind: 'improved', zh: '加上 BGG 資料來源標示。', en: 'Added BGG data attribution.' },
      { kind: 'fixed', zh: '合作模式的皇冠與歷史總分列不再重疊；BGG 匯入可正確讀取西元前年份。',
        en: 'Fixed cooperative crowns overlapping history totals, and BGG imports read BC years correctly.' },
    ],
  },
  {
    date: '2026-05-04',
    items: [
      { kind: 'new', zh: '在 LINE、Facebook 內開啟時提示改用一般瀏覽器；新增 iOS 安裝教學。',
        en: 'In-app browsers such as LINE and Facebook now suggest opening a standard browser; added an iOS install guide.' },
      { kind: 'improved', zh: '選擇人數時可鎖定，並與遊戲搜尋整合。',
        en: 'Player count can be locked and filters game search.' },
    ],
  },
  {
    date: '2026-04-30',
    items: [
      { kind: 'new', zh: '全面支援淺色模式。', en: 'Full light mode support.' },
      { kind: 'new', zh: '搜尋時提示可從 BG Stats 或 BGG 匯入遊戲。',
        en: 'Search now hints that games can be imported from BG Stats or BGG.' },
      { kind: 'improved', zh: '玩家編輯器整合顏色與名稱，手機鍵盤版面更精簡。',
        en: 'The player editor combines colors and names, with a more compact mobile keyboard.' },
      { kind: 'fixed', zh: '歷史回顧中的備忘錄可正確保存與顯示。',
        en: 'Memos in history review are saved and shown correctly.' },
    ],
  },
  {
    date: '2026-04-12',
    items: [
      { kind: 'improved', zh: '更新內建計分板。', en: 'Updated built-in scoreboards.' },
      { kind: 'fixed', zh: '修正 iOS 鍵盤偵測，並改善照片管理。',
        en: 'Fixed iOS keyboard detection and improved photo management.' },
    ],
  },
  {
    date: '2026-04-02',
    items: [
      { kind: 'new', zh: '計分項目支援多選，舊資料會自動轉換。',
        en: 'Score items support multiple selections, with automatic migration of old data.' },
      { kind: 'improved', zh: '輸入面板加入滑動提示。', en: 'The input panel shows a swipe hint.' },
    ],
  },
  {
    date: '2026-03-29',
    items: [
      { kind: 'new', zh: '新增自動加總計分。', en: 'Added auto-sum scoring.' },
      { kind: 'improved', zh: '所有視窗都能用返回鍵關閉，不再閃爍或誤關。',
        en: 'Every dialog closes with the back button without flicker or accidental closing.' },
      { kind: 'fixed', zh: '修正歷史紀錄當機與計分項目設定未保存。',
        en: 'Fixed a history record crash and unsaved score item settings.' },
    ],
  },
  {
    date: '2026-03-16',
    items: [
      { kind: 'improved', zh: 'Google Drive 同步更穩定：一鍵同步不再略過項目，刪除計分板更可靠。',
        en: 'Google Drive sync is more reliable: one-tap sync no longer skips items and deleting scoreboards is safer.' },
      { kind: 'improved', zh: '長字會自動斷行，截圖中也一樣；相機介面更新。',
        en: 'Long words hyphenate automatically, including in screenshots; refreshed camera UI.' },
      { kind: 'fixed', zh: '修正計分規則套用，以及無分數遊戲的勝者判定。',
        en: 'Fixed scoring rule application and winners in no-score games.' },
    ],
  },
  {
    date: '2026-03-08',
    items: [
      { kind: 'new', zh: '計分板分享連結：上傳到雲端產生網址，他人點開即可匯入，並顯示下載次數。',
        en: 'Scoreboard share links: upload to the cloud, others open the link to import, with download counts.' },
      { kind: 'new', zh: '支援共用變數與合併儲存格。', en: 'Shared variables and merged cells.' },
      { kind: 'improved', zh: '計分項目的單位與倍數更清楚，快速按鈕文字空間加大。',
        en: 'Units and multipliers are clearer, and quick buttons have more room for text.' },
      { kind: 'fixed', zh: '開始遊戲面板保留原本的選擇；簡易遊戲可正確釘選。',
        en: 'The start game panel keeps your selection, and simple games pin correctly.' },
    ],
  },
  {
    date: '2026-02-28',
    items: [
      { kind: 'new', zh: '完整的中英雙語介面。', en: 'Full Chinese and English interface.' },
      { kind: 'new', zh: '拍照時可附上玩家分數，也可選擇匿名。', en: 'Photos can include player scores, optionally anonymous.' },
      { kind: 'improved', zh: '自動預測地點、人數與玩家更準確。', en: 'Location, player count and player predictions are more accurate.' },
      { kind: 'fixed', zh: '修正搜尋別名顯示，以及更新後畫面未刷新。',
        en: 'Fixed alias display in search and stale screens after updates.' },
    ],
  },
  {
    date: '2026-02-22',
    version: 'V3.5',
    items: [
      { kind: 'new', zh: '匯入 BG Stats 紀錄，也可將遊戲紀錄匯出成 BG Stats 格式。',
        en: 'Import BG Stats records and export game records in BG Stats format.' },
      { kind: 'new', zh: '匯入 BGG 或 GeekGroup 的收藏檔，搜尋遊戲更方便。',
        en: 'Import BGG or GeekGroup collection files for easier game search.' },
      { kind: 'new', zh: '自動預測地點、人數、玩家與玩家顏色。',
        en: 'Location, player count, players and player colors are predicted automatically.' },
      { kind: 'new', zh: '工具箱：收納遊戲常用的小工具，從計分板下方開啟。',
        en: 'Toolbox: handy game tools, opened from below the scoreboard.' },
      { kind: 'new', zh: '目錄右下角新增快速搜尋，直接開始計分。',
        en: 'Quick search at the bottom right of the library starts scoring directly.' },
      { kind: 'improved', zh: '點選清單選項後不再自動跳到下一項。',
        en: 'Choosing a list option no longer jumps to the next item.' },
      { kind: 'fixed', zh: '橫向拍照時照片不再上下顛倒。', en: 'Landscape photos are no longer upside down.' },
    ],
  },
  {
    date: '2026-01-27',
    version: 'V3',
    items: [
      { kind: 'new', zh: '拍下實體計分紙當背景並劃分格子，畫面與紙本一致。',
        en: 'Photograph a paper score sheet as the background and mark its cells.' },
      { kind: 'new', zh: '公式自動計算：排名分數、兩數相乘累加，也可直接點總分輸入。',
        en: 'Automatic formulas for rank scores and summed products; totals can be entered directly.' },
      { kind: 'new', zh: '保存遊戲歷史紀錄，可記錄地點。', en: 'Game history is saved, with an optional location.' },
      { kind: 'new', zh: 'Google Drive 雲端備份與跨裝置同步。', en: 'Google Drive backup and cross-device sync.' },
      { kind: 'fixed', zh: '「發現新遊戲」不再一直出現；修正清單選單的標籤顯示。',
        en: 'The new game notice no longer keeps appearing, and list menu labels display correctly.' },
    ],
  },
  {
    date: '2025-12-21',
    version: 'V2',
    items: [
      { kind: 'new', zh: '分項累加：一格可記多筆輸入並自動加總，可刪除最後一筆。',
        en: 'Running totals: one cell keeps several entries and sums them; undo the last one.' },
      { kind: 'new', zh: '線性查表：可設定「超過幾個後，每多幾個加幾分」。',
        en: 'Linear lookups such as "after 3, every 2 more adds 5 points".' },
      { kind: 'new', zh: '自訂快速按鈕（標籤、數值、顏色、排列），以及累加用的修正值按鈕。',
        en: 'Custom quick buttons (label, value, color, layout) and modifier buttons that add to a cell.' },
      { kind: 'new', zh: '簡潔截圖：隱藏右側單位與累加細項。', en: 'Clean screenshots hide units and entry details.' },
      { kind: 'improved', zh: '內建計分板增加到 23 款。', en: 'Built-in scoreboards increased to 23.' },
      { kind: 'fixed', zh: '修正 iOS 截圖與下載、手機上編輯玩家名稱，以及離線使用與存檔問題。',
        en: 'Fixed iOS screenshots and downloads, editing player names on phones, offline use and saving.' },
    ],
  },
  {
    date: '2025-12-07',
    version: 'V1',
    items: [
      { kind: 'new', zh: '首次推出：可安裝成 App、離線使用的桌遊計分板。',
        en: 'First release: an installable board game score pad that works offline.' },
      { kind: 'new', zh: '自訂計分板：數量、排名或勾選計分，支援倍率與查表，自動算出總分。',
        en: 'Custom scoreboards for counts, ranks or checkboxes, with multipliers, lookups and automatic totals.' },
      { kind: 'new', zh: '內建熱門桌遊計分板，也能分享自製計分板。',
        en: 'Built-in boards for popular games, and your own boards can be shared.' },
      { kind: 'new', zh: '記住玩家名稱，下次開局一點即加入；截圖保存結果。',
        en: 'Player names are remembered for quick setup; save results as screenshots.' },
    ],
  },
];
