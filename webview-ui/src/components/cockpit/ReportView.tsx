import type { ReactNode } from 'react';

import type { DiscussionStage } from '../../simulation/discussionController';
import {
  PLAN_RANK_LABEL,
  type PlanRank,
  type StrategyPlan,
  type StrategyReport,
} from '../../strategy/reportSchema';
import { Button } from '../ui/Button';

function rankOrder(r: PlanRank): number {
  return r === 'matsu' ? 0 : r === 'take' ? 1 : 2;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm text-accent-bright border-b-2 border-border pb-3">{children}</h2>;
}

function DiagnosisPanel({ report }: { report: StrategyReport }) {
  const cards: { label: string; body: ReactNode }[] = [
    { label: 'WHERE 非対称・白地', body: report.diagnosis.where || '—' },
    { label: 'WHY US 資格', body: report.diagnosis.whyUs || '—' },
    {
      label: 'WHAT 書き換え',
      body: (
        <span>
          <span className="text-text-muted">{report.diagnosis.what.before || '—'}</span>
          <span className="text-accent-bright"> → </span>
          <span className="text-text">{report.diagnosis.what.after || '—'}</span>
        </span>
      ),
    },
  ];
  return (
    <section className="flex flex-col gap-8">
      <SectionTitle>戦略診断</SectionTitle>
      <div className="grid grid-cols-3 gap-10">
        {cards.map((c) => (
          <div key={c.label} className="pixel-panel p-12 flex flex-col gap-4">
            <div className="text-2xs text-text-muted">{c.label}</div>
            <div className="text-xs text-text leading-relaxed break-words">{c.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlanCard({ plan, recommended }: { plan: StrategyPlan; recommended: boolean }) {
  return (
    <div
      className={`flex flex-col gap-6 p-12 border-2 ${
        recommended ? 'border-accent-bright bg-active-bg/40' : 'border-border bg-bg-dark'
      }`}
    >
      <div className="flex items-center gap-4">
        <span
          className={`w-22 h-22 flex items-center justify-center text-base ${
            recommended ? 'bg-accent-bright text-bg-dark' : 'bg-btn-bg text-text'
          }`}
        >
          {PLAN_RANK_LABEL[plan.rank]}
        </span>
        <span className="text-xs text-text flex-1 break-words">{plan.name}</span>
        {recommended && <span className="text-2xs text-accent-bright shrink-0">★推奨</span>}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-2xs text-text-muted">狙い</span>
        <span className="text-2xs text-text break-words">{plan.aim || '—'}</span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-2xs text-text-muted">主要施策</span>
        <ul className="flex flex-col gap-1 pl-2">
          {plan.actions.length > 0 ? (
            plan.actions.map((a, i) => (
              <li key={i} className="text-2xs text-text break-words">
                ・{a}
              </li>
            ))
          ) : (
            <li className="text-2xs text-text-muted">—</li>
          )}
        </ul>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-2xs text-text-muted">予算感</span>
        <span className="text-2xs text-text break-words">{plan.resources || '—'}</span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-2xs text-text-muted">想定効果</span>
        <span className="text-2xs text-text break-words">{plan.expectedImpact || '—'}</span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-2xs text-text-muted">前提・リスク</span>
        <ul className="flex flex-col gap-1 pl-2">
          {plan.risks.length > 0 ? (
            plan.risks.map((r, i) => (
              <li key={i} className="text-2xs text-warning break-words">
                ・{r}
              </li>
            ))
          ) : (
            <li className="text-2xs text-text-muted">—</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function PlanComparison({ report }: { report: StrategyReport }) {
  const plans = [...report.plans].sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank));
  return (
    <section className="flex flex-col gap-8">
      <SectionTitle>打ち手3案（松竹梅）</SectionTitle>
      <div className="grid grid-cols-3 gap-10 items-start">
        {plans.map((p) => (
          <PlanCard key={p.rank} plan={p} recommended={p.rank === report.recommended} />
        ))}
      </div>
    </section>
  );
}

function DominoPanel({ report }: { report: StrategyReport }) {
  const d = report.firstDomino;
  return (
    <section className="grid grid-cols-3 gap-10">
      <div className="pixel-panel p-12 flex flex-col gap-4">
        <div className="text-2xs text-accent-bright">⑤ 最初のドミノ</div>
        <div className="text-xs text-text break-words">{d.action || '—'}</div>
      </div>
      <div className="pixel-panel p-12 flex flex-col gap-4">
        <div className="text-2xs text-accent-bright">Go / No-Go 基準</div>
        <ul className="flex flex-col gap-1">
          {d.goCriteria.length > 0 ? (
            d.goCriteria.map((g, i) => (
              <li key={i} className="text-2xs text-text break-words">
                ・{g}
              </li>
            ))
          ) : (
            <li className="text-2xs text-text-muted">—</li>
          )}
        </ul>
      </div>
      <div className="pixel-panel p-12 flex flex-col gap-4">
        <div className="text-2xs text-accent-bright">検証KPI（敵比×絶対値）</div>
        <ul className="flex flex-col gap-2">
          {d.kpis.length > 0 ? (
            d.kpis.map((k, i) => (
              <li key={i} className="flex items-center gap-3 text-2xs text-text break-words">
                <span
                  className={`px-3 py-0.5 shrink-0 ${
                    k.type === '敵比' ? 'bg-status-permission/30' : 'bg-status-active/30'
                  }`}
                >
                  {k.type}
                </span>
                <span>
                  {k.name}
                  {k.note ? `（${k.note}）` : ''}
                </span>
              </li>
            ))
          ) : (
            <li className="text-2xs text-text-muted">—</li>
          )}
        </ul>
      </div>
    </section>
  );
}

interface ReportViewProps {
  report: StrategyReport | null;
  running: boolean;
  stage: DiscussionStage;
  onExportMd: () => void;
  onExportJson: () => void;
}

export function ReportView({ report, running, stage, onExportMd, onExportJson }: ReportViewProps) {
  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-8 text-center px-24">
        <div className="text-3xl text-text-muted">戦略コックピット</div>
        <div className="text-sm text-text-muted max-w-[420px] leading-relaxed">
          {running
            ? stage === 'reporting'
              ? '古賀CMOがレポートを作成しています…'
              : stage === 'concluding'
                ? '古賀CMOが討議を統合しています…'
                : '専門家パネルが討議中です。完了するとここに診断・打ち手3案が点灯します。'
            : '左の案件ブリーフを入力し「会議を招集」してください。討議が終わると、診断・打ち手3案・最初のドミノがここに表示されます。'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-16 p-20 h-full overflow-y-auto">
      {/* Title + Export */}
      <div className="flex items-start gap-12">
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          <h1 className="text-xl text-text break-words">{report.title}</h1>
          <ul className="flex flex-col gap-1">
            {report.execSummary.map((s, i) => (
              <li key={i} className="text-xs text-text-muted break-words">
                ・{s}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3 shrink-0">
          <Button size="sm" variant="accent" onClick={onExportMd}>
            MD 出力
          </Button>
          <Button size="sm" variant="default" onClick={onExportJson}>
            JSON 出力
          </Button>
        </div>
      </div>

      <DiagnosisPanel report={report} />
      <PlanComparison report={report} />
      <DominoPanel report={report} />

      {report.reservations.length > 0 && (
        <section className="flex flex-col gap-6 border-t-2 border-border pt-10">
          <div className="text-2xs text-text-muted">留保・要確認（叩き台 / 別途協議）</div>
          <ul className="flex flex-col gap-1">
            {report.reservations.map((r, i) => (
              <li key={i} className="text-2xs text-text-muted break-words">
                ・{r}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
