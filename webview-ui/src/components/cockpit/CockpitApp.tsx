import { useEffect, useState } from 'react';

import {
  discussionController,
  type DiscussionMode,
  type DiscussionState,
} from '../../simulation/discussionController';
import { simulationController } from '../../simulation/simulationController';
import {
  briefToContext,
  type CaseBrief,
  caseTitle,
  emptyCaseBrief,
  isCaseBriefReady,
} from '../../strategy/caseInput';
import { MODERATOR, SPECIALISTS } from '../../strategy/personas';
import {
  downloadReportJson,
  downloadReportMarkdown,
  type ReportMeta,
  todayStamp,
  type TranscriptLine,
} from '../../strategy/reportExport';
import type { StrategyReport } from '../../strategy/reportSchema';
import { BriefPanel } from './BriefPanel';
import { HeaderBar } from './HeaderBar';
import { ReportView } from './ReportView';
import { WarRoomFeed } from './WarRoomFeed';

// ── 最小セッション保存（localStorage） ─────────────────────────────
const SESSIONS_KEY = 'seiya-sessions';

interface SavedSession {
  title: string;
  date: string; // YYYY-MM-DD
  brief: CaseBrief;
  report: StrategyReport;
}

function loadSessions(): SavedSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedSession[]) : [];
  } catch {
    return [];
  }
}

function saveSession(session: SavedSession): void {
  try {
    const list = [session, ...loadSessions()].slice(0, 20);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(list));
  } catch {
    // quota / privacy errors は無視
  }
}

export function CockpitApp() {
  const [brief, setBrief] = useState<CaseBrief>(emptyCaseBrief());
  const [rounds, setRounds] = useState(2);
  const [state, setState] = useState<DiscussionState>(discussionController.getState());
  const [restored, setRestored] = useState<{ brief: CaseBrief; report: StrategyReport } | null>(
    null,
  );
  const [lastSession, setLastSession] = useState<SavedSession | null>(null);

  useEffect(() => discussionController.subscribe(setState), []);

  useEffect(() => {
    const sessions = loadSessions();
    setLastSession(sessions[0] ?? null);
  }, []);

  // 完了時にセッション保存
  useEffect(() => {
    if (state.stage === 'done' && state.report) {
      saveSession({
        title: caseTitle(brief),
        date: todayStamp(),
        brief,
        report: state.report,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage]);

  const started = state.stage !== 'idle';
  const liveReport = state.report ?? (started ? null : (restored?.report ?? null));

  const handleConvene = () => {
    if (!isCaseBriefReady(brief)) return;
    setRestored(null);
    simulationController.spawnCouncil(SPECIALISTS);
    discussionController.start(briefToContext(brief), rounds);
  };

  const handleReset = () => {
    discussionController.reset();
    simulationController.removeAllAgents();
    setBrief(emptyCaseBrief());
    setRestored(null);
  };

  const handleRestore = () => {
    if (!lastSession) return;
    discussionController.reset();
    simulationController.removeAllAgents();
    setBrief(lastSession.brief);
    setRestored({ brief: lastSession.brief, report: lastSession.report });
  };

  const buildMeta = (): ReportMeta => ({
    title: caseTitle(brief),
    date: todayStamp(),
    model: state.model,
    personaNames: [MODERATOR.name, ...SPECIALISTS.map((s) => s.name)],
  });

  const buildTranscript = (): TranscriptLine[] =>
    state.messages
      .filter((m) => m.role === 'speaker' || m.role === 'summary' || m.role === 'conclusion')
      .map((m) => ({
        name: m.agentName,
        content: m.content,
        kind: m.role as TranscriptLine['kind'],
      }));

  const conclusionText = (): string =>
    state.messages.find((m) => m.role === 'conclusion')?.content ?? '';

  const handleExportMd = () => {
    if (!liveReport) return;
    downloadReportMarkdown(liveReport, buildMeta(), buildTranscript(), conclusionText());
  };

  const handleExportJson = () => {
    if (!liveReport) return;
    downloadReportJson(liveReport, buildMeta());
  };

  return (
    <div className="w-full h-full flex flex-col bg-bg overflow-hidden">
      <HeaderBar
        caseTitle={started || restored ? caseTitle(brief) : ''}
        stage={state.stage}
        mode={state.mode}
        running={state.running}
        onModeChange={(m: DiscussionMode) => discussionController.setMode(m)}
      />

      <div
        className="flex-1 min-h-0 grid"
        style={{ gridTemplateColumns: '320px 1fr 380px' }}
      >
        {/* 左: 案件ブリーフ */}
        <div className="min-h-0 border-r-2 border-border bg-bg-dark/60">
          <BriefPanel
            brief={brief}
            onBriefChange={setBrief}
            rounds={rounds}
            onRoundsChange={setRounds}
            running={state.running}
            started={started}
            mode={state.mode}
            onConvene={handleConvene}
            onReset={handleReset}
          />
          {!started && lastSession && (
            <div className="px-16 pb-16 -mt-4">
              <button
                onClick={handleRestore}
                className="text-2xs text-text-muted hover:text-accent-bright underline cursor-pointer bg-transparent border-0 p-0"
              >
                前回: {lastSession.title}（{lastSession.date}）を表示
              </button>
            </div>
          )}
        </div>

        {/* 中央: 戦略コックピット */}
        <div className="min-h-0">
          <ReportView
            report={liveReport}
            running={state.running}
            stage={state.stage}
            onExportMd={handleExportMd}
            onExportJson={handleExportJson}
          />
        </div>

        {/* 右: War Room */}
        <div className="min-h-0">
          <WarRoomFeed state={state} />
        </div>
      </div>
    </div>
  );
}
