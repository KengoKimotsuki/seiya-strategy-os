import { useState } from 'react';

import type { DiscussionMode } from '../../simulation/discussionController';
import { getApiKey, setApiKey as saveApiKey } from '../../simulation/llmClient';
import {
  type CaseBrief,
  caseTitle,
  isCaseBriefReady,
} from '../../strategy/caseInput';
import { Button } from '../ui/Button';

const ROUND_OPTIONS = [1, 2, 3, 4, 5];

interface FieldProps {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  onChange: (v: string) => void;
}

function Field({ label, value, placeholder, multiline, required, onChange }: FieldProps) {
  const cls =
    'bg-btn-bg border-2 border-transparent rounded-none px-8 py-4 text-sm text-text focus:border-accent outline-none w-full';
  return (
    <label className="flex flex-col gap-2">
      <span className="text-2xs text-text-muted">
        {label}
        {required && <span className="text-status-permission"> *</span>}
      </span>
      {multiline ? (
        <textarea
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={`${cls} resize-none`}
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      )}
    </label>
  );
}

interface BriefPanelProps {
  brief: CaseBrief;
  onBriefChange: (b: CaseBrief) => void;
  rounds: number;
  onRoundsChange: (n: number) => void;
  running: boolean;
  started: boolean;
  mode: DiscussionMode;
  onConvene: () => void;
  onReset: () => void;
}

export function BriefPanel({
  brief,
  onBriefChange,
  rounds,
  onRoundsChange,
  running,
  started,
  mode,
  onConvene,
  onReset,
}: BriefPanelProps) {
  const [apiKeyInput, setApiKeyInput] = useState<string>(getApiKey());
  const [savedKey, setSavedKey] = useState<boolean>(getApiKey().trim().length > 0);

  const set = (patch: Partial<CaseBrief>) => onBriefChange({ ...brief, ...patch });

  const needsKey = mode === 'api' && !savedKey;
  const ready = isCaseBriefReady(brief) && !needsKey;

  // 開始後は折りたたみ表示
  if (started) {
    return (
      <div className="flex flex-col gap-10 p-16 h-full overflow-y-auto">
        <div className="text-sm text-accent-bright">議題</div>
        <div className="pixel-panel p-12 flex flex-col gap-6">
          <div className="text-base text-text">{caseTitle(brief)}</div>
          {brief.challenge && (
            <div className="text-2xs text-text-muted whitespace-pre-wrap break-words">
              {brief.challenge}
            </div>
          )}
        </div>
        <Button size="sm" variant="default" onClick={onReset} disabled={running}>
          ＋ 新しい案件
        </Button>
        {running && (
          <div className="text-2xs text-text-muted">
            会議が進行中です。完了までお待ちください。
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 p-16 h-full overflow-y-auto">
      <div className="text-sm text-accent-bright">案件ブリーフ</div>

      <Field
        label="案件名"
        required
        value={brief.title}
        placeholder="例: 新ブランドの立ち上げ戦略"
        onChange={(v) => set({ title: v })}
      />
      <Field
        label="会社 / 事業主体"
        value={brief.company}
        placeholder="例: 株式会社〇〇"
        onChange={(v) => set({ company: v })}
      />
      <Field
        label="事業内容"
        value={brief.business}
        placeholder="例: D2Cの発酵ドリンク"
        onChange={(v) => set({ business: v })}
      />
      <Field
        label="解決したい事業課題"
        required
        multiline
        value={brief.challenge}
        placeholder="例: 認知はあるが購入転換が伸びない。半年で売上を1.5倍にしたい。"
        onChange={(v) => set({ challenge: v })}
      />
      <Field
        label="ターゲット顧客"
        value={brief.target}
        placeholder="例: 30代都市部の健康意識層"
        onChange={(v) => set({ target: v })}
      />
      <Field
        label="現状（数値・競合・KPI）"
        multiline
        value={brief.current}
        placeholder="例: 月商800万、CVR1.2%、競合A/Bが先行"
        onChange={(v) => set({ current: v })}
      />
      <Field
        label="制約（予算・期限・既存KPI）"
        multiline
        value={brief.constraints}
        placeholder="例: 予算上限 月200万、6ヶ月、人員2名"
        onChange={(v) => set({ constraints: v })}
      />

      {mode === 'api' && (
        <div className="flex flex-col gap-2 pixel-panel p-10">
          <span className="text-2xs text-text-muted">Anthropic API キー</span>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="sk-ant-api..."
              className="flex-1 bg-btn-bg border-2 border-transparent rounded-none px-6 py-2 text-2xs text-text focus:border-accent outline-none"
            />
            <Button
              size="sm"
              variant="accent"
              onClick={() => {
                saveApiKey(apiKeyInput.trim());
                setSavedKey(apiKeyInput.trim().length > 0);
              }}
            >
              保存
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-6 flex-wrap">
        <span className="text-2xs text-text-muted">討議ラウンド</span>
        <div className="flex gap-2">
          {ROUND_OPTIONS.map((n) => (
            <Button
              key={n}
              size="sm"
              variant={rounds === n ? 'active' : 'default'}
              onClick={() => onRoundsChange(n)}
            >
              {n}
            </Button>
          ))}
        </div>
      </div>

      <Button
        size="md"
        variant={ready ? 'accent' : 'disabled'}
        onClick={() => (ready ? onConvene() : undefined)}
      >
        会議を招集
      </Button>

      {!isCaseBriefReady(brief) && (
        <div className="text-2xs text-text-muted">※ 案件名と事業課題は必須です</div>
      )}
      {needsKey && (
        <div className="text-2xs text-status-permission">
          ※ API モードには Anthropic API キーが必要です
        </div>
      )}
    </div>
  );
}
