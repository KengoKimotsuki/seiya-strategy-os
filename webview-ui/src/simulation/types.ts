export type ToolName = 'Read' | 'Edit' | 'Bash' | 'Grep' | 'Write' | 'Glob';

export type ScenarioId = 'balanced' | 'coding' | 'debugging' | 'review' | 'idle';

export interface ScenarioConfig {
  id: ScenarioId;
  label: string;
  description: string;
  toolWeights: Partial<Record<ToolName, number>>;
  intervalMs: number;
  waitChance: number;
}

export interface SimulationStats {
  totalActions: number;
  byTool: Record<ToolName, number>;
  byAgent: Record<number, number>;
  startedAt: number | null;
  elapsedMs: number;
}

export interface SimulationState {
  speed: number;
  scenarioId: ScenarioId;
  stats: SimulationStats;
  agentIds: number[];
  personalities: Record<number, unknown>;
  roomId: string;
  selectedPcmTypes: string[];
}
