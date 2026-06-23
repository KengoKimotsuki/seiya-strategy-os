/**
 * 案件ブリーフに添付する資料（PDF / CSV）を、戦略会議の文脈に注入できる
 * テキストへ変換するためのモジュール。
 *
 * - PDF: pdfExtract.ts（pdfjs）で全ページのテキストを抽出（動的 import で遅延ロード）
 * - CSV: UTF-8 優先でデコードし、失敗時は Shift-JIS / CP932 にフォールバック
 *
 * 抽出テキストは briefToContext()（caseInput.ts）から「# 添付資料データ」として
 * topic に連結され、6 専門家＋古賀 CMO の討議・結論・レポートの入力になる。
 */

/** 対応する添付形式。 */
export type AttachmentKind = 'pdf' | 'csv';

/** 解析済みの添付ファイル（UI 表示・文脈注入・セッション保存に使う）。 */
export interface AttachedFile {
  id: string; // name+size+lastModified の合成（重複検出に使用）
  name: string;
  kind: AttachmentKind;
  text: string; // 文脈に注入する抽出テキスト（上限で切り詰め済み）
  charCount: number; // text.length（切り詰め後）
  originalCharCount: number; // 切り詰め前の文字数
  truncated: boolean; // 上限を超えて切り詰めたか
  error?: string; // 抽出失敗時のメッセージ（成功時は undefined）
}

/** 添付できるファイル数の上限。 */
export const MAX_FILES = 5;

/** 1 ファイルあたりの文字数上限（LLM 文脈・localStorage を膨張させないため）。 */
export const MAX_CHARS_PER_FILE = 20_000;

/** ファイル選択ダイアログ用 accept 属性。 */
export const ATTACHMENT_ACCEPT = '.pdf,.csv';

/** 拡張子から添付種別を判定する。対象外なら null。 */
export function attachmentKind(fileName: string): AttachmentKind | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.csv')) return 'csv';
  return null;
}

interface CappedText {
  text: string;
  charCount: number;
  originalCharCount: number;
  truncated: boolean;
}

/** テキストを上限文字数で切り詰める。切り詰めた場合は truncated=true。 */
export function capText(raw: string, max: number = MAX_CHARS_PER_FILE): CappedText {
  const originalCharCount = raw.length;
  if (originalCharCount <= max) {
    return { text: raw, charCount: originalCharCount, originalCharCount, truncated: false };
  }
  const text = raw.slice(0, max);
  return { text, charCount: text.length, originalCharCount, truncated: true };
}

/** 先頭の UTF-8 BOM（U+FEFF）を除去する。 */
function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/**
 * CSV バイト列を文字列へデコードする。
 * UTF-8 として厳密にデコードを試み、不正バイトがあれば Shift-JIS / CP932 とみなす。
 * （日本語 CSV は Shift-JIS / CP932 が混在するため）
 */
export function decodeCsvBytes(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return stripBom(utf8);
  } catch {
    const sjis = new TextDecoder('shift_jis').decode(bytes);
    return stripBom(sjis);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '不明なエラー';
}

/**
 * 1 ファイルを解析し AttachedFile を返す。失敗時も throw せず error フィールドに格納する。
 * 呼び出し側は attachmentKind() で対象形式を判定してから kind を渡すこと。
 */
export async function extractFileText(file: File, kind: AttachmentKind): Promise<AttachedFile> {
  const id = `${file.name}-${file.size}-${file.lastModified}`;
  const base = {
    id,
    name: file.name,
    kind,
    charCount: 0,
    originalCharCount: 0,
    truncated: false,
  };

  try {
    const buf = await file.arrayBuffer();
    let raw: string;
    if (kind === 'pdf') {
      const { extractPdfText } = await import('./pdfExtract');
      raw = await extractPdfText(buf);
    } else {
      raw = decodeCsvBytes(buf);
    }
    raw = raw.trim();

    if (!raw) {
      const error =
        kind === 'pdf'
          ? 'テキストを抽出できませんでした（画像のみの PDF の可能性）'
          : '空のファイルです';
      return { ...base, text: '', error };
    }

    const capped = capText(raw);
    return { ...base, ...capped };
  } catch (error) {
    return { ...base, text: '', error: getErrorMessage(error) };
  }
}

/**
 * 添付資料を topic 注入用テキストへ整形する。
 * エラー or 空のファイルは除外。切り詰めたファイルは抜粋量を明示する。
 */
export function attachmentsToContext(files: readonly AttachedFile[]): string {
  const usable = files.filter((f) => !f.error && f.text.trim().length > 0);
  if (usable.length === 0) return '';

  const blocks = usable.map((f) => {
    const excerpt = f.truncated
      ? ` / 全${f.originalCharCount}文字中${f.charCount}文字を抜粋`
      : '';
    return `## ${f.name}（${f.kind.toUpperCase()}${excerpt}）\n${f.text}`;
  });

  return ['# 添付資料データ', ...blocks].join('\n\n');
}
