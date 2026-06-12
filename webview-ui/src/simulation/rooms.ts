/* eslint-disable pixel-agents/no-inline-colors -- room vignette gradients are simulation-only dynamic values */

export type RoomId = 'office' | 'park' | 'lab' | 'cafe' | 'boardroom';

/** タイル座標系の矩形 */
export interface RoomBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  cameraCenterPx: { x: number; y: number };
  doorTiles: Array<{ x: number; y: number }>;
}

export interface RoomConfig {
  id: RoomId;
  label: string;
  emoji: string;
  description: string;
  atmosphere: string;
  vignetteColor: string;
  bounds: RoomBounds;
  floorPattern: number;
  floorColor: { h: number; s: number; b: number; c: number };
  wallColor: { h: number; s: number; b: number; c: number } | null;
}

/*
  全体マップ: 50 cols × 38 rows

  ┌─────────────────┬─────────────────┬────────────────┐
  │  office (0,0)   │  lab (17,0)     │  cafe (34,0)   │
  │  16×16          │  16×16          │  16×16         │
  │                 │                 │                │
  │       [door]────┤────[door]───────┤────[door]      │
  └────────[door]───┴────────[door]───┴───[door]───────┘
           │                 │                │
  ┌────────[door]───────────────────────[door]─────────┐
  │  park (0,18)             │  boardroom (26,18)      │
  │  25×18                   │  24×18                  │
  │  (壁なし=開放)            │                         │
  │                          │                         │
  └──────────────────────────┴─────────────────────────┘
*/

const TILE = 16; // TILE_SIZE

function center(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return { x: (x + w / 2) * TILE, y: (y + h / 2) * TILE };
}

export const ROOMS: Record<RoomId, RoomConfig> = {
  office: {
    id: 'office',
    label: 'オフィス会議室',
    emoji: '🏢',
    description: 'フォーマルな会議',
    atmosphere:
      'フォーマルな会議室での議論です。簡潔で論理的な発言を心がけ、ビジネスの文脈で意見を述べてください。',
    vignetteColor:
      'radial-gradient(ellipse at center, transparent 50%, rgba(10,10,20,0.6) 100%)',
    bounds: {
      x: 0,
      y: 0,
      width: 16,
      height: 16,
      cameraCenterPx: center(0, 0, 16, 16),
      doorTiles: [
        { x: 16, y: 8 }, // → lab
        { x: 8, y: 16 }, // ↓ park
      ],
    },
    floorPattern: 1,
    floorColor: { h: 30, s: 20, b: 10, c: 0 },
    wallColor: { h: 25, s: 15, b: 5, c: 0 },
  },
  lab: {
    id: 'lab',
    label: '研究室',
    emoji: '🔬',
    description: '学術的な環境',
    atmosphere:
      '大学の研究室での学術的な議論です。根拠やデータ、先行事例への言及を重視してください。仮説と検証の枠組みで議論を進めてください。',
    vignetteColor:
      'radial-gradient(ellipse at center, transparent 45%, rgba(15,25,50,0.5) 100%)',
    bounds: {
      x: 17,
      y: 0,
      width: 16,
      height: 16,
      cameraCenterPx: center(17, 0, 16, 16),
      doorTiles: [
        { x: 16, y: 8 }, // ← office
        { x: 33, y: 8 }, // → cafe
        { x: 25, y: 16 }, // ↓ boardroom
      ],
    },
    floorPattern: 3,
    floorColor: { h: 210, s: 25, b: 5, c: 0 },
    wallColor: { h: 200, s: 20, b: 0, c: 0 },
  },
  cafe: {
    id: 'cafe',
    label: 'カフェ',
    emoji: '☕',
    description: 'カジュアルで親密',
    atmosphere:
      '落ち着いたカフェでの雑談に近い議論です。くだけた口調で、個人的な体験や感想を交えてください。「〜だと思うんだよね」のような自然な語りで。',
    vignetteColor:
      'radial-gradient(ellipse at center, transparent 45%, rgba(50,30,10,0.45) 100%)',
    bounds: {
      x: 34,
      y: 0,
      width: 16,
      height: 16,
      cameraCenterPx: center(34, 0, 16, 16),
      doorTiles: [
        { x: 33, y: 8 }, // ← lab
        { x: 42, y: 16 }, // ↓ boardroom
      ],
    },
    floorPattern: 2,
    floorColor: { h: 25, s: 35, b: 15, c: 0 },
    wallColor: { h: 20, s: 30, b: 10, c: 0 },
  },
  park: {
    id: 'park',
    label: '公園ベンチ',
    emoji: '🌳',
    description: 'リラックスした屋外',
    atmosphere:
      'のどかな公園のベンチでの対話です。リラックスした口調で、日常の例え話や比喩を自由に使ってください。堅苦しさは不要です。',
    vignetteColor:
      'radial-gradient(ellipse at center, transparent 40%, rgba(20,50,15,0.45) 100%)',
    bounds: {
      x: 0,
      y: 18,
      width: 25,
      height: 18,
      cameraCenterPx: center(0, 18, 25, 18),
      doorTiles: [
        { x: 8, y: 17 }, // ↑ office
        { x: 25, y: 27 }, // → boardroom
      ],
    },
    floorPattern: 5,
    floorColor: { h: 120, s: 40, b: 15, c: 0 },
    wallColor: null, // 壁なし = 開放空間
  },
  boardroom: {
    id: 'boardroom',
    label: '役員会議',
    emoji: '👔',
    description: '重要な意思決定',
    atmosphere:
      '取締役会レベルの重要な意思決定の場です。数字・インパクト・実行可能性・リスクに焦点を当て、経営視点で簡潔に発言してください。',
    vignetteColor:
      'radial-gradient(ellipse at center, transparent 40%, rgba(5,10,30,0.65) 100%)',
    bounds: {
      x: 26,
      y: 18,
      width: 24,
      height: 18,
      cameraCenterPx: center(26, 18, 24, 18),
      doorTiles: [
        { x: 25, y: 27 }, // ← park
        { x: 25, y: 17 }, // ↑ lab
        { x: 42, y: 17 }, // ↑ cafe
      ],
    },
    floorPattern: 4,
    floorColor: { h: 230, s: 20, b: -5, c: 0 },
    wallColor: { h: 225, s: 15, b: -10, c: 0 },
  },
};

export const ROOM_ORDER: RoomId[] = ['office', 'park', 'lab', 'cafe', 'boardroom'];

/** 全部屋の bounds を含む全体マップサイズ */
export const MULTI_ROOM_COLS = 50;
export const MULTI_ROOM_ROWS = 36;
