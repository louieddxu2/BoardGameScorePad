import Hypher from 'hypher';
import enUsPattern from 'hyphenation.en-us';

/**
 * 為長英文單字注入軟連字號 (\u00AD)，確保在所有瀏覽器都能出現「連字號」換行效果。
 * 使用 Knuth-Liang 演算法（hypher 套件）查表斷字，取代自製正則。
 * 這是為了解決 Windows Chrome/Edge 缺乏內建 hyphenation dictionary 的問題。
 */

const hyphenator = new Hypher(enUsPattern);

export function injectSoftHyphens(text: string): string {
    if (!text || typeof text !== 'string') return text;

    const shy = '\u00AD';

    // 匹配 5 個字母以上的純英文單字進行處理
    return text.replace(/([a-zA-Z]{5,})/g, (word) => {
        const syllables = hyphenator.hyphenate(word);
        if (syllables.length <= 1) return word;
        return syllables.join(shy);
    });
}
