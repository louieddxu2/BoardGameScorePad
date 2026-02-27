
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
        let insertTargetIndex = 0; // 用於維持同批活躍項目的相對順序

        // Count-Bounded Jump Logic: 減半位置與次數位置取小
        oldActiveItems.forEach(({ item, originalIndex }) => {
            // 1. 減半位置 (Halved Position)
            const halvedIndex = Math.floor(originalIndex / 2);

            // 2. 次數位置 (Count Position)
            // 從 insertTargetIndex 開始往後找，找到第一個 count <= item.count 的位置
            let countIndex = resultList.length; // 預設插在最後
            for (let i = insertTargetIndex; i < resultList.length; i++) {
                if ((resultList[i].count || 0) <= item.count) {
                    countIndex = i;
                    break;
                }
            }

            // 最終位置為兩者取小，但絕不能小於 insertTargetIndex (維持輸入相對順序)
            const minIndex = Math.min(halvedIndex, countIndex);
            const finalIndex = Math.max(insertTargetIndex, minIndex);

            resultList.splice(finalIndex, 0, item);
            insertTargetIndex = finalIndex + 1; // 下一個項目必須加在此項目之後
        });

        // New Items Logic: 新人加入 (被視為原本在陣列最尾端)
        const newIds = Array.from(activeCounts.keys()).filter(id => !list.find(existing => existing.id === id));
        if (newIds.length > 0) {
            const newItems: RelationItem[] = newIds.map(id => ({ id, count: activeCounts.get(id)! }));
            // 新項目不需特別依照 count 排序，依照傳入順序即可 (通常是同局一起加入的玩家或地點)

            let newItemTargetIndex = 0;
            newItems.forEach((item, index) => {
                // 原位置視為陣列最尾端 (現有列表長度 + 目前已處理的新人數量 index)
                const originalIndex = list.length + index;
                const halvedIndex = Math.floor(originalIndex / 2);

                let countIndex = resultList.length;
                for (let i = newItemTargetIndex; i < resultList.length; i++) {
                    if ((resultList[i].count || 0) <= item.count) {
                        countIndex = i;
                        break;
                    }
                }

                const minIndex = Math.min(halvedIndex, countIndex);
                const finalIndex = Math.max(newItemTargetIndex, minIndex);

                resultList.splice(finalIndex, 0, item);
                newItemTargetIndex = finalIndex + 1;
            });
        }

        if (resultList.length > limit) return resultList.slice(0, limit);
        return resultList;
    }
}
