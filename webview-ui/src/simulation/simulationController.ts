import { type StrategyPersona } from '../strategy/personas';
import { generatePersonality, type PcmTypeId, type Personality } from './personalities';
import { type RoomId,ROOMS } from './rooms';
import { pickToolStatus, SCENARIOS } from './scenarios';
import type { ScenarioId, SimulationState, SimulationStats, ToolName } from './types';

const TOOL_NAMES: ToolName[] = ['Read', 'Edit', 'Bash', 'Grep', 'Write', 'Glob'];

function emptyStats(): SimulationStats {
  return {
    totalActions: 0,
    byTool: { Read: 0, Edit: 0, Bash: 0, Grep: 0, Write: 0, Glob: 0 },
    byAgent: {},
    startedAt: null,
    elapsedMs: 0,
  };
}

function dispatch(data: unknown): void {
  window.dispatchEvent(new MessageEvent('message', { data }));
}

class SimulationController {
  private state: SimulationState = {
    speed: 1,
    scenarioId: 'balanced',
    stats: emptyStats(),
    agentIds: [],
    personalities: {},
    roomId: 'office',
    selectedPcmTypes: [],
  };

  private nextAgentId = 1;
  private agentTimers = new Map<number, ReturnType<typeof setInterval>>();
  private agentSteps = new Map<number, number>();
  private currentToolIds = new Map<number, string>();
  private listeners = new Set<(s: SimulationState) => void>();
  private personalityMap = new Map<number, Personality>();

  getState(): SimulationState {
    return {
      ...this.state,
      stats: {
        ...this.state.stats,
        byTool: { ...this.state.stats.byTool },
        byAgent: { ...this.state.stats.byAgent },
        elapsedMs: this.state.stats.startedAt
          ? Date.now() - this.state.stats.startedAt
          : this.state.stats.elapsedMs,
      },
      agentIds: [...this.state.agentIds],
      personalities: { ...this.state.personalities },
      roomId: this.state.roomId,
      selectedPcmTypes: [...this.state.selectedPcmTypes],
    };
  }

  getPersonality(id: number): Personality | undefined {
    return this.personalityMap.get(id);
  }

  getAllPersonalities(): Map<number, Personality> {
    return new Map(this.personalityMap);
  }

  // ── Room ──

  setRoom(id: RoomId): void {
    if (this.state.roomId === id) return;
    this.state.roomId = id;
    const room = ROOMS[id];
    // Dispatch custom event for OfficeCanvas / App to handle camera + seat reassignment
    dispatch({
      type: 'simulationRoomChanged',
      roomId: id,
      bounds: room.bounds,
      cameraCenterPx: room.bounds.cameraCenterPx,
    });
    this.notify();
  }

  getRoom() {
    return ROOMS[this.state.roomId as RoomId] ?? ROOMS.office;
  }

  // ── Personality selection ──

  setSelectedPcmTypes(types: PcmTypeId[]): void {
    this.state.selectedPcmTypes = types.slice(0, 3);
    this.notify();
  }

  getSelectedPcmTypes(): PcmTypeId[] {
    return this.state.selectedPcmTypes as PcmTypeId[];
  }

  subscribe(fn: (s: SimulationState) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  addAgent(): number {
    const id = this.nextAgentId++;
    const sel = this.state.selectedPcmTypes as PcmTypeId[];
    const personality = generatePersonality({
      base: sel[0],
      phase: sel[1],
      tertiary: sel[2],
    });
    this.personalityMap.set(id, personality);
    this.state.personalities[id] = personality;

    const folderName = personality.nameJa;

    this.state.agentIds.push(id);
    this.state.stats.byAgent[id] = 0;
    if (this.state.stats.startedAt === null) {
      this.state.stats.startedAt = Date.now();
    }

    // Simulate small async delay like a real terminal launch
    setTimeout(() => {
      dispatch({ type: 'agentCreated', id, folderName });
      // Start activity after a settling period
      setTimeout(() => this.scheduleAgent(id), 1500);
    }, 150);

    this.notify();
    return id;
  }

  addAgents(n: number): void {
    for (let i = 0; i < n; i++) {
      // Stagger creations slightly so they spawn over time (feels natural)
      setTimeout(() => this.addAgent(), i * 250);
    }
  }

  /**
   * 戦略人格（personas.ts）を割り当てたエージェントを1体生成する。
   * PCM の base/phase/tertiary は生成しつつ、表示名と systemPrompt を人格で上書きする
   * （LLM 経路は systemPrompt を使い、テンプレ・フォールバック時は PCM 挙動になる）。
   */
  addPersonaAgent(persona: StrategyPersona): number {
    const id = this.nextAgentId++;
    const base = generatePersonality();
    const personality: Personality = {
      ...base,
      nameJa: persona.name,
      summary: persona.role,
      personaId: persona.id,
      role: persona.role,
      systemPrompt: persona.systemPrompt,
    };
    this.personalityMap.set(id, personality);
    this.state.personalities[id] = personality;

    this.state.agentIds.push(id);
    this.state.stats.byAgent[id] = 0;
    if (this.state.stats.startedAt === null) {
      this.state.stats.startedAt = Date.now();
    }

    setTimeout(() => {
      dispatch({ type: 'agentCreated', id, folderName: persona.name });
      setTimeout(() => this.scheduleAgent(id), 1500);
    }, 150);

    this.notify();
    return id;
  }

  /**
   * 戦略会議を招集する。既存エージェントを一掃し、6専門家を配置する。
   * 古賀CMO（モデレーター）は議長ロール（discussionController の system 役）なので
   * 発話ローテーション（agentIds）には含めない。
   */
  spawnCouncil(specialists: StrategyPersona[]): number[] {
    this.removeAllAgents();
    // agentIds は同期で push される（オフィス描画用 agentCreated のみ 150ms 遅延）。
    // 同期生成して実 id を返すことで、呼び出し側が即座に討議を開始できる。
    return specialists.map((persona) => this.addPersonaAgent(persona));
  }

  removeAgent(id: number): void {
    this.stopAgent(id);
    this.state.agentIds = this.state.agentIds.filter((x) => x !== id);
    this.personalityMap.delete(id);
    delete this.state.personalities[id];
    dispatch({ type: 'agentClosed', id });
    this.notify();
  }

  removeAllAgents(): void {
    const ids = [...this.state.agentIds];
    for (const id of ids) {
      this.removeAgent(id);
    }
  }

  focusAgent(id: number): void {
    dispatch({ type: 'agentSelected', id });
  }

  setSpeed(speed: number): void {
    if (this.state.speed === speed) return;
    this.state.speed = speed;
    this.rescheduleAll();
    this.notify();
  }

  setScenario(id: ScenarioId): void {
    if (this.state.scenarioId === id) return;
    this.state.scenarioId = id;
    this.rescheduleAll();
    this.notify();
  }

  resetStats(): void {
    this.state.stats = emptyStats();
    if (this.state.agentIds.length > 0) {
      this.state.stats.startedAt = Date.now();
      for (const id of this.state.agentIds) {
        this.state.stats.byAgent[id] = 0;
      }
    }
    this.notify();
  }

  private rescheduleAll(): void {
    for (const id of this.state.agentIds) {
      this.stopAgentTimer(id);
      this.scheduleAgent(id);
    }
  }

  private scheduleAgent(id: number): void {
    this.stopAgentTimer(id);
    const scenario = SCENARIOS[this.state.scenarioId];
    const interval = Math.max(200, Math.round(scenario.intervalMs / this.state.speed));
    const timer = setInterval(() => this.tickAgent(id), interval);
    this.agentTimers.set(id, timer);
  }

  private stopAgentTimer(id: number): void {
    const t = this.agentTimers.get(id);
    if (t) {
      clearInterval(t);
      this.agentTimers.delete(id);
    }
  }

  private stopAgent(id: number): void {
    this.stopAgentTimer(id);
    this.agentSteps.delete(id);
    const cur = this.currentToolIds.get(id);
    if (cur) {
      dispatch({ type: 'agentToolDone', id, toolId: cur });
      this.currentToolIds.delete(id);
    }
  }

  private tickAgent(id: number): void {
    const step = (this.agentSteps.get(id) ?? 0) + 1;
    this.agentSteps.set(id, step);

    // Complete any in-flight tool for this agent
    const cur = this.currentToolIds.get(id);
    if (cur) {
      dispatch({ type: 'agentToolDone', id, toolId: cur });
      this.currentToolIds.delete(id);
    }

    const scenario = SCENARIOS[this.state.scenarioId];

    // Occasionally enter a waiting / cleared state
    if (Math.random() < scenario.waitChance) {
      dispatch({ type: 'agentToolsClear', id });
      dispatch({ type: 'agentStatus', id, status: 'waiting' });
      return;
    }

    const toolName = this.pickTool();
    const status = pickToolStatus(toolName);
    const toolId = `sim-${id}-${step}`;
    this.currentToolIds.set(id, toolId);

    dispatch({
      type: 'agentToolStart',
      id,
      toolId,
      status,
      toolName,
    });

    // Update stats
    this.state.stats.totalActions++;
    this.state.stats.byTool[toolName] = (this.state.stats.byTool[toolName] ?? 0) + 1;
    this.state.stats.byAgent[id] = (this.state.stats.byAgent[id] ?? 0) + 1;
    this.notify();
  }

  private pickTool(): ToolName {
    const weights = SCENARIOS[this.state.scenarioId].toolWeights;
    const entries = TOOL_NAMES.map((name) => [name, weights[name] ?? 0] as const).filter(
      ([, w]) => w > 0,
    );
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    if (total <= 0) return 'Read';
    let r = Math.random() * total;
    for (const [name, w] of entries) {
      r -= w;
      if (r <= 0) return name;
    }
    return entries[entries.length - 1]![0];
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const fn of this.listeners) {
      fn(snapshot);
    }
  }
}

export const simulationController = new SimulationController();
