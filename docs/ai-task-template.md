# AI Task Template (Fast Loop)

在開始修改前，先填這 3 塊，目標是減少來回與 token 消耗。

## 1) 預計修改檔案
- `path/to/fileA`
- `path/to/fileB`

## 2) 不應修改檔案
- `path/to/fileX`
- `path/to/fileY`

## 3) 驗證方式
- `npx tsc --noEmit`
- `npx vitest run --exclude "{src/components/session/SessionUI.test.tsx,src/utils/ui-consistency.test.ts}"`
- (若是 AI simple generator) `npx vitest run src/features/ai-generator/hooks/useAiSimpleGenerator.test.tsx`

## 回報格式
- Modified files:
  - `...`
- Verification:
  - `...`
- Notes (optional):
  - `...`

