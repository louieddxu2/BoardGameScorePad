import { useTranslation } from './index';

export const templateEditorTranslations = {
    'zh-TW': {
        tmpl_new_title: "建立新計分板",
        tmpl_edit_title: "編輯模板",
        tmpl_name_label: "計分板名稱",
        tmpl_name_ph: "例如：卡坦島、璀璨寶石...",
        tmpl_default_name: "自訂計分板",
        tmpl_col_count_label: "計分項目數量",
        tmpl_no_total: "(不含總分)",
        tmpl_col_unit: "列",
        tmpl_col_default_name: "項目 {n}",
        tmpl_simple_mode: "簡易模式：僅顯示玩家與總分，適合單純記錄勝負。",
        tmpl_desc_simple: "簡易計數器",
        tmpl_desc_columns: "{count} 個計分項目",
        tmpl_btn_img: "建立圖片計分板",
        tmpl_btn_std: "建立一般計分板",
        tmpl_hint: "提示：建立後，您仍可以在計分表中點擊標題來修改所有細節。",
        tmpl_save_warn: "請輸入計分板名稱",
        tmpl_scan_warn: "請先輸入計分板名稱",
        tmpl_img_save_fail: "圖片儲存失敗，請重試",
        toast_fetch_template_failed: "警告：無法讀取完整模板資料",

        // Texture Mapper
        mapper_step_1: "步驟 1/2 : 調整網格",
        mapper_step_2: "步驟 2/2 : 定義結構",
        mapper_grid_desc: "拖曳四邊邊界裁切，再對齊內部線條。",
        mapper_structure_desc: "從左側拖曳項目至右方橫列。",
        mapper_structure_desc_no_template: "預覽項目分割，或點擊「匯入設定」套用規則。",
        mapper_interaction_hint: "單指平移 • 雙指縮放 • 拖曳線條",
        mapper_btn_reset_view: "重置視角",
        mapper_btn_add_line: "新增橫列 ({n} 欄)",
        mapper_btn_next: "下一步",
        mapper_btn_back_grid: "返回網格",
        mapper_btn_cancel_import: "取消匯入",
        mapper_btn_import: "匯入設定",
        mapper_btn_finish: "完成",
        mapper_toast_success_title: "模板建立成功",
        mapper_toast_success_msg: "已套用計分紙紋理！",
        mapper_search_placeholder: "搜尋現有模板...",
        mapper_col_unit_alt: "{count} 個項目",
        mapper_source_label: "來源: {name}",
        mapper_player_name: "玩家名稱",
        mapper_total_score: "總分合計",
        mapper_empty_row: "空",
        mapper_clear_row: "清空此列",
        mapper_grid_top: "頂部邊界",
        mapper_grid_bottom: "底部邊界",
        mapper_grid_left: "左邊界",
        mapper_grid_right: "右邊界",
        mapper_grid_line_n: "第 {i} 條線",
        mapper_grid_v_item: "項目右邊界",
        mapper_grid_v_player: "首位玩家欄右邊界",
        mapper_slot_name: "(空格 {n})",
        mapper_item_name: "項目 {n}",
    },
    'en': {
        tmpl_new_title: "New Score Sheet",
        tmpl_edit_title: "Edit Template",
        tmpl_name_label: "Board Name",
        tmpl_name_ph: "e.g. Catan, Splendor...",
        tmpl_default_name: "Custom Board",
        tmpl_col_count_label: "Item Count",
        tmpl_no_total: "(Excl. Total)",
        tmpl_col_unit: "col",
        tmpl_col_default_name: "Item {n}",
        tmpl_simple_mode: "Simple Mode: Only show Players and Total Score.",
        tmpl_desc_simple: "Simple Counter",
        tmpl_desc_columns: "{count} scoring items",
        tmpl_btn_img: "Create from Image",
        tmpl_btn_std: "Create Standard",
        tmpl_hint: "Tip: You can edit details later by clicking headers in the sheet.",
        tmpl_save_warn: "Please enter a name",
        tmpl_scan_warn: "Please enter a name first",
        tmpl_img_save_fail: "Failed to save image, please try again",
        toast_fetch_template_failed: "Warning: Unable to load full template data",

        // Texture Mapper
        mapper_step_1: "Step 1/2: Adjust Grid",
        mapper_step_2: "Step 2/2: Define Structure",
        mapper_grid_desc: "Drag boundaries to crop, then align internal lines.",
        mapper_structure_desc: "Drag items from left to the corresponding rows on right.",
        mapper_structure_desc_no_template: "Preview row splits, or click 'Import' to apply rules.",
        mapper_interaction_hint: "1 Finger: Pan • 2 Fingers: Zoom • Drag Lines",
        mapper_btn_reset_view: "Reset View",
        mapper_btn_add_line: "Add Row ({n} col)",
        mapper_btn_next: "Next",
        mapper_btn_back_grid: "Grid View",
        mapper_btn_cancel_import: "Cancel Import",
        mapper_btn_import: "Import",
        mapper_btn_finish: "Finish",
        mapper_toast_success_title: "Template Created",
        mapper_toast_success_msg: "Score sheet texture applied!",
        mapper_search_placeholder: "Search templates...",
        mapper_col_unit_alt: "{count} items",
        mapper_source_label: "Source: {name}",
        mapper_player_name: "Player",
        mapper_total_score: "Total",
        mapper_empty_row: "Empty",
        mapper_clear_row: "Clear Row",
        mapper_grid_top: "Top Boundary",
        mapper_grid_bottom: "Bottom Boundary",
        mapper_grid_left: "Left Boundary",
        mapper_grid_right: "Right Boundary",
        mapper_grid_line_n: "Line {i}",
        mapper_grid_v_item: "Item Right Boundary",
        mapper_grid_v_player: "1st Player Column Right Boundary",
        mapper_slot_name: "(Slot {n})",
        mapper_item_name: "Item {n}",
    }
};

export type TemplateEditorTranslationKey = keyof typeof templateEditorTranslations['zh-TW'];

export const useTemplateEditorTranslation = () => {
    const { language } = useTranslation();
    const t = (key: TemplateEditorTranslationKey, params?: Record<string, string | number>) => {
        const dict = templateEditorTranslations[language] || templateEditorTranslations['zh-TW'];
        let text = dict[key] || key;
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text.replace(`{${k}}`, String(v));
            });
        }
        return text;
    };
    return { t, language };
};
