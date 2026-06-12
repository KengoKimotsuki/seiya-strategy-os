import type { ScenarioConfig, ScenarioId } from './types';

export const SCENARIOS: Record<ScenarioId, ScenarioConfig> = {
  balanced: {
    id: 'balanced',
    label: 'バランス型',
    description: '全ツールをほぼ均等に使用',
    toolWeights: { Read: 1, Edit: 1, Bash: 1, Grep: 1, Write: 1, Glob: 1 },
    intervalMs: 2500,
    waitChance: 0.12,
  },
  coding: {
    id: 'coding',
    label: 'コーディング中心',
    description: 'Edit / Write が多め',
    toolWeights: { Read: 1, Edit: 3, Bash: 1, Grep: 0.5, Write: 2, Glob: 0.3 },
    intervalMs: 2200,
    waitChance: 0.1,
  },
  debugging: {
    id: 'debugging',
    label: 'デバッグ中心',
    description: 'Bash / Read / Grep が多め',
    toolWeights: { Read: 2, Edit: 1, Bash: 3, Grep: 2, Write: 0.3, Glob: 0.5 },
    intervalMs: 1800,
    waitChance: 0.18,
  },
  review: {
    id: 'review',
    label: 'レビュー中心',
    description: 'Read / Grep / Glob が多め',
    toolWeights: { Read: 3, Edit: 1, Bash: 0.3, Grep: 3, Write: 0.2, Glob: 2 },
    intervalMs: 2800,
    waitChance: 0.08,
  },
  idle: {
    id: 'idle',
    label: '休憩モード',
    description: 'ほぼ歩き回るだけ',
    toolWeights: { Read: 0.2, Edit: 0.2, Bash: 0.2, Grep: 0.2, Write: 0.2, Glob: 0.2 },
    intervalMs: 4000,
    waitChance: 0.8,
  },
};

export const SCENARIO_ORDER: ScenarioId[] = ['balanced', 'coding', 'debugging', 'review', 'idle'];

/** Tool 名 → 表示用のサンプルステータステキスト (ツール名の後ろに続く説明) */
export const TOOL_STATUS_SAMPLES: Record<string, string[]> = {
  Read: ['README.md を読み込み中', 'ソースコード確認中', '設定ファイルを確認中'],
  Edit: ['index.ts を編集中', '関数を修正中', 'インポートを整理中'],
  Bash: ['npm test 実行中', 'ビルド実行中', 'テスト実行中'],
  Grep: ['"TODO" を検索中', 'パターン照合中', '定義箇所を検索中'],
  Write: ['新規ファイル作成中', 'ドキュメント生成中', 'テンプレ出力中'],
  Glob: ['**/*.ts を列挙中', 'ファイル検索中', '対象パス解決中'],
};

export function pickToolStatus(toolName: string): string {
  const samples = TOOL_STATUS_SAMPLES[toolName];
  if (!samples || samples.length === 0) return `${toolName} 実行中`;
  return samples[Math.floor(Math.random() * samples.length)]!;
}
