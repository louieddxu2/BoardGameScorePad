---
description: 雙向需求同步與自動分類日誌管理
---

### 步驟 1：拉取最新變動
// turbo
1. 執行 `git pull` 獲取手機端輸入。

### 步驟 2：解析並標記
2. 讀取 `docs/mobile-demand-list.md`。
3. 將「待處理需求」區域的 `[ ]` 項目移動至「實作中」區域。

### 步驟 3：執行任務
4. 根據需求進行開發，過程中參考該需求描述撰寫 commit 訊息。

### 步驟 4：自動分類歸檔 (任務完成後)
5. 將該項目從「實作中」搬移至「已完成紀錄」下的對應分類。
6. 自動判斷類別 (UI/Logic/Bugfix/Others)。
7. 在該項目後方附註處理摘要或 Commit ID。

### 步驟 5：推送至雲端
// turbo
8. 執行 `git add .`、`git commit -m "docs(sync): update mobile demand list and archive progress"`、`git push`。
9. 確認手機端 GitHub 已同步顯示分類成果。
