import { CONCLUSION_INSTRUCTION, REPORT_INSTRUCTION } from '../strategy/osPrompt';
import { MODERATOR } from '../strategy/personas';
import {
  parseStrategyReport,
  PLAN_RANK_LABEL,
  type StrategyReport,
} from '../strategy/reportSchema';
import {
  generateClaudeCliUtterance,
  generateLlmUtterance,
  getApiKey,
  getModel,
  type LlmModelId,
  type PriorMessage,
} from './llmClient';
import { generateUtterance, PCM_TYPES, type Personality } from './personalities';
import { simulationController } from './simulationController';

export type DiscussionMode = 'template' | 'api' | 'claude-cli';

export type MessageRole = 'speaker' | 'summary' | 'report' | 'conclusion';

/** 会議の進行ステージ（Cockpit のフェーズステッパーが購読する）。 */
export type DiscussionStage =
  | 'idle'
  | 'discussing'
  | 'concluding'
  | 'reporting'
  | 'done';

export interface DiscussionMessage {
  id: string;
  agentId: number;
  agentName: string;
  personality: Personality | null;
  content: string;
  round: number;
  phase: 'opening' | 'response' | 'closing' | 'summary' | 'report' | 'conclusion';
  timestamp: number;
  source: 'template' | 'api' | 'api-fallback';
  role: MessageRole;
}

export interface DiscussionState {
  topic: string;
  running: boolean;
  paused: boolean;
  currentRound: number;
  totalRounds: number;
  messages: DiscussionMessage[];
  mode: DiscussionMode;
  model: LlmModelId;
  thinkingAgentId: number | null;
  lastError: string | null;
  stage: DiscussionStage; // 進行ステージ
  report: StrategyReport | null; // 古賀CMOの最終構造化レポート（パース成功時のみ）
}

function dispatch(data: unknown): void {
  window.dispatchEvent(new MessageEvent('message', { data }));
}

function initialState(): DiscussionState {
  return {
    topic: '',
    running: false,
    paused: false,
    currentRound: 0,
    totalRounds: 2,
    messages: [],
    mode: 'claude-cli',
    model: getModel(),
    thinkingAgentId: null,
    lastError: null,
    stage: 'idle',
    report: null,
  };
}

class DiscussionController {
  private state: DiscussionState = initialState();

  private listeners = new Set<(s: DiscussionState) => void>();
  private stepTimer: ReturnType<typeof setTimeout> | null = null;
  private nextMessageSeq = 1;
  private utteranceToolIds = new Map<number, string>();
  private inflightStep = false;

  getState(): DiscussionState {
    return {
      ...this.state,
      messages: this.state.messages.slice(),
    };
  }

  subscribe(fn: (s: DiscussionState) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  setMode(mode: DiscussionMode): void {
    if (this.state.mode === mode) return;
    this.state.mode = mode;
    this.state.lastError = null;
    this.notify();
  }

  setModel(model: LlmModelId): void {
    if (this.state.model === model) return;
    this.state.model = model;
    this.notify();
  }

  clearError(): void {
    if (this.state.lastError !== null) {
      this.state.lastError = null;
      this.notify();
    }
  }

  start(topic: string, totalRounds: number): void {
    const cleanTopic = topic.trim();
    if (!cleanTopic) return;

    const agentIds = simulationController.getState().agentIds;
    if (agentIds.length < 2) {
      console.warn('[Discussion] 議論には 2 体以上のエージェントが必要です');
      return;
    }

    this.cancelScheduled();
    this.state = {
      ...initialState(),
      topic: cleanTopic,
      running: true,
      paused: false,
      totalRounds: Math.max(1, Math.min(5, totalRounds)),
      mode: this.state.mode,
      model: this.state.model,
      stage: 'discussing',
    };
    this.notify();

    // 最初の発話を少し遅延してスタート
    this.scheduleNext(500);
  }

  pause(): void {
    if (!this.state.running || this.state.paused) return;
    this.state.paused = true;
    this.cancelScheduled();
    this.notify();
  }

  resume(): void {
    if (!this.state.running || !this.state.paused) return;
    this.state.paused = false;
    this.notify();
    this.scheduleNext(300);
  }

  stop(): void {
    this.cancelScheduled();
    this.state.running = false;
    this.state.paused = false;
    this.state.thinkingAgentId = null;
    this.finishAllUtteranceTools();
    this.notify();
  }

  reset(): void {
    this.stop();
    const mode = this.state.mode;
    const model = this.state.model;
    this.state = { ...initialState(), mode, model };
    this.notify();
  }

  setTotalRounds(n: number): void {
    this.state.totalRounds = Math.max(1, Math.min(5, n));
    this.notify();
  }

  private scheduleNext(delayMs: number): void {
    this.cancelScheduled();
    this.stepTimer = setTimeout(() => {
      void this.step();
    }, delayMs);
  }

  private cancelScheduled(): void {
    if (this.stepTimer) {
      clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }
  }

  private async step(): Promise<void> {
    if (!this.state.running || this.state.paused) return;
    if (this.inflightStep) return;
    this.inflightStep = true;

    try {
      const agentIds = simulationController.getState().agentIds;
      if (agentIds.length === 0) {
        this.stop();
        return;
      }

      // 現ラウンドで既に発言した人数
      const spokenInCurrentRound = this.state.messages.filter(
        (m) => m.round === this.state.currentRound && m.role === 'speaker',
      ).length;

      // 要約が既にこのラウンドに存在するか
      const hasSummaryThisRound = this.state.messages.some(
        (m) => m.round === this.state.currentRound && m.role === 'summary',
      );

      if (spokenInCurrentRound >= agentIds.length && !hasSummaryThisRound) {
        // ラウンド全員発言済み → 要約を生成
        await this.generateRoundSummary();

        const nextRound = this.state.currentRound + 1;
        if (nextRound >= this.state.totalRounds) {
          // 最終ラウンド終了 → 古賀CMOの結論 → 構造化レポート
          this.state.stage = 'concluding';
          this.notify();
          await this.generateConclusion();

          this.state.stage = 'reporting';
          this.notify();
          await this.generateReport();

          this.state.running = false;
          this.state.stage = 'done';
          this.state.thinkingAgentId = null;
          this.finishAllUtteranceTools();
          this.notify();
          return;
        }
        this.state.currentRound = nextRound;
        this.notify();
        this.scheduleNext(1500);
        return;
      }

      // 要約が済んでいるのにまだこのラウンドにいる場合はスキップ
      if (spokenInCurrentRound >= agentIds.length) {
        this.scheduleNext(500);
        return;
      }

      const speakerId = agentIds[spokenInCurrentRound];
      if (speakerId === undefined) {
        this.scheduleNext(500);
        return;
      }

      const personality = simulationController.getPersonality(speakerId);
      if (!personality) {
        this.scheduleNext(500);
        return;
      }

      // フェーズ判定: 最初のラウンドは opening、最後のラウンドは closing、それ以外 response
      const phase: 'opening' | 'response' | 'closing' =
        this.state.currentRound === 0
          ? 'opening'
          : this.state.currentRound === this.state.totalRounds - 1
            ? 'closing'
            : 'response';

      // 発言生成: モードに応じて Claude CLI / API / テンプレート
      let content = '';
      let source: DiscussionMessage['source'] = 'template';

      const useAi = this.state.mode === 'api' || this.state.mode === 'claude-cli';

      if (useAi) {
        // 議論中に thinking 状態を提示
        this.state.thinkingAgentId = speakerId;
        this.notify();
        // タイピング演出 (発言準備中)
        this.startThinkingAnimation(speakerId);

        const prior: PriorMessage[] = this.state.messages
          .filter((m) => m.role === 'speaker')
          .map((m) => ({
            speakerName: m.agentName,
            speakerPersonalityLabel: m.personality ? personalityBadge(m.personality) : '',
            content: m.content,
            round: m.round,
          }));

        const room = simulationController.getRoom();
        const promptArgs = {
          personality,
          topic: this.state.topic,
          phase,
          round: this.state.currentRound,
          totalRounds: this.state.totalRounds,
          priorMessages: prior,
          roomAtmosphere: room.atmosphere,
        };

        const result =
          this.state.mode === 'claude-cli'
            ? await generateClaudeCliUtterance(promptArgs)
            : await generateLlmUtterance({
                ...promptArgs,
                apiKey: getApiKey(),
                model: this.state.model,
              });

        // step が中断されていた場合は捨てる
        if (!this.state.running || this.state.paused) {
          this.state.thinkingAgentId = null;
          this.finishThinkingAnimation(speakerId);
          this.notify();
          return;
        }

        if (result.ok) {
          content = result.content;
          source = 'api';
          this.state.lastError = null;
        } else {
          // 失敗時はテンプレートにフォールバック
          console.warn('[Discussion] AI 失敗、テンプレートで代替:', result.error);
          content = generateUtterance(personality, this.state.topic, phase);
          source = 'api-fallback';
          this.state.lastError = result.error;
        }

        this.state.thinkingAgentId = null;
        this.finishThinkingAnimation(speakerId);
      } else {
        content = generateUtterance(personality, this.state.topic, phase);
        source = 'template';
      }

      const message: DiscussionMessage = {
        id: `m-${this.nextMessageSeq++}`,
        agentId: speakerId,
        agentName: personality.nameJa,
        personality,
        content,
        round: this.state.currentRound,
        phase,
        timestamp: Date.now(),
        source,
        role: 'speaker',
      };

      this.state.messages.push(message);

      // キャラクターにタイピング動作を発火 (既存の agentToolStart を流用)
      this.finishUtteranceTool(speakerId);
      const toolId = `discuss-${speakerId}-${this.nextMessageSeq}`;
      this.utteranceToolIds.set(speakerId, toolId);
      dispatch({
        type: 'agentToolStart',
        id: speakerId,
        toolId,
        status: `発言中: ${content.slice(0, 16)}…`,
        toolName: 'Edit',
      });
      dispatch({ type: 'agentSelected', id: speakerId });

      this.notify();

      // 発言の長さに応じた間隔で次へ (日本語 12〜18 文字/秒と仮定)
      const speakMs = Math.max(1800, Math.min(5000, content.length * 60));
      this.scheduleNext(speakMs);
    } finally {
      this.inflightStep = false;
    }
  }

  /** ラウンド終了後の要約を生成 */
  private async generateRoundSummary(): Promise<void> {
    const roundMessages = this.state.messages.filter(
      (m) => m.round === this.state.currentRound && m.role === 'speaker',
    );
    if (roundMessages.length === 0) return;

    const prompt = this.buildRoundSummaryPrompt(roundMessages);
    const content = await this.callAiForSystem(prompt);

    this.state.messages.push({
      id: `m-${this.nextMessageSeq++}`,
      agentId: 0,
      agentName: MODERATOR.name,
      personality: null,
      content,
      round: this.state.currentRound,
      phase: 'summary',
      timestamp: Date.now(),
      source: this.state.mode === 'template' ? 'template' : 'api',
      role: 'summary',
    });
    this.notify();
  }

  /** 古賀CMOの最終結論（プローズ）。次工程のレポート化の土台になる。 */
  private async generateConclusion(): Promise<void> {
    const allSpeaker = this.state.messages.filter((m) => m.role === 'speaker');
    if (allSpeaker.length === 0) return;

    const conclusion = await this.callAiForSystem(this.buildConclusionPrompt());
    this.state.messages.push(this.systemMessage(conclusion, 'conclusion'));
    this.notify();
  }

  /**
   * 古賀CMOの構造化レポート（StrategyReport JSON）。
   * パース失敗時は1回だけ「JSONのみ」で再出力させ、それでも失敗ならプローズのまま縮退表示する。
   */
  private async generateReport(): Promise<void> {
    if (this.state.mode === 'template') {
      this.state.messages.push(
        this.systemMessage('(テンプレートモードのためレポートは生成されません)', 'report'),
      );
      this.notify();
      return;
    }

    const prompt = this.buildReportPrompt();
    let raw = await this.callAiForSystem(prompt);
    let report = parseStrategyReport(raw);

    if (!report) {
      // 1回だけ「JSONのみで再出力」を促す
      raw = await this.callAiForSystem(
        `${prompt}\n\n# 重要\n前回の出力は JSON として解釈できませんでした。説明文・前置き・後書きを一切付けず、スキーマに従う JSON オブジェクトだけを出力し直してください。`,
      );
      report = parseStrategyReport(raw);
    }

    this.state.report = report;
    this.state.messages.push(
      this.systemMessage(report ? this.reportToFeedText(report) : raw, 'report'),
    );
    this.notify();
  }

  /** 古賀(議長ロール)のシステムメッセージを作る。 */
  private systemMessage(
    content: string,
    role: 'summary' | 'conclusion' | 'report',
  ): DiscussionMessage {
    return {
      id: `m-${this.nextMessageSeq++}`,
      agentId: 0,
      agentName: MODERATOR.name,
      personality: null,
      content,
      round: this.state.currentRound,
      phase: role,
      timestamp: Date.now(),
      source: this.state.mode === 'template' ? 'template' : 'api',
      role,
    };
  }

  /** レポートをフィード表示用の短いテキストに（構造化表示は右パネル）。 */
  private reportToFeedText(r: StrategyReport): string {
    const rec = r.plans.find((p) => p.rank === r.recommended);
    return [
      `📊 ${r.title}`,
      r.execSummary.length > 0 ? `要約: ${r.execSummary.join(' / ')}` : '',
      rec ? `推奨: ${PLAN_RANK_LABEL[rec.rank]}案「${rec.name}」` : '',
      '（構造化レポートを右パネルに表示しました）',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private transcriptOf(msgs: DiscussionMessage[]): string {
    return msgs
      .map((m) => {
        const tag =
          m.role === 'summary' ? '要約' : m.role === 'conclusion' ? '結論' : '専門家';
        return `${m.agentName}（${tag}）: 「${m.content}」`;
      })
      .join('\n');
  }

  /** ラウンド要約プロンプト（古賀視点＋反証ゲート）。 */
  private buildRoundSummaryPrompt(roundMsgs: DiscussionMessage[]): string {
    return [
      `あなた（古賀CMO）として、ラウンド ${this.state.currentRound + 1} の専門家発言を整理してください。`,
      ``,
      `# 案件`,
      this.state.topic,
      ``,
      `# 今ラウンドの発言`,
      this.transcriptOf(roundMsgs),
      ``,
      `以下を簡潔に（合計250文字以内）:`,
      `1. このラウンドの論点を2〜3行で`,
      `2. 各専門家のスタンスと、白地/律速（どの因子が成長を縛るか）の観点`,
      `3. 最も重い反証を1つと、その扱い（受容/棄却/要検証）`,
    ].join('\n');
  }

  /** 最終結論プロンプト（全専門家発言＋ラウンド要約を統合）。 */
  private buildConclusionPrompt(): string {
    const speakers = this.state.messages.filter((m) => m.role === 'speaker');
    const summaries = this.state.messages.filter((m) => m.role === 'summary');
    return [
      CONCLUSION_INSTRUCTION,
      ``,
      `# 案件`,
      this.state.topic,
      ``,
      `# 専門家の討議`,
      this.transcriptOf(speakers),
      ``,
      `# ラウンド要約`,
      this.transcriptOf(summaries),
    ].join('\n');
  }

  /** レポート生成プロンプト（ブリーフ＋ラウンド要約＋結論のみ。全文トランスクリプトは渡さない）。 */
  private buildReportPrompt(): string {
    const summaries = this.state.messages.filter((m) => m.role === 'summary');
    const conclusion = this.state.messages.filter((m) => m.role === 'conclusion');
    return [
      REPORT_INSTRUCTION,
      ``,
      `# 案件`,
      this.state.topic,
      ``,
      `# ラウンド要約`,
      this.transcriptOf(summaries),
      ``,
      `# 最終結論`,
      this.transcriptOf(conclusion),
    ].join('\n');
  }

  /**
   * 古賀CMO（モデレーター）としての AI 呼び出し。
   * 要約・結論・レポートで共通使用。system prompt は v4 OS を内蔵した古賀の人格。
   */
  private async callAiForSystem(prompt: string): Promise<string> {
    if (this.state.mode === 'template') {
      return '(テンプレート) 各専門家の意見が出揃いました。詳細はログを参照してください。';
    }

    const systemPrompt = MODERATOR.systemPrompt;

    if (this.state.mode === 'claude-cli') {
      try {
        const res = await fetch('/api/claude', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt, systemPrompt }),
        });
        if (!res.ok) return '(生成失敗) 各専門家の意見が出揃いました。';
        const data = (await res.json()) as { content?: string };
        return data.content?.trim() || '(空の応答)';
      } catch {
        return '(生成失敗) 各専門家の意見が出揃いました。';
      }
    }

    // API mode
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': getApiKey(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: this.state.model,
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) return '(生成失敗) 各専門家の意見が出揃いました。';
      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = (data.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('')
        .trim();
      return text || '(空の応答)';
    } catch {
      return '(生成失敗) 各専門家の意見が出揃いました。';
    }
  }

  private startThinkingAnimation(agentId: number): void {
    this.finishUtteranceTool(agentId);
    const toolId = `think-${agentId}-${this.nextMessageSeq}`;
    this.utteranceToolIds.set(agentId, toolId);
    dispatch({
      type: 'agentToolStart',
      id: agentId,
      toolId,
      status: '考え中…',
      toolName: 'Read',
    });
    dispatch({ type: 'agentSelected', id: agentId });
  }

  private finishThinkingAnimation(agentId: number): void {
    this.finishUtteranceTool(agentId);
  }

  private finishUtteranceTool(agentId: number): void {
    const prev = this.utteranceToolIds.get(agentId);
    if (prev) {
      dispatch({ type: 'agentToolDone', id: agentId, toolId: prev });
      this.utteranceToolIds.delete(agentId);
    }
  }

  private finishAllUtteranceTools(): void {
    for (const [agentId, toolId] of this.utteranceToolIds) {
      dispatch({ type: 'agentToolDone', id: agentId, toolId });
    }
    this.utteranceToolIds.clear();
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const fn of this.listeners) {
      fn(snapshot);
    }
  }
}

export const discussionController = new DiscussionController();

export function personalityBadge(personality: Personality): string {
  const base = PCM_TYPES[personality.base].shortJa;
  const phase = PCM_TYPES[personality.phase].shortJa;
  const tertiary = PCM_TYPES[personality.tertiary].shortJa;
  return `${base} / ${phase} / ${tertiary}`;
}
