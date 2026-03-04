/**
 * 為長英文單字注入軟連字號 (\u00AD)，確保在所有瀏覽器都能出現「連字號」換行效果。
 * 這是為了解決 Windows Chrome/Edge 缺乏內建 hyphenation dictionary 的問題。
 */
export function injectSoftHyphens(text: string): string {
    if (!text || typeof text !== 'string') return text;

    const shy = '\u00AD';

    // 基於規律的斷詞算法 (Pattern-based Syllabification)
    // 邏輯：識別 [子音群 + 母音群 + (結尾子音，如果後面沒有接母音)]
    const SYLLABLE_PATTERN = /([^aeiouy]*[aeiouy]+(?:[^aeiouy](?![aeiouy]))?)/gi;

    // 匹配 5 個字母以上的單字進行處理
    return text.replace(/([a-zA-Z]{5,})/g, (word) => {
        // 先將單字拆解成音節序列
        const syllables = word.match(SYLLABLE_PATTERN);

        if (!syllables || syllables.length <= 1) return word;

        // 拼接音節並在中間插入軟連字號
        let result = '';
        for (let i = 0; i < syllables.length; i++) {
            result += syllables[i];

            // 條件：不是最後一個音節，且該音節與下一個音節長度足夠，且總字長 > 4 才斷開
            if (i < syllables.length - 1 && syllables[i].length >= 2 && syllables[i + 1].length >= 2) {
                result += shy;
            }
        }

        // 如果上面循環沒塞任何 shy，則且長單字至少中間斷開一次
        if (!result.includes(shy) && word.length >= 7) {
            const mid = Math.floor(word.length / 2);
            return word.slice(0, mid) + shy + word.slice(mid);
        }

        return result;
    });
}
