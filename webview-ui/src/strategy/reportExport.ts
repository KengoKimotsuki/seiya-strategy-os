/**
 * StrategyReport を Markdown / JSON 文書に変換し、ブラウザでダウンロードさせる。
 * Markdown は同一オブジェクトから生成（UI 表示とソースを一致させる）。
 * 討議トランスクリプト＋結論プローズは Markdown の後段に併載する。
 */

import {
  PLAN_RANK_LABEL,
  type PlanRank,
  type StrategyReport,
} from './reportSchema';

export interface ReportMeta {
  title: string; // 案件名
  date: string; // YYYY-MM-DD
  model: string; // 使用モデル
  personaNames: string[]; // 参加人格
}

export interface TranscriptLine {
  name: string;
  content: string;
  kind: 'speaker' | 'summary' | 'conclusion';
}

function rankOrder(rank: PlanRank): number {
  return rank === 'matsu' ? 0 : rank === 'take' ? 1 : 2;
}

function bullets(items: string[]): string {
  if (items.length === 0) return '- （記載なし）';
  return items.map((i) => `- ${i}`).join('\n');
}

export function reportToMarkdown(
  report: StrategyReport,
  meta: ReportMeta,
  transcript: TranscriptLine[] = [],
  conclusionText = '',
): string {
  const sortedPlans = [...report.plans].sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank));

  const planBlocks = sortedPlans
    .map((p) => {
      const recommended = p.rank === report.recommended ? '（★推奨）' : '';
      return [
        `### ${PLAN_RANK_LABEL[p.rank]}案: ${p.name} ${recommended}`.trim(),
        `- 狙い: ${p.aim}`,
        `- 主要施策:\n${p.actions.map((a) => `  - ${a}`).join('\n') || '  - （記載なし）'}`,
        `- 必要リソース・予算感: ${p.resources}`,
        `- 想定効果: ${p.expectedImpact}`,
        `- 前提・リスク:\n${p.risks.map((r) => `  - ${r}`).join('\n') || '  - （記載なし）'}`,
      ].join('\n');
    })
    .join('\n\n');

  const kpiLines =
    report.firstDomino.kpis.length > 0
      ? report.firstDomino.kpis
          .map((k) => `- [${k.type}] ${k.name}${k.note ? `（${k.note}）` : ''}`)
          .join('\n')
      : '- （記載なし）';

  const transcriptBlock =
    transcript.length > 0
      ? transcript
          .map((t) => {
            const tag = t.kind === 'summary' ? '📋 ' : t.kind === 'conclusion' ? '📝 ' : '';
            return `**${tag}${t.name}**: ${t.content}`;
          })
          .join('\n\n')
      : '（記録なし）';

  return `# ${report.title}

> 戦略構築AI SEIYA — 戦略レポート
> 案件: ${meta.title} ／ 作成日: ${meta.date} ／ モデル: ${meta.model}
> 参加: ${meta.personaNames.join('・')}

## エグゼクティブ要約
${bullets(report.execSummary)}

## 現状診断
- **WHERE（非対称・白地）**: ${report.diagnosis.where}
- **WHY US（資格）**: ${report.diagnosis.whyUs}
- **WHAT（書き換え）**: ${report.diagnosis.what.before} → ${report.diagnosis.what.after}

## 打ち手3案（松竹梅）
${planBlocks}

## 最初のドミノ・Go基準
- **最初に倒す一手**: ${report.firstDomino.action}
- **Go/No-Go の判断材料**:
${report.firstDomino.goCriteria.map((g) => `  - ${g}`).join('\n') || '  - （記載なし）'}
- **検証KPI（敵比×絶対値）**:
${kpiLines}

## 留保・要確認（叩き台 / 別途協議）
${bullets(report.reservations)}

---

## 古賀CMO 最終結論
${conclusionText || '（記録なし）'}

## 討議ログ
${transcriptBlock}
`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) || 'report';
}

function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 次フレームで解放（即時 revoke はクリック前にURLが無効化されることがある）
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadReportMarkdown(
  report: StrategyReport,
  meta: ReportMeta,
  transcript: TranscriptLine[] = [],
  conclusionText = '',
): void {
  const md = reportToMarkdown(report, meta, transcript, conclusionText);
  downloadBlob(`${sanitizeFilename(meta.title)}_${meta.date}.md`, md, 'text/markdown');
}

export function downloadReportJson(report: StrategyReport, meta: ReportMeta): void {
  const json = JSON.stringify({ meta, report }, null, 2);
  downloadBlob(`${sanitizeFilename(meta.title)}_${meta.date}.json`, json, 'application/json');
}

/** YYYY-MM-DD（ローカル）。 */
export function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
