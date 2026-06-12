import { useEffect, useState } from 'react';

import { personalityBadge } from '../simulation/discussionController';
import { PCM_TYPE_ORDER, PCM_TYPES, type PcmTypeId } from '../simulation/personalities';
import { ROOM_ORDER, type RoomId, ROOMS } from '../simulation/rooms';
import { SCENARIO_ORDER, SCENARIOS } from '../simulation/scenarios';
import { simulationController } from '../simulation/simulationController';
import type { ScenarioId, SimulationState, ToolName } from '../simulation/types';
import { Button } from './ui/Button';
import { DraggablePanel } from './ui/DraggablePanel';

const SPEEDS = [0.5, 1, 2, 4];
const TOOL_ORDER: ToolName[] = ['Read', 'Edit', 'Bash', 'Grep', 'Write', 'Glob'];

function formatElapsed(ms: number): string {
  if (ms <= 0) return '0秒';
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}秒`;
  return `${m}分 ${s}秒`;
}

export function SimulationPanel() {
  const [state, setState] = useState<SimulationState>(simulationController.getState());
  const [collapsed, setCollapsed] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    return simulationController.subscribe(setState);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const stats = simulationController.getState().stats;
  const total = stats.totalActions;

  return (
    <DraggablePanel
      title="シミュレーション"
      defaultX={window.innerWidth - 300}
      defaultY={8}
      defaultWidth={270}
      minWidth={220}
      maxWidth={420}
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((v) => !v)}
    >
      {/* Room selector */}
      <div className="flex flex-col gap-2">
        <span className="text-text-muted text-xs">環境</span>
        <div className="flex gap-1 flex-wrap">
          {ROOM_ORDER.map((id: RoomId) => {
            const r = ROOMS[id];
            return (
              <Button
                key={id}
                size="sm"
                variant={state.roomId === id ? 'active' : 'default'}
                onClick={() => simulationController.setRoom(id)}
                title={r.description}
              >
                {r.emoji} {r.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Personality picker */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs">性格</span>
          <span className="text-2xs text-text-muted">
            {state.selectedPcmTypes.length === 0
              ? 'ランダム'
              : `${state.selectedPcmTypes.length}/3 選択中`}
          </span>
        </div>
        <div className="flex gap-1 flex-wrap">
          <Button
            size="sm"
            variant={state.selectedPcmTypes.length === 0 ? 'active' : 'default'}
            onClick={() => simulationController.setSelectedPcmTypes([])}
          >
            🎲
          </Button>
          {PCM_TYPE_ORDER.map((id: PcmTypeId) => {
            const t = PCM_TYPES[id];
            const idx = (state.selectedPcmTypes as PcmTypeId[]).indexOf(id);
            const isSelected = idx !== -1;
            const posLabel = idx === 0 ? '①' : idx === 1 ? '②' : idx === 2 ? '③' : '';
            return (
              <Button
                key={id}
                size="sm"
                variant={isSelected ? 'active' : 'default'}
                onClick={() => {
                  const current = state.selectedPcmTypes as PcmTypeId[];
                  if (isSelected) {
                    simulationController.setSelectedPcmTypes(current.filter((x) => x !== id));
                  } else if (current.length < 3) {
                    simulationController.setSelectedPcmTypes([...current, id]);
                  } else {
                    simulationController.setSelectedPcmTypes([...current.slice(1), id]);
                  }
                }}
                title={`${t.labelJa}: ${t.traits.join('・')}`}
              >
                {posLabel}
                {t.shortJa}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Agent controls */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-text-muted">エージェント数</span>
          <span>{state.agentIds.length}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => simulationController.addAgent()}>
            ＋1
          </Button>
          <Button size="sm" onClick={() => simulationController.addAgents(5)}>
            ＋5
          </Button>
          <Button
            size="sm"
            variant={state.agentIds.length === 0 ? 'disabled' : 'default'}
            onClick={() =>
              state.agentIds.length > 0 ? simulationController.removeAllAgents() : undefined
            }
          >
            全削除
          </Button>
        </div>
      </div>

      {/* Agent roster — translate="no" でブラウザ翻訳によるDOM破壊を防止 */}
      {state.agentIds.length > 0 && (
        <div
          translate="no"
          className="notranslate flex flex-col gap-1 max-h-32 overflow-y-auto pr-1"
          style={{ fontSize: '11px' }}
        >
          {state.agentIds.map((id) => {
            const p = simulationController.getPersonality(id);
            if (!p) return null;
            return (
              <div key={id} className="flex flex-col gap-0.5 py-1 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-accent-bright">
                    <span>{p.nameJa}</span>
                  </span>
                  <span className="text-text-muted">
                    <span>{`#${id}`}</span>
                  </span>
                </div>
                <span className="text-text-muted text-2xs">
                  <span>{personalityBadge(p)}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Speed */}
      <div className="flex flex-col gap-2">
        <span className="text-text-muted">速度</span>
        <div className="flex gap-1 flex-wrap">
          {SPEEDS.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={state.speed === s ? 'active' : 'default'}
              onClick={() => simulationController.setSpeed(s)}
            >
              {s}x
            </Button>
          ))}
        </div>
      </div>

      {/* Scenarios */}
      <div className="flex flex-col gap-2">
        <span className="text-text-muted">シナリオ</span>
        <div className="flex flex-col gap-1">
          {SCENARIO_ORDER.map((id: ScenarioId) => {
            const cfg = SCENARIOS[id];
            const active = state.scenarioId === id;
            return (
              <Button
                key={id}
                size="sm"
                variant={active ? 'active' : 'default'}
                onClick={() => simulationController.setScenario(id)}
                title={cfg.description}
                className="justify-start! text-left"
              >
                {active ? '◉ ' : '○ '}
                {cfg.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-text-muted">経過</span>
          <span>{formatElapsed(stats.elapsedMs)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-muted">総アクション</span>
          <span>{total}</span>
        </div>
        <div className="flex flex-col gap-1">
          {TOOL_ORDER.map((name) => {
            const count = stats.byTool[name] ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={name} className="flex items-center gap-2 text-xs">
                <span className="w-12 text-text-muted">{name}</span>
                <div className="flex-1 h-2 bg-btn-bg relative">
                  <div
                    className="absolute top-0 left-0 h-full bg-accent"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-14 text-right">
                  {count} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
        <Button size="sm" onClick={() => simulationController.resetStats()}>
          統計リセット
        </Button>
      </div>
    </DraggablePanel>
  );
}
