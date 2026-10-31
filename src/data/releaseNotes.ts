// User-facing release notes shown in Settings → About.
// One entry per main release; the first entry collects V3test publishes until the next merge to main.
// Before each V3test publish, update the first entry from the commits since the previous publish
// (scripts/publish-v3test.ps1 refuses to publish user-facing commits without a change here).

export type ReleaseNoteKind = 'new' | 'improved' | 'fixed';

export interface ReleaseNoteItem {
  kind: ReleaseNoteKind;
  zh: string;
  en: string;
}

export interface ReleaseNote {
  /** Date of the main release, or of the latest V3test publish for the in-progress entry. */
  date: string;
  /** Version name used in earlier announcements, when there was one. */
  version?: string;
  items: ReleaseNoteItem[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    date: '2026-10-31',
    items: [
      { kind: 'new', zh: '設定頁可將全部資料（含照片）匯出成 ZIP 備份，並從備份還原。',
        en: 'Settings can export a full offline ZIP backup (custom scoreboards, game records, active games, photos and settings) and restore from it.' },
      { kind: 'new', zh: '設定頁集中色系、介面大小、語言、雲端備份與資料匯入。',
        en: 'Settings now gathers appearance, interface size, language, cloud backup, game data import and BG Stats in one place.' },
      { kind: 'new', zh: '設定頁新增「關於」，可查看歷次更新內容。',
        en: 'Settings now has an About section with the update history.' },
      { kind: 'improved', zh: '設定頁改為精簡分組：色系與語言直接點選，匯出與還原並排並顯示上次匯出日期，「關於」顯示目前版本。',
        en: 'Settings is now compact and grouped: tap a theme or language directly, export and restore sit side by side with the last export date, and About shows the installed version.' },
      { kind: 'improved', zh: '從備份還原前，先顯示備份時間與最近幾筆紀錄，並和此裝置最近的紀錄對照；此裝置的紀錄較新時會特別提醒。',
        en: 'Before restoring, a preview shows when the backup was made and its latest game records next to this device\'s latest record, with a warning when the device has newer records.' },
      { kind: 'improved', zh: '輸入分數後一律移到下一列，不再需要設定方向。',
        en: 'Score entry now always advances downward; the direction preference was removed.' },
      { kind: 'improved', zh: '匯入入口分開「BGG／GeekGroup」與「BG Stats」。',
        en: 'Import entries now separate game data (BGG / GeekGroup) from BG Stats.' },
      { kind: 'fixed', zh: '首頁上方按鈕在縮放時保持固定間距。',
        en: 'Home header buttons keep fixed spacing while zoomed.' },
    ],
  },
  {
    date: '2026-10-28',
    items: [
      { kind: 'new', zh: '新增「暖紙淺色」與「鼠尾草綠」色系，可在三種色系間切換。',
        en: 'Added Warm paper and Sage palettes, with three-way theme switching.' },
      { kind: 'improved', zh: '淺色色系下的文字、表格與玩家顏色更清楚易讀，首頁區塊層次更簡潔。',
        en: 'Text, tables and player colors read more clearly on light palettes, and home sections are simpler.' },
      { kind: 'improved', zh: '分享照片的玩家名牌依照片明暗改用深色或淺色，皇冠移到名牌右上角。',
        en: 'Player name plates on shared photos use a fixed dark or light style based on the photo, with the winner crown at the top right.' },
      { kind: 'fixed', zh: '玩家自選的文字顏色在介面與分享照片中不再被調淡或調深。',
        en: 'Player-chosen text colors are no longer lightened or darkened in the app or shared photos.' },
      { kind: 'fixed', zh: '單一遊戲的照片回顧不再顯示多餘的局數；白色總分預覽保持可讀。',
        en: 'Single-game photo recaps omit the redundant play count, and white total previews stay readable.' },
    ],
  },
  {
    date: '2026-10-19',
    items: [
      { kind: 'new', zh: '分享成績改為以照片為主：標題自動調整、依照片取色，並標示合作遊戲的結果。',
        en: 'Score sharing is now photo-first, with adaptive titles, photo-matched colors and cooperative outcomes.' },
      { kind: 'new', zh: '瀏覽照片時可滑動預覽前後張，照片旋轉會被保存。',
        en: 'Swipe to preview adjacent photos while browsing; photo rotations are saved.' },
      { kind: 'improved', zh: '建立多人房間前會先說明並確認，計分板結構的修改會自動同步給參與者。',
        en: 'Creating a multiplayer room now explains and confirms first, and board changes sync to participants automatically.' },
      { kind: 'improved', zh: '多人連線狀態統一以角落徽章顯示。',
        en: 'Multiplayer connection status uses unified corner badges.' },
      { kind: 'fixed', zh: '多人遊戲改由各裝置自行計分，並修正輸入順序、重連與離開房間問題。',
        en: 'Each device now calculates multiplayer scores itself; fixed input ordering, reconnection and room exit issues.' },
      { kind: 'fixed', zh: 'Google Drive 備份減少重複請求，並修正同時備份造成的錯誤。',
        en: 'Google Drive backup sends fewer redundant requests and no longer conflicts with itself.' },
      { kind: 'fixed', zh: '匯入 BG Stats 時補上 BGG 編號；計分表可從空白處拖曳。',
        en: 'BG Stats imports fill in BGG IDs, and the score grid can be panned from empty space.' },
    ],
  },
  {
    date: '2026-10-03',
    items: [
      { kind: 'improved', zh: '快速按鈕與文字選項依可用空間調整字級，介面縮放時間距保持穩定。',
        en: 'Quick buttons and label options size text to fit, with stable spacing while zoomed.' },
      { kind: 'improved', zh: '整理部分內建計分板的選項版面。',
        en: 'Tidied option layouts on some built-in scoreboards.' },
      { kind: 'fixed', zh: '雙指縮放不再誤觸按鈕，照片縮放與拖曳手勢互不干擾。',
        en: 'Pinch gestures no longer press buttons, and photo zoom no longer fights drag gestures.' },
      { kind: 'fixed', zh: '拖曳排序時，放下的位置與顯示的插入線一致。',
        en: 'Drag-and-drop now lands exactly at the shown insertion line.' },
    ],
  },
  {
    date: '2026-09-30',
    items: [
      { kind: 'new', zh: '首頁「快速開始」列出最近玩過的遊戲（最多五個）。',
        en: 'Quick start on the home page lists up to five recently played games.' },
      { kind: 'new', zh: '開始遊戲時會推薦地點與人數。',
        en: 'Game setup now suggests the location and player count.' },
      { kind: 'new', zh: '新增內建計分板。', en: 'Added a new built-in scoreboard.' },
      { kind: 'improved', zh: '進行中與釘選的遊戲列更精簡，整列都可點擊。',
        en: 'Active and pinned game rows are more compact and fully clickable.' },
      { kind: 'fixed', zh: '工具箱備忘錄在鍵盤開啟時保持可見。',
        en: 'The toolbox memo stays visible above the keyboard.' },
      { kind: 'fixed', zh: '快速連按返回時能正確關閉多層視窗；釘選的簡易計分板在儲存後會保留。',
        en: 'Rapid back presses close stacked dialogs correctly, and pinned simple scoreboards stay pinned after saving.' },
    ],
  },
  {
    date: '2026-09-02',
    items: [
      { kind: 'new', zh: '統計面板內可搜尋。', en: 'Search within the statistics panel.' },
      { kind: 'new', zh: '所有分數皆為 0 時只顯示勝負結果，分享照片也一樣。',
        en: 'When all scores are zero, only outcomes are shown, including on shared photos.' },
      { kind: 'new', zh: '工具箱新增本局照片列。', en: 'The toolbox now shows a strip of this game\'s photos.' },
      { kind: 'improved', zh: '玩家名稱建議按鈕加大並更容易辨識。',
        en: 'Player name suggestions are larger and easier to spot.' },
      { kind: 'fixed', zh: '修正 iPhone 與 Android 上輸入面板被瀏覽器工具列遮住或跑位。',
        en: 'Fixed the score panel being covered or misplaced by browser toolbars on iPhone Safari and Android.' },
    ],
  },
  {
    date: '2026-08-21',
    items: [
      { kind: 'improved', zh: '玩家、人數與地點推薦會參考近期的遊玩習慣與名次。',
        en: 'Player, count and location suggestions now consider recent play habits and rankings.' },
      { kind: 'improved', zh: '起始玩家抽選優先採用手動確認過的人選，並能區分同名玩家。',
        en: 'Starting player draws prefer manually confirmed candidates and tell same-name players apart.' },
      { kind: 'fixed', zh: '滑動後點擊數字鍵盤更穩定。', en: 'Keypad taps after a swipe are more reliable.' },
      { kind: 'fixed', zh: '單人競爭遊戲也會顯示勝利皇冠。', en: 'Solo competitive games now show the winner crown.' },
    ],
  },
  {
    date: '2026-08-07',
    items: [
      { kind: 'new', zh: '多人同步計分：掃 QR Code 加入房間，各自用手機輸入分數，由房主保存。',
        en: 'Multiplayer scoring: join a room by QR code, enter your own scores on your phone, and the host saves the result.' },
      { kind: 'new', zh: '歷史統計：勝率、最高分、玩家統計與遊玩紀錄，可依日期、地點、人數篩選。',
        en: 'History statistics: win rates, high scores and record holders, with date, location and player count filters, player stats and play logs.' },
      { kind: 'new', zh: '照片回顧拼貼：可裁切、替換照片並分享。',
        en: 'Photo recap collages that you can crop, rearrange and share.' },
      { kind: 'new', zh: '視覺化抽起始玩家：大家手指放上螢幕抽順位，並推薦玩家與顏色。',
        en: 'Visual starting player picker: everyone touches the screen to draw turn order, with player and color suggestions.' },
      { kind: 'new', zh: '線上計分板庫：可單筆或批次匯入；遊戲中也能直接升級為完整計分板。',
        en: 'Online scoreboard library with single or batch import; upgrade to a full scoreboard during play.' },
      { kind: 'improved', zh: 'AI 簡易產生器顯示結果清單與等待狀態，並提醒保持螢幕開啟。',
        en: 'The simple AI generator shows a result list and wait status, and reminds you to keep the screen on.' },
      { kind: 'improved', zh: '計分表滑到底可開啟工具箱；雲端備份可還原更多使用者設定。',
        en: 'Scroll past the grid bottom to open the toolbox; cloud backup restores more user settings.' },
      { kind: 'fixed', zh: '修正 iPhone 全螢幕時的安全區域。', en: 'Fixed full-screen safe areas on iPhone.' },
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
