import { type ReactNode, useEffect, useRef } from 'react';

import type {
  DiscussionMessage,
  DiscussionState,
} from '../../simulation/discussionController';
import { personaById } from '../../strategy/personas';

// persona palette(0-5) → 一貫した配色（アバター背景・名前・本文の左バーに共通で使い、
// 「誰の発言か」を色で一目で追えるようにする）。オフィスのキャラ見た目と連動。
interface PaletteStyle {
  bg: string;
  text: string;
  border: string;
}

const PALETTE: PaletteStyle[] = [
  { bg: 'bg-accent-bright', text: 'text-accent-bright', border: 'border-accent-bright' },
  { bg: 'bg-status-active', text: 'text-status-active', border: 'border-status-active' },
  { bg: 'bg-status-success', text: 'text-status-success', border: 'border-status-success' },
  { bg: 'bg-warning', text: 'text-warning', border: 'border-warning' },
  { bg: 'bg-status-permission', text: 'text-status-permission', border: 'border-status-permission' },
  { bg: 'bg-danger', text: 'text-danger', border: 'border-danger' },
];

function paletteFor(personaId: string | undefined, isModerator: boolean): PaletteStyle {
  if (isModerator) return PALETTE[0];
  const p = personaId ? personaById(personaId) : undefined;
  return PALETTE[(p?.palette ?? 1) % PALETTE.length];
}

function Avatar({ char, colorClass }: { char: string; colorClass: string }) {
  return (
    <span
      className={`w-26 h-26 flex items-center justify-center text-bg-dark shrink-0 border-2 border-bg-dark ${colorClass}`}
      style={{ fontSize: 16 }}
      aria-hidden
    >
      {char}
    </span>
  );
}

/** ラウンドの切れ目を示す控えめなセパレータ。発言のグルーピングを助ける。 */
function RoundDivider({ round }: { round: number }) {
  return (
    <div className="flex items-center gap-6 pt-4" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      <span className="text-2xs text-text-muted tracking-wide">ROUND {round + 1}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

interface SystemVariant {
  icon: string;
  label: (round: number) => string;
  border: string;
  headerBg: string;
  headerText: string;
  emphasized: boolean;
}

// summary（中間整理）は控えめ、conclusion / report（討議の結論）は塗りヘッダー＋影で際立たせる。
const SYSTEM_VARIANTS: Record<'summary' | 'conclusion' | 'report', SystemVariant> = {
  summary: {
    icon: '📋',
    label: (r) => `ROUND ${r + 1} ・ 古賀の整理`,
    border: 'border-border',
    headerBg: 'bg-active-bg/40',
    headerText: 'text-text',
    emphasized: false,
  },
  conclusion: {
    icon: '🎯',
    label: () => '古賀CMO ・ 最終結論',
    border: 'border-accent-bright',
    headerBg: 'bg-accent-bright',
    headerText: 'text-bg-dark',
    emphasized: true,
  },
  report: {
    icon: '📊',
    label: () => '戦略レポート',
    border: 'border-status-permission',
    headerBg: 'bg-status-permission',
    headerText: 'text-bg-dark',
    emphasized: true,
  },
};

function SystemCard({ m }: { m: DiscussionMessage }) {
  const v =
    SYSTEM_VARIANTS[m.role as 'summary' | 'conclusion' | 'report'] ?? SYSTEM_VARIANTS.summary;
  return (
    <div
      className={`flex flex-col border-2 ${v.border} bg-bg-dark ${v.emphasized ? 'shadow-pixel' : ''}`}
    >
      <div className={`flex items-center gap-4 px-8 py-4 ${v.headerBg}`}>
        <span aria-hidden>{v.icon}</span>
        <span className={`text-2xs ${v.headerText}`}>{v.label(m.round)}</span>
      </div>
      <div className="text-xs leading-relaxed text-text whitespace-pre-wrap break-words p-12">
        {m.content}
      </div>
    </div>
  );
}

function SpeakerRow({ m }: { m: DiscussionMessage }) {
  const isModerator = m.agentId === 0;
  const pal = paletteFor(m.personality?.personaId, isModerator);
  const role = m.personality?.role ?? '';
  return (
    <div className="flex gap-8">
      <Avatar char={m.agentName.slice(0, 1)} colorClass={pal.bg} />
      <div className="flex flex-col gap-3 min-w-0 flex-1">
        <div className="flex items-baseline gap-6 flex-wrap">
          <span className={`text-sm ${pal.text}`}>{m.agentName}</span>
          {role && (
            <span className="text-2xs text-text-muted border border-border px-3 py-px">
              {role}
            </span>
          )}
          {m.source === 'api-fallback' && (
            <span className="text-2xs text-text-muted ml-auto">代替</span>
          )}
        </div>
        <div
          className={`text-xs leading-relaxed text-text whitespace-pre-wrap break-words border-l-2 ${pal.border} pl-8 py-1`}
        >
          {m.content}
        </div>
      </div>
    </div>
  );
}

interface WarRoomFeedProps {
  state: DiscussionState;
}

export function WarRoomFeed({ state }: WarRoomFeedProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const el = logRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [state.messages.length, state.thinkingAgentId]);

  const thinkingName =
    state.thinkingAgentId !== null
      ? (state.messages.find((m) => m.agentId === state.thinkingAgentId)?.agentName ??
        `#${state.thinkingAgentId}`)
      : null;

  // 発言は ROUND ごとにセパレータで区切る。要約・結論・レポートは区切りを挟まない。
  const items: ReactNode[] = [];
  let lastSpeakerRound = -1;
  for (const m of state.messages) {
    const isSystem =
      m.role === 'summary' || m.role === 'conclusion' || m.role === 'report';
    if (!isSystem && m.round !== lastSpeakerRound) {
      lastSpeakerRound = m.round;
      items.push(<RoundDivider key={`rd-${m.round}-${m.id}`} round={m.round} />);
    }
    items.push(
      isSystem ? <SystemCard key={m.id} m={m} /> : <SpeakerRow key={m.id} m={m} />,
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-bg-dark border-l-2 border-border">
      <div className="flex items-center gap-6 px-12 py-8 border-b-2 border-border shrink-0">
        <span className="text-sm text-text">War Room</span>
        <span className="text-2xs text-text-muted">戦略会議ライブ</span>
        {state.running && (
          <span className="ml-auto flex items-center gap-3 text-2xs text-status-active">
            <span className="w-6 h-6 rounded-full bg-status-active pixel-pulse inline-block" />
            {state.stage === 'concluding'
              ? '古賀が統合中…'
              : state.stage === 'reporting'
                ? 'レポート作成中…'
                : thinkingName
                  ? `${thinkingName} 考え中…`
                  : `R${state.currentRound + 1}/${state.totalRounds}`}
          </span>
        )}
      </div>

      <div
        ref={logRef}
        translate="no"
        className="notranslate flex flex-col gap-12 overflow-y-auto p-12 flex-1 min-h-0"
      >
        {state.messages.length === 0 && (
          <div className="text-2xs text-text-muted italic leading-relaxed">
            案件を入力し「会議を招集」すると、6名の専門家と古賀CMOの討議が始まります。
          </div>
        )}
        {items}
        {state.lastError && (
          <div className="text-2xs text-status-error">
            エラー: {state.lastError.slice(0, 160)}
          </div>
        )}
      </div>
    </div>
  );
}
