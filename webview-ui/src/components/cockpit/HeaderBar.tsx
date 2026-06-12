import type { DiscussionMode, DiscussionStage } from '../../simulation/discussionController';
import { Button } from '../ui/Button';

const STEPS: { key: DiscussionStage; label: string }[] = [
  { key: 'idle', label: '入力' },
  { key: 'discussing', label: '討議' },
  { key: 'concluding', label: '統合' },
  { key: 'reporting', label: 'レポート' },
  { key: 'done', label: '完了' },
];

function stageIndex(stage: DiscussionStage): number {
  const i = STEPS.findIndex((s) => s.key === stage);
  return i === -1 ? 0 : i;
}

interface HeaderBarProps {
  caseTitle: string;
  stage: DiscussionStage;
  mode: DiscussionMode;
  running: boolean;
  onModeChange: (mode: DiscussionMode) => void;
}

export function HeaderBar({ caseTitle, stage, mode, running, onModeChange }: HeaderBarProps) {
  const active = stageIndex(stage);

  return (
    <header className="flex items-center gap-16 px-20 py-10 bg-bg-dark border-b-2 border-border">
      <div className="flex items-baseline gap-8 shrink-0">
        <span className="text-2xl text-accent-bright font-pixel">戦略構築AI</span>
        <span className="text-3xl text-text font-pixel tracking-wide">SEIYA</span>
      </div>

      <div className="text-sm text-text-muted shrink-0 max-w-[220px] truncate" title={caseTitle}>
        {caseTitle ? `案件: ${caseTitle}` : '案件: 未設定'}
      </div>

      {/* Phase stepper */}
      <ol className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
        {STEPS.map((s, i) => {
          const isActive = i === active;
          const isDone = i < active;
          const color = isActive
            ? 'text-accent-bright'
            : isDone
              ? 'text-status-success'
              : 'text-text-muted';
          return (
            <li key={s.key} className="flex items-center gap-2 shrink-0">
              <span
                className={`w-14 h-14 flex items-center justify-center border-2 ${
                  isActive
                    ? 'border-accent-bright bg-active-bg'
                    : isDone
                      ? 'border-status-success'
                      : 'border-border'
                } ${color}`}
                style={{ fontSize: 14 }}
              >
                {isDone ? '✓' : i + 1}
              </span>
              <span className={`text-2xs ${color}`}>{s.label}</span>
              {i < STEPS.length - 1 && (
                <span className={`w-16 h-0.5 ${isDone ? 'bg-status-success' : 'bg-border'}`} />
              )}
            </li>
          );
        })}
      </ol>

      {/* Mode selector */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-2xs text-text-muted">LLM</span>
        {(['claude-cli', 'api', 'template'] as DiscussionMode[]).map((m) => (
          <Button
            key={m}
            size="sm"
            variant={mode === m ? 'active' : 'default'}
            disabled={running}
            onClick={() => onModeChange(m)}
            title={
              m === 'claude-cli'
                ? 'ローカル Claude CLI（APIキー不要）'
                : m === 'api'
                  ? 'Anthropic API（キー必要）'
                  : 'テンプレート（オフライン）'
            }
          >
            {m === 'claude-cli' ? 'CLI' : m === 'api' ? 'API' : 'テンプレ'}
          </Button>
        ))}
      </div>
    </header>
  );
}
