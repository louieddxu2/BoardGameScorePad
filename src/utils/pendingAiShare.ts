/** 
 * 記憶體內的待詢問分享標記，App 重啟即自然清空。
 * 這是一個 ES 模組層級的 Set，只存在於當下運行的 JS 記憶體中。
 */
const pendingIds = new Set<string>();

export const markPendingAiShare = (templateId: string): void => {
  pendingIds.add(templateId);
};

export const consumePendingAiShare = (templateId: string): boolean => {
  return pendingIds.delete(templateId);
};

export const hasPendingAiShare = (templateId: string): boolean => {
  return pendingIds.has(templateId);
};
