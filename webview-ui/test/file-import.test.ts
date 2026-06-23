/**
 * fileImport.ts の純粋関数の単体テスト。
 * PDF 抽出（pdfExtract.ts / pdfjs）はブラウザ依存のため対象外。
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  type AttachedFile,
  attachmentKind,
  attachmentsToContext,
  capText,
  decodeCsvBytes,
} from '../src/strategy/fileImport.ts';

function bufOf(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

test('attachmentKind は拡張子を大文字小文字問わず判定し、対象外は null を返す', () => {
  assert.equal(attachmentKind('report.pdf'), 'pdf');
  assert.equal(attachmentKind('DATA.CSV'), 'csv');
  assert.equal(attachmentKind('sheet.xlsx'), null);
  assert.equal(attachmentKind('noext'), null);
});

test('capText は上限以下なら切り詰めない', () => {
  const r = capText('abc', 10);
  assert.equal(r.truncated, false);
  assert.equal(r.text, 'abc');
  assert.equal(r.charCount, 3);
  assert.equal(r.originalCharCount, 3);
});

test('capText は上限を超えたら切り詰めて truncated=true を返す', () => {
  const r = capText('abcdef', 4);
  assert.equal(r.truncated, true);
  assert.equal(r.text, 'abcd');
  assert.equal(r.charCount, 4);
  assert.equal(r.originalCharCount, 6);
});

test('decodeCsvBytes は UTF-8 をデコードし BOM を除去する', () => {
  // BOM(EF BB BF) + "a,b" (UTF-8)
  const decoded = decodeCsvBytes(bufOf([0xef, 0xbb, 0xbf, 0x61, 0x2c, 0x62]));
  assert.equal(decoded, 'a,b');
});

test('decodeCsvBytes は UTF-8 の日本語をデコードする', () => {
  // "売上" を UTF-8 で
  const utf8 = Array.from(new TextEncoder().encode('売上'));
  assert.equal(decodeCsvBytes(bufOf(utf8)), '売上');
});

test('decodeCsvBytes は不正な UTF-8 を Shift-JIS としてデコードする', () => {
  // "あいう" を Shift-JIS で（あ=82A0 い=82A2 う=82A4）。UTF-8 としては不正。
  const decoded = decodeCsvBytes(bufOf([0x82, 0xa0, 0x82, 0xa2, 0x82, 0xa4]));
  assert.equal(decoded, 'あいう');
});

test('attachmentsToContext は使用可能なファイルのみを「# 添付資料データ」として整形する', () => {
  const files: AttachedFile[] = [
    {
      id: '1',
      name: 'ok.csv',
      kind: 'csv',
      text: 'col1,col2\n1,2',
      charCount: 13,
      originalCharCount: 13,
      truncated: false,
    },
    {
      id: '2',
      name: 'broken.pdf',
      kind: 'pdf',
      text: '',
      charCount: 0,
      originalCharCount: 0,
      truncated: false,
      error: '抽出失敗',
    },
  ];
  const ctx = attachmentsToContext(files);
  assert.match(ctx, /# 添付資料データ/);
  assert.match(ctx, /## ok\.csv（CSV）/);
  assert.match(ctx, /col1,col2/);
  // エラーのファイルは含めない
  assert.equal(ctx.includes('broken.pdf'), false);
});

test('attachmentsToContext は切り詰めファイルに抜粋量を明示する', () => {
  const files: AttachedFile[] = [
    {
      id: '1',
      name: 'big.csv',
      kind: 'csv',
      text: 'x'.repeat(100),
      charCount: 100,
      originalCharCount: 5000,
      truncated: true,
    },
  ];
  const ctx = attachmentsToContext(files);
  assert.match(ctx, /全5000文字中100文字を抜粋/);
});

test('attachmentsToContext は使用可能ファイルが無ければ空文字を返す', () => {
  assert.equal(attachmentsToContext([]), '');
});
