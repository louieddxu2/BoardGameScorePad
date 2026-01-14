
/**
 * 計算基於容器尺寸 (Container Query) 的動態字體大小。
 * 使用 CSS min() 函數同時限制高度與寬度，確保內容填滿容器但不溢出。
 * 
 * 依賴環境：父容器必須設定 `container-type: size`。
 */
export const calculateDynamicFontSize = (
  input: string | number | string[] | undefined | null
): string => {
  if (input === undefined || input === null || input === '') return '1rem';

  // 1. 標準化為字串陣列 (Lines)
  let lines: string[] = [];
  if (Array.isArray(input)) {
    lines = input.map(String);
  } else {
    lines = String(input).split(/\r\n|\r|\n/);
  }

  // 2. 計算關鍵指標
  const lineCount = Math.max(1, lines.length);
  // 找出最長的一行字元數 (至少算 1 個字，避免除以 0)
  const maxCharLen = Math.max(1, ...lines.map(line => line.length));

  // 3. 定義約束公式 (使用 CSS calc)
  
  // A. 垂直約束 (Height Constraint)
  // 目標：所有行疊加起來不超過容器高度的 85% (留 15% Padding)
  // 公式：(85cqh / 行數)
  const heightConstraint = `calc(85cqh / ${lineCount})`;

  // B. 水平約束 (Width Constraint)
  // 目標：最長的一行不超過容器寬度。
  // 假設手寫字體的寬高比約為 0.5~0.6。
  // 為了安全起見，我們假設字寬是字高的 0.6 倍。
  // FontSize * 0.6 * CharLen = 100cqw
  // FontSize = 100cqw / (0.6 * CharLen) = 166cqw / CharLen
  // 這裡使用 170cqw 並在分母加 0.5 (作為 Padding 緩衝)，讓短數字不要貼太滿。
  const widthConstraint = `calc(170cqw / ${maxCharLen + 0.5})`;

  // 4. 回傳 CSS min() 函數
  // 瀏覽器會自動選取「比較小」的那個值作為字體大小
  return `min(${heightConstraint}, ${widthConstraint})`;
};
