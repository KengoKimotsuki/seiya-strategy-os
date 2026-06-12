/**
 * 5 部屋レイアウト JSON を生成するユーティリティ。
 * ブラウザモード初回ロード時に呼ばれ、browserMock 経由で layoutLoaded に渡される。
 * 既存の家具アセット ID のみ使用。
 */

import type { RoomId } from './rooms';
import { MULTI_ROOM_COLS, MULTI_ROOM_ROWS, ROOMS } from './rooms';

const WALL = 0;
const VOID = 255;

interface PlacedItem {
  uid: string;
  type: string;
  col: number;
  row: number;
  color?: { h: number; s: number; b: number; c: number; colorize?: boolean } | null;
}

interface TileColor {
  h: number;
  s: number;
  b: number;
  c: number;
  colorize?: boolean;
}

let uidSeq = 1;
function uid(): string {
  return `gen-${uidSeq++}`;
}

function createGrid(): {
  tiles: number[];
  tileColors: Array<TileColor | null>;
  furniture: PlacedItem[];
} {
  const total = MULTI_ROOM_COLS * MULTI_ROOM_ROWS;
  const tiles = new Array<number>(total).fill(VOID);
  const tileColors = new Array<TileColor | null>(total).fill(null);
  const furniture: PlacedItem[] = [];
  return { tiles, tileColors, furniture };
}

function idx(col: number, row: number): number {
  return row * MULTI_ROOM_COLS + col;
}

function fillFloor(
  tiles: number[],
  tileColors: Array<TileColor | null>,
  x: number,
  y: number,
  w: number,
  h: number,
  pattern: number,
  color: { h: number; s: number; b: number; c: number },
): void {
  for (let r = y; r < y + h; r++) {
    for (let c = x; c < x + w; c++) {
      if (c >= 0 && c < MULTI_ROOM_COLS && r >= 0 && r < MULTI_ROOM_ROWS) {
        tiles[idx(c, r)] = pattern;
        tileColors[idx(c, r)] = { ...color, colorize: true };
      }
    }
  }
}

function fillWalls(
  tiles: number[],
  tileColors: Array<TileColor | null>,
  x: number,
  y: number,
  w: number,
  h: number,
  color: { h: number; s: number; b: number; c: number },
): void {
  // 上辺
  for (let c = x; c < x + w; c++) {
    tiles[idx(c, y)] = WALL;
    tileColors[idx(c, y)] = { ...color, colorize: true };
  }
  // 下辺
  for (let c = x; c < x + w; c++) {
    tiles[idx(c, y + h - 1)] = WALL;
    tileColors[idx(c, y + h - 1)] = { ...color, colorize: true };
  }
  // 左辺
  for (let r = y; r < y + h; r++) {
    tiles[idx(x, r)] = WALL;
    tileColors[idx(x, r)] = { ...color, colorize: true };
  }
  // 右辺
  for (let r = y; r < y + h; r++) {
    tiles[idx(x + w - 1, r)] = WALL;
    tileColors[idx(x + w - 1, r)] = { ...color, colorize: true };
  }
}

function openDoors(
  tiles: number[],
  tileColors: Array<TileColor | null>,
  roomId: RoomId,
): void {
  const room = ROOMS[roomId];
  const fc = { ...room.floorColor, colorize: true };
  for (const d of room.bounds.doorTiles) {
    // ドアとその周辺 3 タイル幅を床にする
    for (let offset = -1; offset <= 1; offset++) {
      const c = d.x;
      const r = d.y + offset;
      if (c >= 0 && c < MULTI_ROOM_COLS && r >= 0 && r < MULTI_ROOM_ROWS) {
        tiles[idx(c, r)] = room.floorPattern;
        tileColors[idx(c, r)] = fc;
      }
      // 横通路の場合
      const c2 = d.x + offset;
      const r2 = d.y;
      if (c2 >= 0 && c2 < MULTI_ROOM_COLS && r2 >= 0 && r2 < MULTI_ROOM_ROWS) {
        tiles[idx(c2, r2)] = room.floorPattern;
        tileColors[idx(c2, r2)] = fc;
      }
    }
  }
}

function place(furniture: PlacedItem[], type: string, col: number, row: number, color?: PlacedItem['color']): void {
  furniture.push({ uid: uid(), type, col, row, color: color ?? null });
}

function buildOffice(furniture: PlacedItem[]): void {
  const bx = 1;
  const by = 1;
  // デスク 2 列
  place(furniture, 'DESK_FRONT', bx + 2, by + 3);
  place(furniture, 'DESK_FRONT', bx + 2, by + 7);
  place(furniture, 'DESK_FRONT', bx + 8, by + 3);
  place(furniture, 'DESK_FRONT', bx + 8, by + 7);
  // 椅子 (デスク前)
  place(furniture, 'WOODEN_CHAIR_FRONT', bx + 3, by + 5);
  place(furniture, 'WOODEN_CHAIR_FRONT', bx + 5, by + 5);
  place(furniture, 'WOODEN_CHAIR_FRONT', bx + 3, by + 9);
  place(furniture, 'WOODEN_CHAIR_FRONT', bx + 5, by + 9);
  place(furniture, 'WOODEN_CHAIR_FRONT', bx + 9, by + 5);
  place(furniture, 'WOODEN_CHAIR_FRONT', bx + 11, by + 5);
  place(furniture, 'WOODEN_CHAIR_FRONT', bx + 9, by + 9);
  place(furniture, 'WOODEN_CHAIR_FRONT', bx + 11, by + 9);
  // PC (デスク上)
  place(furniture, 'PC_FRONT_OFF', bx + 3, by + 3);
  place(furniture, 'PC_FRONT_OFF', bx + 9, by + 3);
  place(furniture, 'PC_FRONT_OFF', bx + 3, by + 7);
  place(furniture, 'PC_FRONT_OFF', bx + 9, by + 7);
  // ホワイトボード (壁)
  place(furniture, 'WHITEBOARD', bx + 6, by);
  // 植物
  place(furniture, 'PLANT', bx + 1, by + 1);
  place(furniture, 'PLANT_2', bx + 13, by + 1);
}

function buildLab(furniture: PlacedItem[]): void {
  const bx = 18;
  const by = 1;
  // デスク密集
  place(furniture, 'DESK_FRONT', bx + 1, by + 2);
  place(furniture, 'DESK_FRONT', bx + 1, by + 5);
  place(furniture, 'DESK_FRONT', bx + 1, by + 8);
  place(furniture, 'DESK_FRONT', bx + 7, by + 2);
  place(furniture, 'DESK_FRONT', bx + 7, by + 5);
  place(furniture, 'DESK_FRONT', bx + 7, by + 8);
  // 椅子
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 2, by + 4);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 4, by + 4);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 2, by + 7);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 4, by + 7);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 2, by + 10);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 8, by + 4);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 10, by + 4);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 8, by + 7);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 10, by + 7);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 8, by + 10);
  // PC 多数
  place(furniture, 'PC_FRONT_OFF', bx + 2, by + 2);
  place(furniture, 'PC_FRONT_OFF', bx + 8, by + 2);
  place(furniture, 'PC_FRONT_OFF', bx + 2, by + 5);
  place(furniture, 'PC_FRONT_OFF', bx + 8, by + 5);
  place(furniture, 'PC_FRONT_OFF', bx + 2, by + 8);
  place(furniture, 'PC_FRONT_OFF', bx + 8, by + 8);
  // 本棚 (壁面)
  place(furniture, 'BOOKSHELF', bx + 1, by);
  place(furniture, 'BOOKSHELF', bx + 4, by);
  place(furniture, 'DOUBLE_BOOKSHELF', bx + 11, by);
  place(furniture, 'BOOKSHELF', bx + 7, by);
}

function buildCafe(furniture: PlacedItem[]): void {
  const bx = 35;
  const by = 1;
  const brown = { h: 25, s: 40, b: 10, c: 0, colorize: true };
  // 小テーブル分散
  place(furniture, 'SMALL_TABLE_FRONT', bx + 2, by + 2, brown);
  place(furniture, 'SMALL_TABLE_FRONT', bx + 8, by + 2, brown);
  place(furniture, 'SMALL_TABLE_FRONT', bx + 2, by + 8, brown);
  place(furniture, 'SMALL_TABLE_FRONT', bx + 8, by + 8, brown);
  // ソファ
  place(furniture, 'SOFA_FRONT', bx + 2, by + 5);
  place(furniture, 'SOFA_FRONT', bx + 8, by + 5);
  // 椅子
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 2, by + 4);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 4, by + 4);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 8, by + 4);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 10, by + 4);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 2, by + 10);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 4, by + 10);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 8, by + 10);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 10, by + 10);
  // 植物で装飾
  place(furniture, 'LARGE_PLANT', bx + 12, by + 1);
  place(furniture, 'CACTUS', bx + 1, by + 11);
  place(furniture, 'HANGING_PLANT', bx + 6, by);
  // コーヒー (テーブル上)
  place(furniture, 'COFFEE', bx + 3, by + 2);
  place(furniture, 'COFFEE', bx + 9, by + 8);
  // 絵画
  place(furniture, 'LARGE_PAINTING', bx + 10, by);
}

function buildPark(furniture: PlacedItem[]): void {
  const bx = 1;
  const by = 19;
  // ベンチ散在
  place(furniture, 'WOODEN_BENCH', bx + 3, by + 4);
  place(furniture, 'WOODEN_BENCH', bx + 8, by + 4);
  place(furniture, 'WOODEN_BENCH', bx + 14, by + 4);
  place(furniture, 'WOODEN_BENCH', bx + 3, by + 10);
  place(furniture, 'WOODEN_BENCH', bx + 8, by + 10);
  place(furniture, 'WOODEN_BENCH', bx + 14, by + 10);
  place(furniture, 'CUSHIONED_BENCH', bx + 20, by + 7);
  // 植物大量
  place(furniture, 'LARGE_PLANT', bx + 1, by + 1);
  place(furniture, 'LARGE_PLANT', bx + 6, by + 1);
  place(furniture, 'LARGE_PLANT', bx + 12, by + 1);
  place(furniture, 'LARGE_PLANT', bx + 18, by + 1);
  place(furniture, 'PLANT', bx + 4, by + 7);
  place(furniture, 'PLANT_2', bx + 10, by + 7);
  place(furniture, 'PLANT', bx + 16, by + 7);
  place(furniture, 'CACTUS', bx + 22, by + 3);
  place(furniture, 'CACTUS', bx + 22, by + 12);
  place(furniture, 'PLANT', bx + 1, by + 13);
  place(furniture, 'PLANT_2', bx + 11, by + 13);
  place(furniture, 'POT', bx + 7, by + 13);
}

function buildBoardroom(furniture: PlacedItem[]): void {
  const bx = 27;
  const by = 19;
  const dark = { h: 230, s: 15, b: -5, c: 0, colorize: true };
  // 大テーブル中央
  place(furniture, 'TABLE_FRONT', bx + 8, by + 3, dark);
  place(furniture, 'TABLE_FRONT', bx + 12, by + 3, dark);
  // 椅子整列 (テーブル周り)
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 8, by + 7);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 10, by + 7);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 12, by + 7);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 14, by + 7);
  place(furniture, 'CUSHIONED_CHAIR_BACK', bx + 8, by + 2);
  place(furniture, 'CUSHIONED_CHAIR_BACK', bx + 10, by + 2);
  place(furniture, 'CUSHIONED_CHAIR_BACK', bx + 12, by + 2);
  place(furniture, 'CUSHIONED_CHAIR_BACK', bx + 14, by + 2);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 8, by + 11);
  place(furniture, 'CUSHIONED_CHAIR_FRONT', bx + 12, by + 11);
  // ホワイトボード
  place(furniture, 'WHITEBOARD', bx + 4, by);
  place(furniture, 'WHITEBOARD', bx + 16, by);
  // 装飾
  place(furniture, 'LARGE_PAINTING', bx + 10, by);
  place(furniture, 'CLOCK', bx + 1, by);
  place(furniture, 'PLANT', bx + 1, by + 1);
  place(furniture, 'PLANT_2', bx + 20, by + 1);
  place(furniture, 'BIN', bx + 20, by + 14);
}

export function generateMultiRoomLayout(): {
  version: 1;
  cols: number;
  rows: number;
  tiles: number[];
  furniture: PlacedItem[];
  tileColors: Array<TileColor | null>;
} {
  uidSeq = 1;
  const { tiles, tileColors, furniture } = createGrid();

  // 各部屋の床を敷く
  for (const roomId of Object.keys(ROOMS) as RoomId[]) {
    const room = ROOMS[roomId];
    const b = room.bounds;
    fillFloor(tiles, tileColors, b.x, b.y, b.width, b.height, room.floorPattern, room.floorColor);
    if (room.wallColor) {
      fillWalls(tiles, tileColors, b.x, b.y, b.width, b.height, room.wallColor);
    }
  }

  // 上段・下段の間の通路帯 (row 16-17)
  const corridorColor = { h: 0, s: 0, b: 0, c: 0, colorize: true };
  for (let c = 0; c < MULTI_ROOM_COLS; c++) {
    for (let r = 16; r <= 17; r++) {
      if (tiles[idx(c, r)] === VOID) {
        tiles[idx(c, r)] = 6; // FLOOR_6 (通路用)
        tileColors[idx(c, r)] = corridorColor;
      }
    }
  }

  // ドアを開ける (壁を床に置き換え)
  for (const roomId of Object.keys(ROOMS) as RoomId[]) {
    openDoors(tiles, tileColors, roomId);
  }

  // 家具配置
  buildOffice(furniture);
  buildLab(furniture);
  buildCafe(furniture);
  buildPark(furniture);
  buildBoardroom(furniture);

  return {
    version: 1,
    cols: MULTI_ROOM_COLS,
    rows: MULTI_ROOM_ROWS,
    tiles,
    furniture,
    tileColors,
  };
}
