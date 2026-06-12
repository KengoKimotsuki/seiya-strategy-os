/**
 * 戦略レポートの構造化スキーマ。
 * 古賀CMO（モデレーター）の最終出力はこの `StrategyReport` JSON を唯一の形とし、
 * Cockpit の各パネル（診断・松竹梅・ドミノ・KPI・留保）へ自動反映する。
 * Markdown 出力も同一オブジェクトから生成する（reportExport.ts）。
 *
 * v4 仕様書のフィールドとの対応:
 *  diagnosis.where = WHERE(非対称/白地) / diagnosis.whyUs = WHY US(資格)
 *  diagnosis.what  = WHAT(BEFORE→AFTER の書き換え)
 *  plans           = 打ち手3案（松竹梅×1変数） / recommended = 原則「竹」
 *  firstDomino     = 最初のドミノ・Go基準・検証KPI（敵比×絶対値の両建て）
 *  reservations    = 留保（叩き台/別途協議。v4 F原則: 断言と留保の同居）
 */

export type PlanRank = 'matsu' | 'take' | 'ume';

export const PLAN_RANK_LABEL: Record<PlanRank, string> = {
  matsu: '松',
  take: '竹',
  ume: '梅',
};

export type KpiType = '敵比' | '絶対値';

export interface ReportKpi {
  name: string;
  type: KpiType;
  note?: string;
}

export interface StrategyPlan {
  rank: PlanRank;
  name: string;
  aim: string; // 狙い
  actions: string[]; // 主要施策
  resources: string; // 必要リソース・予算感
  expectedImpact: string; // 想定効果
  risks: string[]; // 前提・リスク
}

export interface StrategyDiagnosis {
  where: string; // 非対称・白地
  whyUs: string; // 資格
  what: { before: string; after: string }; // 書き換え
}

export interface StrategyFirstDomino {
  action: string; // 最初に倒す一手
  goCriteria: string[]; // Go/No-Go の判断材料
  kpis: ReportKpi[]; // 検証KPI（敵比×絶対値）
}

export interface StrategyReport {
  title: string; // メッセージ型タイトル
  execSummary: string[]; // エグゼクティブ要約（3〜5行）
  diagnosis: StrategyDiagnosis;
  plans: StrategyPlan[]; // 松竹梅3案
  recommended: PlanRank; // 原則 'take'
  firstDomino: StrategyFirstDomino;
  reservations: string[]; // 叩き台/別途協議
}

const PLAN_RANKS: readonly PlanRank[] = ['matsu', 'take', 'ume'];

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeRank(value: unknown): PlanRank {
  return PLAN_RANKS.includes(value as PlanRank) ? (value as PlanRank) : 'take';
}

function normalizeKpis(value: unknown): ReportKpi[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw): ReportKpi | null => {
      if (typeof raw !== 'object' || raw === null) return null;
      const obj = raw as Record<string, unknown>;
      const name = asString(obj.name);
      if (!name) return null;
      const type: KpiType = obj.type === '敵比' ? '敵比' : '絶対値';
      const note = typeof obj.note === 'string' ? obj.note : undefined;
      return { name, type, note };
    })
    .filter((k): k is ReportKpi => k !== null);
}

function normalizePlans(value: unknown): StrategyPlan[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw): StrategyPlan | null => {
      if (typeof raw !== 'object' || raw === null) return null;
      const obj = raw as Record<string, unknown>;
      const name = asString(obj.name);
      const aim = asString(obj.aim);
      if (!name && !aim) return null;
      return {
        rank: normalizeRank(obj.rank),
        name: name || aim,
        aim,
        actions: asStringArray(obj.actions),
        resources: asString(obj.resources),
        expectedImpact: asString(obj.expectedImpact),
        risks: asStringArray(obj.risks),
      };
    })
    .filter((p): p is StrategyPlan => p !== null);
}

/**
 * LLM が返した生テキストから `StrategyReport` を抽出・検証する。
 * - ```json ... ``` フェンスを除去し、最初の `{` 〜 最後の `}` を JSON.parse。
 * - 必須キー（title / plans / diagnosis）が最低限揃わなければ null（呼び出し側でリトライ→縮退）。
 */
export function parseStrategyReport(raw: string): StrategyReport | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;

  let text = raw.trim();
  // コードフェンス除去
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    text = fenceMatch[1].trim();
  }
  // 前後の散文を落とすため最初の { 〜 最後の } を切り出す
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  const jsonSlice = text.slice(first, last + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonSlice);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;
  const plans = normalizePlans(obj.plans);
  const title = asString(obj.title);

  // 最低限の妥当性: タイトルか案が1つは取れていること
  if (!title && plans.length === 0) return null;

  const diagnosisRaw =
    typeof obj.diagnosis === 'object' && obj.diagnosis !== null
      ? (obj.diagnosis as Record<string, unknown>)
      : {};
  const whatRaw =
    typeof diagnosisRaw.what === 'object' && diagnosisRaw.what !== null
      ? (diagnosisRaw.what as Record<string, unknown>)
      : {};

  const firstDominoRaw =
    typeof obj.firstDomino === 'object' && obj.firstDomino !== null
      ? (obj.firstDomino as Record<string, unknown>)
      : {};

  return {
    title: title || '戦略レポート',
    execSummary: asStringArray(obj.execSummary),
    diagnosis: {
      where: asString(diagnosisRaw.where),
      whyUs: asString(diagnosisRaw.whyUs),
      what: { before: asString(whatRaw.before), after: asString(whatRaw.after) },
    },
    plans,
    recommended: normalizeRank(obj.recommended),
    firstDomino: {
      action: asString(firstDominoRaw.action),
      goCriteria: asStringArray(firstDominoRaw.goCriteria),
      kpis: normalizeKpis(firstDominoRaw.kpis),
    },
    reservations: asStringArray(obj.reservations),
  };
}
