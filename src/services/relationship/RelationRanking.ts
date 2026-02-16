
import { RelationItem } from './types';

export class RelationRanking {
    /**
     * 更新排名列表的核心演算法 (Halving Jump)
     * 
     * 1. 將有使用的項目計數 +1。
     * 2. 將有使用的項目往上跳躍 (索引減半)。
     * 3. 將新出現的項目插入到列表後半段。
     * 4. 依照限制長度裁切列表。
     * 
     * @param currentList 目前的關聯列表 (可能是陣列或舊版物件)
     * @param activeIds 本次活躍的 ID 列表
     * @param limit 列表最大長度限制
     */
    public static update(currentList: any, activeIds: string[], limit: number): RelationItem[] {
        let list: RelationItem[] = [];
        
        // 兼容舊資料結構 (Object -> Array)
        if (Array.isArray(currentList)) {
            list = [...currentList];
        } else if (currentList && typeof currentList === 'object') {
            list = Object.entries(currentList).map(([id, count]) => ({
                id, count: Number(count)
            })).sort((a, b) => b.count - a.count);
        }

        const activeCounts = new Map<string, number>();
        activeIds.forEach(id => activeCounts.set(id, (activeCounts.get(id) || 0) + 1));
        
        const oldActiveItems: { item: RelationItem; originalIndex: number }[] = [];
        const inactiveItems: RelationItem[] = [];

        list.forEach((item, index) => {
            // 清理舊資料可能殘留的 weight 屬性
            const { weight, ...cleanItem } = item as any;
            
            if (activeCounts.has(cleanItem.id)) {
                cleanItem.count = (cleanItem.count || 0) + activeCounts.get(cleanItem.id)!;
                oldActiveItems.push({ item: cleanItem, originalIndex: index });
            } else {
                inactiveItems.push(cleanItem);
            }
        });

        const resultList = [...inactiveItems];
        const insertionOffsets: Record<number, number> = {};

        // Halving Jump Logic: 舊項目排名提升
        oldActiveItems.forEach(({ item, originalIndex }) => {
            const targetBase = Math.floor(originalIndex / 2);
            const offset = insertionOffsets[targetBase] || 0;
            const finalTarget = targetBase + offset;
            resultList.splice(finalTarget, 0, item);
            insertionOffsets[targetBase] = offset + 1;
        });

        // New Items Logic: 新項目插入
        const newIds = Array.from(activeCounts.keys()).filter(id => !list.find(existing => existing.id === id));
        if (newIds.length > 0) {
            const newItems: RelationItem[] = newIds.map(id => ({ id, count: activeCounts.get(id)! }));
            let insertIndex = -1; 
            
            // 尋找最後一個活躍項目的位置，插入在它之後
            for (let i = resultList.length - 1; i >= 0; i--) {
                const itemId = resultList[i].id;
                if (activeCounts.has(itemId) && !newIds.includes(itemId)) {
                    insertIndex = i + 1; break;
                }
            }
            
            // 如果沒找到參考點，則插入在中間位置
            if (insertIndex === -1) insertIndex = Math.floor(resultList.length / 2);
            resultList.splice(insertIndex, 0, ...newItems);
        }

        if (resultList.length > limit) return resultList.slice(0, limit);
        return resultList;
    }
}
