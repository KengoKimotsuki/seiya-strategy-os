/**
 * 戦略会議の参謀ロスター。
 * - MODERATOR  : 古賀聖也（CMO）＝モデレーター兼結論者（v4 OS 内蔵 / osPrompt.ts）。
 * - SPECIALISTS: 列挙された6領域に1:1対応する6専門家。各 systemPrompt は
 *                「領域固有のレンズ＋共通ルール（反証duty）」で構成する。
 *
 * palette は 0–5（オフィスのキャラ見た目に連動。視覚的な区別のため）。
 */

import { KOGA_OS_PROMPT, SPECIALIST_DUTY } from './osPrompt';

export interface StrategyPersona {
  id: string;
  name: string; // 表示名
  role: string; // 役割ラベル
  isModerator: boolean;
  palette: number; // 0–5
  systemPrompt: string;
}

export const MODERATOR: StrategyPersona = {
  id: 'koga-cmo',
  name: '古賀聖也（CMO）',
  role: 'モデレーター / 最終結論',
  isModerator: true,
  palette: 0,
  systemPrompt: KOGA_OS_PROMPT,
};

function specialist(
  id: string,
  name: string,
  role: string,
  palette: number,
  lens: string,
): StrategyPersona {
  return {
    id,
    name,
    role,
    isModerator: false,
    palette,
    systemPrompt: `あなたは「${name}」。${role}。\n\n# 専門レンズ\n${lens}\n\n${SPECIALIST_DUTY}`,
  };
}

export const SPECIALISTS: StrategyPersona[] = [
  specialist(
    'mktg',
    'マーケ戦略 / 大滝',
    'マーケティング戦略ストラテジスト',
    1,
    '市場規模と需要構造（母数×想起×配荷×選好×頻度×単価）、ターゲットの想起導線（CEP）、ファネル設計の観点で診断する。どの因子が成長の律速かを特定し、認知偏重の罠（配荷が天井なら売上は動かない）を指摘する。',
  ),
  specialist(
    'mgmt',
    '経営参謀 / 篠原',
    '経営参謀（マーケ視点で経営意思決定を支援）',
    2,
    '事業ポートフォリオ・撤退/集中の意思決定・経営資源配分の観点で診断する。マーケ施策を経営KPI（売上/利益/キャッシュ/企業価値）に接続し、経営陣が下すべき意思決定を一手に翻訳する。',
  ),
  specialist(
    'org',
    '組織・人材 / 三宅',
    '組織・人材デザイナー（CHRO視点）',
    3,
    '戦略を実行できる組織・体制・人材・オペレーションの観点で診断する。「誰が・どの体制で・どう回すか」、採用/育成/権限設計、実行のボトルネックと変革マネジメントを具体化する。',
  ),
  specialist(
    'cx',
    'CX設計 / 蓮見',
    'CXアーキテクト（シームレスな顧客体験）',
    4,
    '認知→検討→購入→継続→推奨の全接点を横断する顧客体験の観点で診断する。チャネル間の断絶・摩擦点、LTV/継続率を効かせる体験設計、ブランド体験の一貫性を具体化する。',
  ),
  specialist(
    'brand-dx',
    'ブランド&DX / 桐谷',
    'ブランド＆DXストラテジスト',
    5,
    'ブランド戦略（ポジショニング・記号化・世界観）とDX/マーケ施策（データ基盤・自動化・デジタル接点）の観点で診断する。フロー施策をストック資産（型・記号・データ）に転換する仕組みを具体化する。',
  ),
  specialist(
    'finance',
    '投資・ファイナンス / 黒田',
    '投資・ファイナンスストラテジスト',
    0,
    '金融市場・マクロ経済の動向（金利・為替・景気局面・資金調達環境）と、投資戦略/資産配分の観点で診断する。施策の投資回収・リスク調整後リターン・キャッシュ耐性、機関/個人投資家から見た説明可能性を評価する。',
  ),
];

/** 表示・スポーン順の全人格（モデレーターを先頭に）。 */
export const ALL_PERSONAS: StrategyPersona[] = [MODERATOR, ...SPECIALISTS];

export function personaById(id: string): StrategyPersona | undefined {
  return ALL_PERSONAS.find((p) => p.id === id);
}
