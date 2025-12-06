
import { GameTemplate } from './types';

export const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

export const DEFAULT_TEMPLATES: GameTemplate[] = [
  {
    "id": "sys_agricola",
    "name": "農家樂 (Agricola)",
    "description": "17世紀農莊經營，包含詳細的農作物與動物查表計分。",
    "createdAt": 1700000000001,
    "columns": [
      { "id": "fields", "name": "耕地", "type": "number", "isScoring": true, "weight": 1, "unit": "塊", "mappingRules": [{ "max": 1, "score": -1 }, { "min": 2, "max": 2, "score": 1 }, { "min": 3, "max": 3, "score": 2 }, { "min": 4, "max": 4, "score": 3 }, { "min": 5, "score": 4 }] },
      { "id": "pastures", "name": "牧場", "type": "number", "isScoring": true, "weight": 1, "unit": "個", "mappingRules": [{ "max": 0, "score": -1 }, { "min": 1, "max": 1, "score": 1 }, { "min": 2, "max": 2, "score": 2 }, { "min": 3, "max": 3, "score": 3 }, { "min": 4, "score": 4 }] },
      { "id": "grain", "name": "麥子", "type": "number", "isScoring": true, "weight": 1, "unit": "份", "mappingRules": [{ "max": 0, "score": -1 }, { "min": 1, "max": 3, "score": 1 }, { "min": 4, "max": 5, "score": 2 }, { "min": 6, "max": 7, "score": 3 }, { "min": 8, "score": 4 }] },
      { "id": "veg", "name": "蔬菜", "type": "number", "isScoring": true, "weight": 1, "unit": "份", "mappingRules": [{ "max": 0, "score": -1 }, { "min": 1, "max": 1, "score": 1 }, { "min": 2, "max": 2, "score": 2 }, { "min": 3, "max": 3, "score": 3 }, { "min": 4, "score": 4 }] },
      { "id": "sheep", "name": "羊", "type": "number", "isScoring": true, "weight": 1, "unit": "隻", "mappingRules": [{ "max": 0, "score": -1 }, { "min": 1, "max": 3, "score": 1 }, { "min": 4, "max": 5, "score": 2 }, { "min": 6, "max": 7, "score": 3 }, { "min": 8, "score": 4 }] },
      { "id": "boar", "name": "野豬", "type": "number", "isScoring": true, "weight": 1, "unit": "隻", "mappingRules": [{ "max": 0, "score": -1 }, { "min": 1, "max": 2, "score": 1 }, { "min": 3, "max": 4, "score": 2 }, { "min": 5, "max": 6, "score": 3 }, { "min": 7, "score": 4 }] },
      { "id": "cattle", "name": "牛", "type": "number", "isScoring": true, "weight": 1, "unit": "隻", "mappingRules": [{ "max": 0, "score": -1 }, { "min": 1, "max": 1, "score": 1 }, { "min": 2, "max": 3, "score": 2 }, { "min": 4, "max": 5, "score": 3 }, { "min": 6, "score": 4 }] },
      { "id": "unused", "name": "空地扣分", "type": "number", "isScoring": true, "weight": -1, "unit": "格" },
      { "id": "family", "name": "家庭成員", "type": "number", "isScoring": true, "weight": 3, "unit": "人" },
      { "id": "house_clay", "name": "磚屋", "type": "number", "isScoring": true, "weight": 1, "unit": "間" },
      { "id": "house_stone", "name": "石屋", "type": "number", "isScoring": true, "weight": 2, "unit": "間" },
      { "id": "dev_cards", "name": "發展卡分數", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "bonus_points", "name": "紅利分數", "type": "number", "isScoring": true, "weight": 1, "unit": "分" }
    ]
  },
  {
    "id": "sys_gwt_1",
    "name": "大西部開拓者：美利堅",
    "description": "",
    "createdAt": 1700000000002,
    "columns": [
      {
        "id": "c1",
        "name": "金錢",
        "type": "number",
        "isScoring": true,
        "weight": 0.2,
        "unit": "元",
        "rounding": "floor",
        "quickButtons": [5, 10, 20],
        "mappingRules": []
      },
      {
        "id": "c2",
        "name": "建築物",
        "type": "number",
        "isScoring": true,
        "weight": 1,
        "unit": "分"
      },
      {
        "id": "b90c04a6-2d91-4b84-b9b0-ddc6b5ff5285",
        "name": "牛卡",
        "type": "number",
        "isScoring": true,
        "weight": 1,
        "options": [],
        "mappingRules": [],
        "unit": "分",
        "rounding": "none",
        "quickButtons": []
      },
      {
        "id": "c3",
        "name": "城市運送",
        "type": "number",
        "isScoring": true,
        "weight": 1,
        "unit": "分",
        "mappingRules": []
      },
      {
        "id": "c4",
        "name": "火車站",
        "type": "number",
        "isScoring": true,
        "weight": 1,
        "unit": "分",
        "mappingRules": []
      },
      {
        "id": "c5",
        "name": "危險板塊",
        "type": "number",
        "isScoring": true,
        "weight": 1,
        "unit": "分"
      },
      {
        "id": "c9",
        "name": "專家",
        "type": "number",
        "isScoring": true,
        "weight": 4,
        "unit": "位",
        "mappingRules": []
      },
      {
        "id": "c6",
        "name": "目標卡",
        "type": "number",
        "isScoring": true,
        "weight": 1,
        "unit": "分",
        "mappingRules": []
      },
      {
        "id": "c7",
        "name": "移動3分解鎖",
        "type": "select",
        "isScoring": true,
        "weight": 1,
        "unit": "",
        "options": [
          {
            "value": 3,
            "label": "有"
          },
          {
            "value": 0,
            "label": "無"
          }
        ],
        "calculationType": "standard"
      },
      {
        "id": "c8",
        "name": "結束玩家",
        "type": "select",
        "isScoring": true,
        "weight": 1,
        "unit": "",
        "options": [
          {
            "value": 2,
            "label": "是"
          },
          {
            "value": 0,
            "label": "否"
          }
        ],
        "calculationType": "standard"
      }
    ]
  },
  {
    "id": "sys_gwt_arg",
    "name": "大西部：阿根廷 (GWT: Argentina)",
    "description": "包含農夫、港口與糧食機制。",
    "createdAt": 1700000000003,
    "columns": [
      { "id": "c1", "name": "金錢", "type": "number", "isScoring": true, "weight": 0.2, "unit": "元 ($5=1分)", "rounding": "floor" },
      { "id": "c2", "name": "建築物", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "c3", "name": "城市/港口", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "c4", "name": "火車站", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "c5", "name": "農夫 (含紅利)", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "c6", "name": "任務卡", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "c7", "name": "玩家圖板解鎖", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "c8", "name": "糧食/其他", "type": "number", "isScoring": true, "weight": 1, "unit": "分" }
    ]
  },
{
  "id": "7d844523-2a19-4b09-bc81-bd46d83d1e8d",
  "name": "大西部開拓者：紐西蘭",
  "description": "包含剪毛、鳥類卡與商店獎勵。",
  "createdAt": 1765012461244,
  "columns": [
    {
      "id": "c1",
      "name": "金錢",
      "type": "number",
      "isScoring": true,
      "weight": 0.2,
      "unit": "元",
      "rounding": "floor",
      "mappingRules": []
    },
    {
      "id": "c2",
      "name": "建築物",
      "type": "number",
      "isScoring": true,
      "weight": 1,
      "unit": "分"
    },
    {
      "id": "c3",
      "name": "貿易站",
      "type": "number",
      "isScoring": true,
      "weight": 1,
      "unit": "分",
      "mappingRules": []
    },
    {
      "id": "5ac5b020-f457-451b-9ea5-b2946a8fd618",
      "name": "港口",
      "type": "number",
      "isScoring": true,
      "weight": 1,
      "options": [],
      "mappingRules": [],
      "unit": "分",
      "rounding": "none",
      "quickButtons": []
    },
    {
      "id": "0e5c54ab-8cc2-4441-93d2-e158e1d1673f",
      "name": "開拓者軌",
      "type": "number",
      "isScoring": true,
      "weight": 1,
      "options": [],
      "mappingRules": [
        {
          "score": 0,
          "min": 0,
          "max": 4
        },
        {
          "score": 3,
          "min": 5,
          "max": 8
        },
        {
          "score": 7,
          "min": 9,
          "max": 11
        },
        {
          "score": 10,
          "min": 12,
          "max": 13
        },
        {
          "score": 13,
          "min": 14,
          "max": 15
        },
        {
          "score": 15,
          "min": 16
        }
      ],
      "unit": "格",
      "rounding": "none",
      "quickButtons": [],
      "calculationType": "standard"
    },
    {
      "id": "7cad37ab-86fe-4771-8d3b-fe9e12ae6346",
      "name": "天災/獎勵板塊",
      "type": "number",
      "isScoring": true,
      "weight": 1,
      "options": [],
      "mappingRules": [],
      "unit": "分",
      "rounding": "none",
      "quickButtons": []
    },
    {
      "id": "c4",
      "name": "綿羊卡與獎勵卡",
      "type": "number",
      "isScoring": true,
      "weight": 1,
      "unit": "分",
      "mappingRules": []
    },
    {
      "id": "c5",
      "name": "目標卡",
      "type": "number",
      "isScoring": true,
      "weight": 1,
      "unit": "分",
      "mappingRules": []
    },
    {
      "id": "c6",
      "name": "港務長板塊",
      "type": "number",
      "isScoring": true,
      "weight": 1,
      "unit": "分",
      "mappingRules": []
    },
    {
      "id": "c7",
      "name": "移動3分解鎖",
      "type": "select",
      "isScoring": true,
      "weight": 1,
      "unit": "",
      "options": [
        {
          "value": 3,
          "label": "有"
        },
        {
          "value": 0,
          "label": "無"
        }
      ],
      "calculationType": "standard"
    },
    {
      "id": "c8",
      "name": "工人第5格",
      "type": "number",
      "isScoring": true,
      "weight": 4,
      "unit": "位",
      "mappingRules": []
    },
    {
      "id": "37cef49b-1f3c-4bb4-94c4-7555fef58b12",
      "name": "倉庫",
      "type": "number",
      "isScoring": true,
      "weight": 1,
      "options": [],
      "mappingRules": [],
      "unit": "分",
      "rounding": "none",
      "quickButtons": []
    },
    {
      "id": "cf6d8175-2279-4a5d-9d92-8a83f9a2196b",
      "name": "結束遊戲",
      "type": "select",
      "isScoring": true,
      "weight": 1,
      "options": [
        {
          "value": 5,
          "label": "是"
        },
        {
          "value": 0,
          "label": "否"
        }
      ],
      "mappingRules": [],
      "unit": "",
      "rounding": "none",
      "quickButtons": [],
      "calculationType": "standard"
    }
  ]
},
  {
    "id": "sys_iaww",
    "name": "美麗新世界 (It's a Wonderful World)",
    "description": "卡片引擎構築，依顏色倍率計分。",
    "createdAt": 1700000000005,
    "columns": [
      { "id": "base", "name": "基本分 (指示物/卡片)", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "gen", "name": "將軍 (紅)", "type": "number", "isScoring": true, "weight": 1, "unit": "個" },
      { "id": "fin", "name": "金融家 (藍)", "type": "number", "isScoring": true, "weight": 1, "unit": "個" },
      { "id": "blue", "name": "藍卡加分", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "yellow", "name": "黃卡加分", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "green", "name": "綠卡加分", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "red", "name": "紅卡加分", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "black", "name": "黑卡加分", "type": "number", "isScoring": true, "weight": 1, "unit": "分" }
    ]
  },
  {
    "id": "sys_keyflow",
    "name": "Key Flow",
    "description": "卡片輪抽建設遊戲。",
    "createdAt": 1700000000006,
    "columns": [
      { "id": "c1", "name": "村莊卡 (Icon)", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "c2", "name": "冬季卡 (計分)", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "c3", "name": "動物", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "c4", "name": "Keyples", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "c5", "name": "技能/資源", "type": "number", "isScoring": true, "weight": 1, "unit": "分" }
    ]
  },
  {
    "id": "sys_kingdom_builder",
    "name": "Kingdom Builder",
    "description": "區域控制與連接遊戲。",
    "createdAt": 1700000000007,
    "columns": [
      { "id": "k1", "name": "王國卡 A", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "k2", "name": "王國卡 B", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "k3", "name": "王國卡 C", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "castles", "name": "城堡", "type": "number", "isScoring": true, "weight": 3, "unit": "座" }
    ]
  },
  {
    "id": "sys_harmonies",
    "name": "和諧之森 (Harmonies)",
    "description": "板塊放置與動物棲息地。",
    "createdAt": 1700000000008,
    "columns": [
      { "id": "landscape", "name": "地形分數", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "animals", "name": "動物分數", "type": "number", "isScoring": true, "weight": 1, "unit": "分" }
    ]
  },
  {
    "id": "sys_fromage",
    "name": "Fromage",
    "description": "起司工匠骰子遊戲。",
    "createdAt": 1700000000009,
    "columns": [
      { "id": "prestige", "name": "聲望軌", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "blueprints", "name": "藍圖", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "cheesemaker", "name": "起司工匠 (屏風)", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "cheese", "name": "起司板塊", "type": "number", "isScoring": true, "weight": 1, "unit": "分" }
    ]
  },
  {
    "id": "sys_arnak",
    "name": "阿納克遺跡 (Lost Ruins of Arnak)",
    "description": "探險與研究，包含研究軌、神廟、守護者與卡片計分。",
    "createdAt": 1700000000010,
    "columns": [
      { "id": "research", "name": "研究軌分數", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "temple", "name": "神廟板塊", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "idols", "name": "神像 (3分)", "type": "number", "isScoring": true, "weight": 3, "unit": "個" },
      { "id": "guardians", "name": "守護者 (5分)", "type": "number", "isScoring": true, "weight": 5, "unit": "隻" },
      { "id": "cards", "name": "卡片 (物品/神器)", "type": "number", "isScoring": true, "weight": 1, "unit": "分" },
      { "id": "fear", "name": "恐懼卡 (扣分)", "type": "number", "isScoring": true, "weight": -1, "unit": "張" }
    ]
  }
];
