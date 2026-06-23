/**
 * PDF からのテキスト抽出（pdfjs-dist）。
 *
 * pdfjs はバンドルが重く、ワーカーも読み込むため、本モジュールは
 * fileImport.ts から動的 import で遅延ロードする（PDF を添付したときだけ評価される）。
 * top-level に pdfjs を置かないことで、Node のテストランナーが fileImport.ts を
 * 安全に import できる（`?url` 解決を踏まない）。
 */

import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/** PDF バイト列を全ページ走査し、抽出テキストを連結して返す。画像のみのページは空になる。 */
export async function extractPdfText(buf: ArrayBuffer): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) });
  const doc = await loadingTask.promise;
  const pages: string[] = [];
  try {
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
      if (text) pages.push(text);
    }
  } finally {
    await loadingTask.destroy();
  }
  return pages.join('\n\n');
}
