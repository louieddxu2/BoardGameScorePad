# BoardGameScorePad — UI 視覺設計規範

本文件定義了專案在深色模式 (Dark Mode) 與淺色模式 (Light Mode) 下的視覺規格。所有新開發的組件或樣式調整皆應遵循此規範，以確保全站一致的「Clean Studio」專業質感。

---

## 1. 全局色彩與層次 (Global Palette)

| 類別 | 元素 | 深色模式 (Dark Mode) 現況 | 淺色模式 (Light Mode) 目標 |
| :--- | :--- | :--- | :--- |
| **背景** | Body BG | `#0F172A` (Slate 900) | `#F8F9FA` (淺灰) |
| **卡片** | 背景色 | `#0F172A` (Slate 900) | `#FFFFFF` (純白) |
| | 邊框色 | `#1E293B` (Slate 800) | `#E5E7EB` (極淡灰) |
| | 陰影 | `shadow-lg` | `var(--shadow-soft)` (微凸柔和) |
| **文字** | 主要文字 | `#F8FAFC` (Slate 50) | `#111827` (極深灰) |
| | 次要文字 | `#94A3B8` (Slate 400) | `#4B5563` (標準灰) |
| | 輔助文字 | `#64748B` (Slate 500) | `#6B7280` (中灰色) |

---

## 2. 彈窗規範 (Modal Specification)

彈窗應具備明確的懸浮感，並在淺色模式下消除原本深色底色的壓迫感。

| 元素 | 深色模式 (Dark Mode) | 淺色模式 (Light Mode) |
| :--- | :--- | :--- |
| **遮罩 (Backdrop)** | `bg-slate-950/90` + `blur` | `bg-slate-900/40` + `blur` |
| **容器背景** | `#0F172A` (Slate 900) | `#FFFFFF` (純白) |
| **容器邊框** | `#1E293B` (Slate 800) | `#E5E7EB` (極淡灰) |
| **容器陰影** | `shadow-2xl` | `var(--shadow-floating)` (深度懸浮) |
| **標題 (Title)** | `#FFFFFF` (純白) | `#111827` (極深灰) |
| **內容 (Body)** | `#94A3B8` (Slate 400) | `#4B5563` (標準灰) |
| **分割線 (Divider)**| `#1E293B` (Slate 800) | `#F3F4F6` (極淡灰) |
| **輸入框底色** | `bg-transparent` | `#F3F4F6` (增強對比) |

---

## 3. 按鈕與交互 (Buttons & Actions)

| 按鈕類型 | 狀態 | 深色模式 (Dark Mode) | 淺色模式 (Light Mode) |
| :--- | :--- | :--- | :--- |
| **主要綠色** | 正常 | `#10B981` (Emerald 500) | `#059669` (Emerald 600) |
| | 懸停 (Hover) | `#059669` (Emerald 600) | `#047857` (Emerald 700) |
| **次要按鈕** | 正常 | `#334155` (Slate 700) | `#F3F4F6` (Gray 100) |
| | 文字色 | `#FFFFFF` | `#374151` (Gray 700) |
| **危險操作** | 正常 | `#DC2626` (Red 600) | `#DC2626` (Red 600) |

---

## 4. 實作備註 (Implementation Notes)

- **語義化變數**：在 `index.css` 中定義對應變數（如 `--c-modal-bg`），組件內部應盡量避免使用硬編碼的 Tailwind 色值。
- **維持結構**：本規範的實作應專注於色彩與陰影，不應更動 DOM 結構或排版邏輯。
