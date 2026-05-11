/**
 * BGG Data Sync & Merging Tool (The Master Union Edition)
 * 用於將 BGG 基礎收藏資料與 BGG1tool 深度屬性進行「全面大一統」對齊合併的終極工具。
 */

const XLSX = require('xlsx');
const OpenCC = require('opencc-js');
const path = require('path');
const fs = require('fs');

// 1. 初始化繁簡轉換器 (用於精確偵測簡體字)
const convertToTw = OpenCC.Converter({ from: 'cn', to: 'tw' });

// 定義輸入輸出路徑
const DOC_DIR = path.join(__dirname, '../docs');
const BGG_COLL_FILE = path.join(DOC_DIR, 'BggCollection.xlsx');
const BGG_TOOL_FILE = path.join(DOC_DIR, 'Bgg1tool_result.xlsx');
const OUTPUT_CSV = path.join(DOC_DIR, 'Final_BggCollection.csv');

console.log("🚀 開始執行 BGG 資料「大一統」終極整合巨集...");

if (!fs.existsSync(BGG_COLL_FILE) || !fs.existsSync(BGG_TOOL_FILE)) {
    console.error("❌ 錯誤：找不到輸入的 Excel 檔案，請確保 BggCollection.xlsx 與 Bgg1tool_result.xlsx 存在於 docs 資料夾中。");
    process.exit(1);
}

try {
    // -----------------------------------------------------------------
    // Step 1: 讀取個人收藏檔，並建立 Map 儲存個人資料
    // -----------------------------------------------------------------
    console.log("📊 正在載入使用者個人收藏庫 (BggCollection)...");
    const collWb = XLSX.readFile(BGG_COLL_FILE);
    const collSheet = collWb.Sheets[collWb.SheetNames[0]];
    const collRawData = XLSX.utils.sheet_to_json(collSheet);
    
    const collMap = new Map();
    collRawData.forEach(row => {
        const rawId = row['Game ID'] || row['BGG ID'] || row['id'];
        if (rawId) {
            const cleanId = String(Math.floor(parseFloat(rawId)));
            collMap.set(cleanId, row);
        }
    });
    console.log(`✅ 載入 ${collMap.size} 筆個人收藏記錄。`);

    // -----------------------------------------------------------------
    // Step 2: 讀取 Bgg1tool 主資料庫
    // -----------------------------------------------------------------
    console.log("📊 正在載入 Bgg1tool 深度屬性庫...");
    const toolWb = XLSX.readFile(BGG_TOOL_FILE);
    const toolSheet = toolWb.Sheets[toolWb.SheetNames[0]];
    const toolRawData = XLSX.utils.sheet_to_json(toolSheet);
    console.log(`✅ 載入 ${toolRawData.length} 筆深度元數據。`);

    const finalData = [];
    const processedIds = new Set(); // 紀錄已經處理過的 ID
    let enrichedCount = 0;

    // -----------------------------------------------------------------
    // Helper: 智慧別名解析引擎 (The Ultimate Parser)
    // -----------------------------------------------------------------
    function extractAltNames(rawStr) {
        if (!rawStr) return [];
        const words = rawStr.split(/\s+/).map(s => s.trim()).filter(Boolean);
        const candidates = [];
        
        words.forEach(w => {
            const hasForeign = /[\u3040-\u30ff\uac00-\ud7af\u0400-\u04ff]/.test(w);
            if (hasForeign) {
                candidates.push({ type: 'FOREIGN', val: w });
                return;
            }
            
            const hasChinese = /[\u4e00-\u9fa5]/.test(w);
            if (hasChinese) {
                const converted = convertToTw(w);
                if (w !== converted) {
                    candidates.push({ type: 'SIMP', val: w });
                } else {
                    candidates.push({ type: 'TRAD', val: w });
                }
            } else if (/^[\u0000-\u007F\uFF00-\uFFEF]+$/.test(w)) {
                candidates.push({ type: 'ASCII', val: w });
            } else {
                candidates.push({ type: 'UNKNOWN', val: w });
            }
        });

        const groups = [];
        let currentGroup = [];
        
        const pushGroup = () => {
            const containsTrad = currentGroup.some(x => x.type === 'TRAD');
            if (containsTrad) {
                // 邊緣修剪律：修剪掉群組頭尾的純英文
                let s = 0;
                while (s < currentGroup.length && currentGroup[s].type === 'ASCII') s++;
                let e = currentGroup.length - 1;
                while (e >= s && currentGroup[e].type === 'ASCII') e--;
                
                if (s <= e) {
                    const str = currentGroup.slice(s, e + 1).map(x => x.val).join(' ');
                    if (str) groups.push(str);
                }
            }
            currentGroup = [];
        };

        candidates.forEach(c => {
            if (c.type === 'FOREIGN' || c.type === 'SIMP' || c.type === 'UNKNOWN') {
                pushGroup();
                return;
            }
            if (currentGroup.length > 0 && c.type === 'TRAD') {
                const prev = currentGroup[currentGroup.length - 1];
                if (prev.type === 'TRAD') {
                    const endsInGlue = /[:：\-－]$/.test(prev.val);
                    if (!endsInGlue) {
                        pushGroup(); // 中斷！視為下一個別名
                    }
                }
            }
            currentGroup.push(c);
        });
        pushGroup();

        return groups.map(g => {
            return g.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').replace(/（.*?）/g, '')
                    .replace(/(Chinese edition|edition|版)$/gi, '')
                    .replace(/[()\[\]]/g, '').replace(/\s+/g, ' ').trim();
        }).filter(Boolean);
    }

    // -----------------------------------------------------------------
    // Step 3: 遍歷 Bgg1tool，建立「大一統資料集」 (Union Merge)
    // -----------------------------------------------------------------
    console.log("⚙️ 正在執行融合引擎...");
    
    toolRawData.forEach(toolRow => {
        const rawId = toolRow['id'] || toolRow['Game ID'];
        if (!rawId) return;
        
        const cleanId = String(Math.floor(parseFloat(rawId)));
        processedIds.add(cleanId);

        // 找尋對應的個人收藏行
        const personalRow = collMap.get(cleanId) || {};
        const isFoundInCollection = !!collMap.get(cleanId);

        if (isFoundInCollection) enrichedCount++;

        // [1] 智能人數解析 logic
        const recPlayers = [];
        const bestPlayers = [];
        for (let i = 1; i <= 20; i++) {
            const key = `${i}player`;
            const val = String(toolRow[key] || '').toUpperCase();
            if (val === 'B' || val === 'R') recPlayers.push(i);
            if (val === 'B') bestPlayers.push(i);
        }
        const recStr = recPlayers.sort((a,b)=>a-b).join(', ');
        const bestStr = bestPlayers.sort((a,b)=>a-b).join(', ');

        // [2] 別名合併與清洗
        const existingAltsStr = personalRow['altnames'] || '';
        const existingAlts = existingAltsStr.split(/[|,;]/).map(s => s.trim()).filter(Boolean);
        
        const autoAliases = extractAltNames(toolRow['name_others'] || '');
        
        const primaryNameLower = String(toolRow['name'] || '').toLowerCase().trim();
        const seenLower = new Set([primaryNameLower]);
        const uniqueFinalAlts = [];
        
        // 優先放個人原有別名
        existingAlts.forEach(a => {
            const l = a.toLowerCase().trim();
            if (!seenLower.has(l)) { seenLower.add(l); uniqueFinalAlts.push(a.trim()); }
        });
        // 補入自動解析別名
        autoAliases.forEach(a => {
            const l = a.toLowerCase().trim();
            if (!seenLower.has(l)) { seenLower.add(l); uniqueFinalAlts.push(a.trim()); }
        });

        // [3] 構建最終物件 (融合兩造屬性)
        const rowOut = {
            // -- 個人欄位 (如有則保留，無則代入預設值) --
            'Collection ID': personalRow['Collection ID'] || '-',
            'Game ID': cleanId,
            'Name': toolRow['name'] || personalRow['Name'] || '',
            'Expansion': personalRow['Expansion'] || (toolRow['exp'] === 'Y' ? 'Yes' : '-'),
            'Version ID': personalRow['Version ID'] || '-',
            'Version': personalRow['Version'] || '-',
            'Status': personalRow['Status'] || '-',
            'Plays': personalRow['Plays'] !== undefined ? personalRow['Plays'] : 0,
            'Last Play': personalRow['Last Play'] || '-',
            'Rating': personalRow['Rating'] || '-',
            
            // -- 全域指標 (全面以 Bgg1tool 的精確值覆寫) --
            'Min Players': toolRow['minplayers'] || personalRow['Min Players'] || '-',
            'Max Players': toolRow['maxplayers'] || personalRow['Max Players'] || '-',
            'Recommended Players': recStr,  // 智能計算結果
            'Best Players': bestStr,         // 智能計算結果
            'Min Duration': toolRow['minplaytime'] || personalRow['Min Duration'] || '-',
            'Max Duration': toolRow['maxplaytime'] || personalRow['Max Duration'] || '-',
            'Weight': toolRow['averageweight'] || personalRow['Weight'] || '-',
            'BGG Rating': toolRow['bayesaverage'] || personalRow['BGG Rating'] || '-',
            'Rank': toolRow['rank'] || personalRow['Rank'] || '-',
            'Estimated Value': toolRow['price'] || personalRow['Estimated Value'] || '-',
            
            // -- 深度資訊擴充 --
            'altnames': uniqueFinalAlts.join('|'),
            'Mechanisms': toolRow['mechanic'] || '',
            'Categories': toolRow['category'] || '',
            'Designer': toolRow['designer'] || '',
            'YearPublished': toolRow['yearpublished'] || '',
            
            // [新增潛力欄位供未來App讀取]
            'Publisher': toolRow['publisher'] || '',
            'Artist': toolRow['artist'] || '',
            'Domain': toolRow['domain'] || '',
            'Family': toolRow['family'] || '',
            'SuggestedAge': toolRow['age_poll'] || '',
            'BggImage': toolRow['image'] || ''
        };

        finalData.push(rowOut);
    });

    // -----------------------------------------------------------------
    // Step 4: 捕捉孤兒項目 (存在於 Collection 但不在 Bgg1tool 中的項目)
    // -----------------------------------------------------------------
    let orphans = 0;
    collRawData.forEach(personalRow => {
        const rawId = personalRow['Game ID'];
        if (!rawId) return;
        const cleanId = String(Math.floor(parseFloat(rawId)));
        
        // 如果還沒被處理過，就直接把整行塞入，避免遺漏任何使用者的收藏
        if (!processedIds.has(cleanId)) {
            finalData.push({
                ...personalRow,
                // 補齊空的新增屬性以防資料結構偏移
                'Publisher': '', 'Artist': '', 'Domain': '', 'Family': '', 'SuggestedAge': '', 'BggImage': '',
                'Mechanisms': personalRow['Mechanisms'] || '',
                'Categories': personalRow['Categories'] || '',
                'Designer': personalRow['Designer'] || '',
                'YearPublished': personalRow['YearPublished'] || ''
            });
            orphans++;
        }
    });

    // -----------------------------------------------------------------
    // Step 5: 排序與輸出
    // -----------------------------------------------------------------
    console.log("💾 正在生成終極版 CSV 檔案...");
    
    // 按照遊戲名稱字母排序
    finalData.sort((a, b) => String(a.Name).localeCompare(String(b.Name)));

    const wsOutput = XLSX.utils.json_to_sheet(finalData);
    const csvOutput = XLSX.utils.sheet_to_csv(wsOutput, { FS: ',', RS: '\n' });
    
    try {
        fs.writeFileSync(OUTPUT_CSV, '\ufeff' + csvOutput, 'utf-8');
    } catch (e) {
        if (e.code === 'EBUSY') {
             console.error("\n❌ 寫入失敗：檔案已被佔用！請先「關閉」正開啟 docs/Final_BggCollection.csv 的 Excel 或其他程式，然後再試一次。");
             process.exit(1);
        }
        throw e;
    }

    console.log("\n✨ ==========================================");
    console.log(`🎉 「大一統資料庫」建立完成！`);
    console.log(`📦 總遊戲收錄量: ${finalData.length} 筆 (全面擴充至 100%)`);
    console.log(`🔋 屬性完美融合: ${enrichedCount} 筆既有收藏已升級極致數值`);
    console.log(`🛡️ 保全孤兒紀錄: ${orphans} 筆僅存於收藏的遊戲已安全轉移`);
    console.log(`📂 輸出檔案: docs/Final_BggCollection.csv`);
    console.log("==============================================\n");

} catch (err) {
    console.error("❌ 執行過程中發生非預期錯誤:");
    console.error(err);
    process.exit(1);
}
