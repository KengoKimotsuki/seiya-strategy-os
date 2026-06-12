/**
 * Anthropic Claude API クライアント (ブラウザ直接呼び出し).
 * API キーは localStorage に保存し、ユーザが UI から編集できる。
 * CORS 越えには `anthropic-dangerous-direct-browser-access: true` を使用する。
 */

import { PCM_TYPES, type Personality } from './personalities';

export type LlmModelId =
  | 'claude-haiku-4-5-20251001'
  | 'claude-sonnet-4-5'
  | 'claude-opus-4-6';

export interface LlmModelInfo {
  id: LlmModelId;
  label: string;
  description: string;
}

export const LLM_MODELS: LlmModelInfo[] = [
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Haiku 4.5',
    description: '安価・高速',
  },
  {
    id: 'claude-sonnet-4-5',
    label: 'Sonnet 4.5',
    description: 'バランス型',
  },
  {
    id: 'claude-opus-4-6',
    label: 'Opus 4.6',
    description: '最高品質',
  },
];

const API_KEY_STORAGE = 'pixel-agents.anthropic-api-key';
const MODEL_STORAGE = 'pixel-agents.llm-model';
const API_ENDPOINT = 'https://api.anthropic.com/v1/messages';

export function getApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setApiKey(key: string): void {
  try {
    if (key) localStorage.setItem(API_KEY_STORAGE, key);
    else localStorage.removeItem(API_KEY_STORAGE);
  } catch {
    // ignore quota / privacy errors
  }
}

export function getModel(): LlmModelId {
  try {
    const m = localStorage.getItem(MODEL_STORAGE);
    if (m && LLM_MODELS.some((x) => x.id === m)) return m as LlmModelId;
  } catch {
    // noop
  }
  return 'claude-sonnet-4-5';
}

export function setModel(id: LlmModelId): void {
  try {
    localStorage.setItem(MODEL_STORAGE, id);
  } catch {
    // noop
  }
}

export interface PriorMessage {
  speakerName: string;
  speakerPersonalityLabel: string;
  content: string;
  round: number;
}

/** プロンプト生成に必要な共通引数 (API キー/モデル不要) */
export interface PromptArgs {
  personality: Personality;
  topic: string;
  phase: 'opening' | 'response' | 'closing';
  round: number;
  totalRounds: number;
  priorMessages: PriorMessage[];
  roomAtmosphere?: string;
}

export interface LlmGenerateArgs extends PromptArgs {
  apiKey: string;
  model: LlmModelId;
}

export interface LlmGenerateResult {
  ok: true;
  content: string;
}

export interface LlmGenerateError {
  ok: false;
  error: string;
}

function buildSystemPrompt(p: Personality, phase: PromptArgs['phase']): string {
  const phaseInstr =
    phase === 'opening'
      ? '最初のラウンドなので、このテーマに対するあなたの立場と切り口を明確に提示してください。'
      : phase === 'closing'
        ? '最終ラウンドなので、これまでの議論を踏まえた最終的な立場と結論を簡潔にまとめてください。'
        : '中間ラウンドなので、直前までの他者の発言に具体的に言及し(同意・反論・補強)ながら、議論を前進させてください。';

  // 戦略人格（systemPrompt あり）はそのプロンプトを使用。無ければ従来の PCM プロンプト。
  if (p.systemPrompt) {
    return [p.systemPrompt, '', phaseInstr].join('\n');
  }

  const base = PCM_TYPES[p.base];
  const ph = PCM_TYPES[p.phase];
  const te = PCM_TYPES[p.tertiary];

  return [
    `あなたは「${p.nameJa}」という架空の議論参加者です。`,
    `PCM (Process Communication Model) の以下の性格傾向を持っています:`,
    `- ベース(最も強い): ${base.labelJa} — ${base.traits.join('・')}`,
    `- フェーズ(現在の側面): ${ph.labelJa} — ${ph.traits.join('・')}`,
    `- 第三型(控えめに現れる): ${te.labelJa} — ${te.traits.join('・')}`,
    ``,
    `発言は自然な日本語で、2 〜 4 文、80 〜 200 文字程度。`,
    `具体的な論点・根拠・例示・比喩のいずれかを必ず含め、抽象的なスローガンで終わらせないこと。`,
    `性格傾向に従って論調を変化させること(例: 論理型は根拠重視、共感型は関係者の気持ちに言及、挑戦型は具体的な行動案など)。`,
    `自分の名前を発言内容に含める必要はありません。会話の前振り(「皆さん」「さて」等)も不要。直接意見を述べてください。`,
    phaseInstr,
  ].join('\n');
}

function buildRoomContext(atmosphere?: string): string {
  if (!atmosphere) return '';
  return `\n議論の場: ${atmosphere}`;
}

function buildUserPrompt(args: PromptArgs): string {
  const prior =
    args.priorMessages.length === 0
      ? 'これまでの発言: (なし)'
      : `これまでの発言:\n${args.priorMessages
          .map(
            (m) =>
              `- ${m.speakerName} (${m.speakerPersonalityLabel}, ラウンド ${m.round + 1}): 「${m.content}」`,
          )
          .join('\n')}`;

  return [
    `議題: 「${args.topic}」`,
    buildRoomContext(args.roomAtmosphere),
    ``,
    prior,
    ``,
    `あなたは現在ラウンド ${args.round + 1}/${args.totalRounds} の発言をします。`,
    `上記の指示に従い、発言内容のみを出力してください(前置きや「発言:」などのラベルは不要)。`,
  ].join('\n');
}

export async function generateLlmUtterance(
  args: LlmGenerateArgs,
): Promise<LlmGenerateResult | LlmGenerateError> {
  if (!args.apiKey.trim()) {
    return { ok: false, error: 'API キーが設定されていません' };
  }

  const system = buildSystemPrompt(args.personality, args.phase);
  const user = buildUserPrompt(args);

  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': args.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: args.model,
        max_tokens: 700,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      error?: { message?: string };
    };

    if (data.error) {
      return { ok: false, error: data.error.message ?? 'Unknown API error' };
    }

    const text = (data.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text!)
      .join('')
      .trim();

    if (!text) {
      return { ok: false, error: '空の応答' };
    }

    return { ok: true, content: text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `ネットワークエラー: ${msg}` };
  }
}

/**
 * Claude CLI 経由で発言を生成する。
 * Vite dev server の `/api/claude` ミドルウェアを通じて
 * `claude -p "..." --system-prompt "..."` を実行する。
 * API キー不要 — ローカルの Claude Code サブスクリプションを使用。
 */
export async function generateClaudeCliUtterance(
  args: PromptArgs,
): Promise<LlmGenerateResult | LlmGenerateError> {
  const systemPrompt = buildSystemPrompt(args.personality, args.phase);
  const userPrompt = buildUserPrompt(args);

  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: userPrompt, systemPrompt }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = (await res.json()) as { content?: string; error?: string };
    if (data.error) {
      return { ok: false, error: data.error };
    }
    if (!data.content?.trim()) {
      return { ok: false, error: '空の応答' };
    }
    return { ok: true, content: data.content.trim() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `ネットワークエラー: ${msg}` };
  }
}
