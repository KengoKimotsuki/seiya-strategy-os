/**
 * 案件インプット（戦略会議に投入する事業課題のブリーフ）。
 * フォーム（BriefPanel）で収集し、briefToContext() で討議用のコンテキスト文字列へ整形する。
 * この文字列が「議題（topic）」として全専門家と古賀CMOに共有される。
 */

export interface CaseBrief {
  title: string; // 案件名（ヘッダー・レポートメタ・保存キーに使用）
  company: string; // 会社 / 事業主体
  business: string; // 事業内容
  challenge: string; // 解決したい事業課題
  target: string; // ターゲット顧客
  current: string; // 現状（数値・KPI・競合状況など）
  constraints: string; // 制約（予算上限・期限・既存KPI など）
}

export function emptyCaseBrief(): CaseBrief {
  return {
    title: '',
    company: '',
    business: '',
    challenge: '',
    target: '',
    current: '',
    constraints: '',
  };
}

/** 必須は「案件名」と「課題」。最低限これがあれば会議を開始できる。 */
export function isCaseBriefReady(brief: CaseBrief): boolean {
  return brief.title.trim().length > 0 && brief.challenge.trim().length > 0;
}

/** ブリーフを討議のトピック文字列に整形する。空欄はスキップする。 */
export function briefToContext(brief: CaseBrief): string {
  const rows: Array<[string, string]> = [
    ['案件名', brief.title],
    ['会社 / 事業主体', brief.company],
    ['事業内容', brief.business],
    ['解決したい事業課題', brief.challenge],
    ['ターゲット顧客', brief.target],
    ['現状（数値・競合・KPI）', brief.current],
    ['制約（予算・期限・既存KPI）', brief.constraints],
  ];
  const lines = rows
    .filter(([, value]) => value.trim().length > 0)
    .map(([label, value]) => `- ${label}: ${value.trim()}`);
  return lines.join('\n');
}

/** 会議のタイトル（案件名が空ならフォールバック）。 */
export function caseTitle(brief: CaseBrief): string {
  return brief.title.trim() || '無題の案件';
}
