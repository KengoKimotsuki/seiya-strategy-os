import { useEffect, useRef, useState } from 'react';

import {
  discussionController,
  type DiscussionMode,
  type DiscussionState,
  personalityBadge,
} from '../simulation/discussionController';
import {
  getApiKey,
  LLM_MODELS,
  type LlmModelId,
  setApiKey as saveApiKey,
  setModel as saveModel,
} from '../simulation/llmClient';
import { simulationController } from '../simulation/simulationController';
import { Button } from './ui/Button';
import { DraggablePanel } from './ui/DraggablePanel';

const ROUND_OPTIONS = [1, 2, 3, 4, 5];

export function DiscussionPanel() {
  const [state, setState] = useState<DiscussionState>(discussionController.getState());
  const [topic, setTopic] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>(getApiKey());
  const [showApiKey, setShowApiKey] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return discussionController.subscribe(setState);
  }, []);

  useEffect(() => {
    // React の DOM 反映直後に scrollTop を変更すると、ブラウザ翻訳エンジンや HMR との
    // 競合で insertBefore/removeChild が失敗する。requestAnimationFrame でブラウザの
    // 次の描画サイクルまで遅延させて安定化させる。
    const id = requestAnimationFrame(() => {
      const el = logRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [state.messages.length]);

  const agentCount = simulationController.getState().agentIds.length;
  const hasApiKey = getApiKey().trim().length > 0;
  const canStart =
    !state.running &&
    topic.trim().length > 0 &&
    agentCount >= 2 &&
    (state.mode === 'template' || state.mode === 'claude-cli' || hasApiKey);
  const phaseLabel =
    state.currentRound === 0
      ? '冒頭'
      : state.currentRound === state.totalRounds - 1
        ? '総括'
        : '反論/展開';

  const handleSaveApiKey = () => {
    saveApiKey(apiKeyInput.trim());
    discussionController.clearError();
    setState(discussionController.getState());
  };

  const handleModeChange = (mode: DiscussionMode) => {
    discussionController.setMode(mode);
  };

  const handleModelChange = (model: LlmModelId) => {
    saveModel(model);
    discussionController.setModel(model);
  };

  return (
    <DraggablePanel
      title="議論シミュレータ"
      defaultX={window.innerWidth - 420}
      defaultY={window.innerHeight - 450}
      defaultWidth={380}
      defaultHeight={420}
      minWidth={280}
      maxWidth={550}
      minHeight={120}
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((v) => !v)}
    >
      {/* ⚙ config toggle */}
      <div className="flex justify-end -mt-1 -mb-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setConfigOpen((v) => !v)}
          className="leading-none"
          title="API / モデル設定"
        >
          ⚙
        </Button>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-text-muted text-xs">モード</span>
        <Button
          size="sm"
          variant={state.mode === 'claude-cli' ? 'active' : 'default'}
          onClick={() => handleModeChange('claude-cli')}
          disabled={state.running}
          title="ローカルの Claude Code CLI を使用 (API キー不要)"
        >
          Claude Code
        </Button>
        <Button
          size="sm"
          variant={state.mode === 'api' ? 'active' : 'default'}
          onClick={() => handleModeChange('api')}
          disabled={state.running}
          title="Claude API 直接呼出 (API キー必要)"
        >
          API
        </Button>
        <Button
          size="sm"
          variant={state.mode === 'template' ? 'active' : 'default'}
          onClick={() => handleModeChange('template')}
          disabled={state.running}
          title="オフラインのテンプレート応答"
        >
          テンプレ
        </Button>
        {state.mode === 'api' && !hasApiKey && (
          <span className="text-2xs text-status-permission">キー未設定</span>
        )}
      </div>

      {/* Config (collapsible) */}
      {configOpen && (
        <div className="flex flex-col gap-2 py-2 px-3 border-2 border-white/10 bg-btn-bg/40">
          <div className="text-xs text-text-muted">API / モデル設定</div>
          <div className="flex flex-col gap-1">
            <label className="text-2xs text-text-muted">Anthropic API キー</label>
            <div className="flex gap-1">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-ant-api..."
                className="flex-1 bg-btn-bg border-2 border-transparent rounded-none px-4 py-1 text-2xs text-text focus:border-accent outline-none"
              />
              <Button size="sm" onClick={() => setShowApiKey((v) => !v)}>
                {showApiKey ? '隠' : '表'}
              </Button>
              <Button size="sm" variant="accent" onClick={handleSaveApiKey}>
                保存
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-2xs text-text-muted">モデル</label>
            <div className="flex gap-1 flex-wrap">
              {LLM_MODELS.map((m) => (
                <Button
                  key={m.id}
                  size="sm"
                  variant={state.model === m.id ? 'active' : 'default'}
                  onClick={() => handleModelChange(m.id)}
                  title={m.description}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Topic input */}
      <div className="flex flex-col gap-2">
        <label className="text-text-muted text-xs">議論テーマ</label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={state.running}
          placeholder="例: リモートワーク vs 出社勤務"
          className="bg-btn-bg border-2 border-transparent rounded-none px-6 py-2 text-sm text-text focus:border-accent outline-none"
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>

      {/* Round selector */}
      <div className="flex items-center gap-2">
        <span className="text-text-muted text-xs">ラウンド数</span>
        <div className="flex gap-1">
          {ROUND_OPTIONS.map((n) => (
            <Button
              key={n}
              size="sm"
              variant={state.totalRounds === n ? 'active' : 'default'}
              onClick={() => discussionController.setTotalRounds(n)}
              disabled={state.running}
            >
              {n}
            </Button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        {!state.running && (
          <Button
            size="sm"
            variant={canStart ? 'accent' : 'disabled'}
            onClick={() =>
              canStart ? discussionController.start(topic, state.totalRounds) : undefined
            }
          >
            議論開始
          </Button>
        )}
        {state.running && !state.paused && (
          <Button size="sm" onClick={() => discussionController.pause()}>
            一時停止
          </Button>
        )}
        {state.running && state.paused && (
          <Button size="sm" variant="accent" onClick={() => discussionController.resume()}>
            再開
          </Button>
        )}
        {state.running && (
          <Button size="sm" onClick={() => discussionController.stop()}>
            停止
          </Button>
        )}
        {!state.running && state.messages.length > 0 && (
          <Button size="sm" onClick={() => discussionController.reset()}>
            ログクリア
          </Button>
        )}
      </div>

      {/* Warnings */}
      {agentCount < 2 && !state.running && (
        <div className="text-xs text-status-permission">
          ※ 議論には 2 体以上のエージェントが必要です
        </div>
      )}
      {state.mode === 'api' && !hasApiKey && !state.running && (
        <div className="text-xs text-status-permission">
          ※ API キーを設定してください (⚙ アイコンから)
        </div>
      )}
      {state.lastError && (
        <div className="text-xs text-status-error">
          API エラー: {state.lastError.slice(0, 200)}
        </div>
      )}

      {/* Status line */}
      {state.running && (
        <div className="text-xs text-text-muted flex items-center gap-2">
          <span className="w-6 h-6 rounded-full inline-block bg-status-active pixel-pulse" />
          <span>
            R{state.currentRound + 1}/{state.totalRounds}({phaseLabel}
            {state.paused ? ' / 停止中' : ''}
            {state.thinkingAgentId !== null ? ` / #${state.thinkingAgentId} 考え中…` : ''})
          </span>
        </div>
      )}

      {/* Message log
          translate="no" + notranslate クラス: ブラウザの自動翻訳機能(Google翻訳等)が
          DOM を直接書き換えると React の再 reconcile で removeChild エラーが発生するため、
          動的に更新されるエリアでは翻訳を抑止する。 */}
      <div
        ref={logRef}
        translate="no"
        className="notranslate flex flex-col gap-3 overflow-y-auto pt-2 border-t border-white/10 pr-1 flex-1 min-h-0"
      >
        {state.messages.length === 0 && (
          <div className="text-xs text-text-muted italic">
            テーマを入力して議論を開始してください。
          </div>
        )}
        {state.messages.map((m, idx) => {
          // すべてのフィールドを安全に取り出し、壊れたデータでクラッシュさせない
          const safeId = m?.id ?? `msg-${idx}`;
          const safeContent = typeof m?.content === 'string' ? m.content : String(m?.content ?? '');
          const safeRound = typeof m?.round === 'number' && Number.isFinite(m.round) ? m.round : 0;
          const safeAgentName = typeof m?.agentName === 'string' ? m.agentName : '不明';
          const safeAgentId = typeof m?.agentId === 'number' ? m.agentId : 0;

          try {
            if (m?.role === 'summary' || m?.role === 'conclusion' || m?.role === 'report') {
              const label =
                m.role === 'summary'
                  ? `📋 R${safeRound + 1} 要約`
                  : m.role === 'conclusion'
                    ? '📝 最終結論'
                    : '📊 レポート';
              const borderColor =
                m.role === 'report'
                  ? 'border-status-permission'
                  : m.role === 'conclusion'
                    ? 'border-status-active'
                    : 'border-white/20';
              return (
                <div
                  key={safeId}
                  className={`flex flex-col gap-1 py-2 px-3 border-2 ${borderColor} bg-btn-bg/60`}
                >
                  <div className="text-xs text-accent-bright">
                    <span>{label}</span>
                  </div>
                  <div className="text-xs leading-relaxed text-text whitespace-pre-wrap break-words">
                    <span>{safeContent}</span>
                  </div>
                </div>
              );
            }

            // 性格バッジは取れたら表示、エラーは握りつぶす
            let badge = '';
            if (m?.personality) {
              try {
                badge = personalityBadge(m.personality);
              } catch {
                badge = '';
              }
            }

            const sourceLabel =
              m?.source === 'api' ? ' · AI' : m?.source === 'api-fallback' ? ' · 代替' : '';
            const metaLabel = badge ? `#${safeAgentId} | ${badge}` : `#${safeAgentId}`;
            const roundLabel = `R${safeRound + 1}${sourceLabel}`;

            return (
              <div key={safeId} className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-accent-bright">
                    <span>{safeAgentName}</span>
                  </span>
                  <span className="text-2xs text-text-muted">
                    <span>{metaLabel}</span>
                  </span>
                  <span className="text-2xs text-text-muted ml-auto">
                    <span>{roundLabel}</span>
                  </span>
                </div>
                <div className="text-xs leading-relaxed text-text pl-2 border-l-2 border-accent/30 whitespace-pre-wrap break-words">
                  <span>{safeContent}</span>
                </div>
              </div>
            );
          } catch (err) {
            console.error('[DiscussionPanel] render error for message', safeId, err);
            return (
              <div
                key={safeId}
                className="text-xs text-status-permission italic py-1 px-2 border-2 border-status-permission/30"
              >
                ⚠ メッセージ表示エラー (#{safeId})
              </div>
            );
          }
        })}
      </div>
    </DraggablePanel>
  );
}
