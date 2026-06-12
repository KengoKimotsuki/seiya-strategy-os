/**
 * PCM (Process Communication Model) ベースの性格タイプ定義。
 * Taibi Kahler 博士のカラーアセスメントの概念を参考に、
 * 6 タイプ × 3 階層(ベース/フェーズ/第三型)の組合せを扱う。
 *
 * ここで用意しているテンプレート文面はオリジナル。
 * PCM 理論そのものの引用・複製は行わない。
 */

export type PcmTypeId =
  | 'thinker'
  | 'believer'
  | 'harmonizer'
  | 'joiner'
  | 'imaginer'
  | 'gambler';

export interface PcmTypeDef {
  id: PcmTypeId;
  labelJa: string;
  shortJa: string;
  paletteHint: number; // 0-5 (CHARACTER_PALETTES 連動)
  traits: string[];
  openingTemplates: string[];
  responseTemplates: string[];
  closingTemplates: string[];
}

export interface Personality {
  base: PcmTypeId;
  phase: PcmTypeId;
  tertiary: PcmTypeId;
  nameJa: string;
  summary: string;
  // 戦略人格（personas.ts）を割り当てた場合のみ設定。未設定なら従来の PCM 挙動。
  personaId?: string;
  role?: string;
  systemPrompt?: string; // あれば PCM 由来の system prompt より優先（llmClient で使用）
}

export const PCM_TYPES: Record<PcmTypeId, PcmTypeDef> = {
  thinker: {
    id: 'thinker',
    labelJa: '論理型',
    shortJa: 'シンカー',
    paletteHint: 0,
    traits: ['論理', '分析', '計画', '体系'],
    openingTemplates: [
      'データを整理すると、「{topic}」には明確な傾向が見えます。まず前提条件から確認しましょう。',
      '「{topic}」を論理的に分解すると、少なくとも 3 つの観点に分かれると考えます。',
      '統計的な観点で見れば、「{topic}」は条件次第で結論が変わる問題です。',
      '時間軸で整理するなら、「{topic}」は段階的に捉えるべきです。',
      '「{topic}」の構造を分析すると、原因と結果の関係がはっきりします。',
    ],
    responseTemplates: [
      '今の意見は感情ベースですね。事実に基づいて再考すると別の結論に到達します。',
      '論理の筋は通っていますが、検証可能な根拠が不足しているのでは。',
      'その前提が正しいか、データで裏を取る必要がありますね。',
      '変数を 1 つ固定して考えると、もっと正確に評価できます。',
    ],
    closingTemplates: [
      '総合すると、「{topic}」は条件付きで合理的な選択肢を取るのが最適解です。',
      '以上の分析から、私の結論は明確です。',
    ],
  },
  believer: {
    id: 'believer',
    labelJa: '信念型',
    shortJa: 'ビリーバー',
    paletteHint: 1,
    traits: ['価値観', '信念', '誠実', '献身'],
    openingTemplates: [
      '「{topic}」について私が譲れないのは、根底にある価値観の部分です。',
      'この件は単なる効率の問題ではなく、何を正しいとするかの選択だと思います。',
      '「{topic}」は信頼関係を損なわない形で進めるべきです。',
      '私は「{topic}」に対して、明確な立場を持っています。',
      '本質的に問うべきは、「{topic}」で何を守るかです。',
    ],
    responseTemplates: [
      '効率は大事ですが、そこで犠牲になるものがないか見極めるべきです。',
      '筋が通っていない選択肢は、たとえ数字が良くても支持しかねます。',
      'その考えには一理ありますが、誠実さの観点では納得できません。',
      '信頼を積み重ねる視点が欠けているように感じます。',
    ],
    closingTemplates: [
      '最後に強調させてください。「{topic}」は筋を通すことが大事です。',
      '私は自分の信念に基づいて、この立場を取り続けます。',
    ],
  },
  harmonizer: {
    id: 'harmonizer',
    labelJa: '共感型',
    shortJa: 'ハーモナイザー',
    paletteHint: 2,
    traits: ['共感', '思いやり', '調和', '傾聴'],
    openingTemplates: [
      '「{topic}」について、まず皆さんの気持ちを聴きたいです。温度感を共有しませんか。',
      '「{topic}」は関わる人の感情を大切にして進めたいテーマですね。',
      'みんなが気持ちよく「{topic}」に取り組める方法を一緒に探しましょう。',
      '私は「{topic}」で誰かが置いていかれないか心配しています。',
      '感情の面から見ると、「{topic}」には配慮が必要です。',
    ],
    responseTemplates: [
      'その意見、気持ちは分かります。同時に反対の立場の方の思いも大事にしたいです。',
      '論理はその通りだと思います。ただ、感情面の影響も忘れたくないですね。',
      '双方の意見のいいところを取り入れる折衷案を探せないでしょうか。',
      '急がず、まずは全員の温度感を揃えませんか。',
    ],
    closingTemplates: [
      '全員の気持ちに寄り添った結論を出せたら、それが一番嬉しいです。',
      '「{topic}」は全員で納得できる形を目指しましょう。',
    ],
  },
  joiner: {
    id: 'joiner',
    labelJa: '遊び心型',
    shortJa: 'ジョイナー',
    paletteHint: 3,
    traits: ['楽しさ', 'ユーモア', '自発', 'クリエイティブ'],
    openingTemplates: [
      '「{topic}」って、普通に考えたらつまらないけど、別の切り口があるかも!',
      'せっかくだし「{topic}」を思いっきり楽しむ方向で考えませんか。',
      '堅い話はあとで。まず「{topic}」でワクワクできる面を探そう。',
      '「{topic}」、実は面白くできるんじゃないですか?',
      '固定観念を外して「{topic}」を見ると、案外いけそう。',
    ],
    responseTemplates: [
      'それ真面目すぎない?もっと遊びの余地を入れようよ。',
      '面白い視点!そこに一工夫足すと、もっと盛り上がりそう。',
      '正論なのは分かる。でも、みんなが楽しめないと続かないよ。',
      '逆にこう考えるとどうかな、斜め上の発想で。',
    ],
    closingTemplates: [
      '結局、「{topic}」は楽しんだもの勝ちだと思う!',
      '真面目と面白さのバランスを大事にしたい。',
    ],
  },
  imaginer: {
    id: 'imaginer',
    labelJa: '内省型',
    shortJa: 'イマジナー',
    paletteHint: 4,
    traits: ['想像', '内省', '静謐', '洞察'],
    openingTemplates: [
      '……「{topic}」については、しばらく考えていました。',
      '少し独自の視点かもしれませんが、「{topic}」はこう捉えています。',
      '静かに考えてみると、「{topic}」の本質は表面と違うところにある気がします。',
      '「{topic}」について、自分の中で整理できた部分だけお話します。',
      '想像の余地を広げると、「{topic}」は別の姿に見えます。',
    ],
    responseTemplates: [
      'その視点は興味深いです。自分の中でもう少し咀嚼させてください。',
      'なるほど……別の可能性も同時に成立しうるのではないでしょうか。',
      '少し時間を置いて考え直したいです。',
      '表面的には対立しているようで、実は同じ方向を見ているかもしれません。',
    ],
    closingTemplates: [
      '結局、「{topic}」は答えのない問いのようにも思えます。それが大事だと感じます。',
      '私は自分の内側で納得できる形に落とし込みたいです。',
    ],
  },
  gambler: {
    id: 'gambler',
    labelJa: '挑戦型',
    shortJa: 'ギャンブラー',
    paletteHint: 5,
    traits: ['行動', '決断', '適応', '成果'],
    openingTemplates: [
      '「{topic}」、議論するより動いた方が早い。仮説を立ててやってみよう。',
      'リスクはあるけど、「{topic}」ならすぐ仕掛けられると思う。',
      '勝ち筋があるなら、「{topic}」で迷う必要はない。',
      '「{topic}」は結果が全て。まずやってみて、修正していけばいい。',
      'チャンスは今だよ。「{topic}」で動かない理由が見つからない。',
    ],
    responseTemplates: [
      '理屈はもういい。結果を出せる方法を選ぼう。',
      'それ、実行したらどうなるかやってみる?現場で判断しよう。',
      '慎重なのは分かるけど、機を逃すよ。',
      'その案、もっと大胆にいけるはず。',
    ],
    closingTemplates: [
      '「{topic}」、動いた者から結果が出る。以上。',
      '迷いは捨てる。今ここで決めて進もう。',
    ],
  },
};

export const PCM_TYPE_ORDER: PcmTypeId[] = [
  'thinker',
  'believer',
  'harmonizer',
  'joiner',
  'imaginer',
  'gambler',
];

// Common Japanese family names and given names for agent naming
const FAMILY_NAMES = [
  '佐藤', '鈴木', '高橋', '田中', '渡辺', '伊藤', '山本', '中村',
  '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上',
];

const GIVEN_NAMES = [
  '翼', '陽', '蓮', '悠', '健', '仁', '葵', '凛',
  '咲', '遥', '優', '海', '圭', '俊', '彩', '栞',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function generatePersonality(
  override?: { base?: PcmTypeId; phase?: PcmTypeId; tertiary?: PcmTypeId },
): Personality {
  const all = PCM_TYPE_ORDER.slice();

  const base = override?.base ?? pick(all);
  const remainingAfterBase = all.filter((t) => t !== base);
  const phase =
    override?.phase ??
    (Math.random() < 0.7 ? pick(remainingAfterBase) : pick(all));
  const remainingAfterPhase = all.filter((t) => t !== base && t !== phase);
  const tertiary =
    override?.tertiary ??
    (Math.random() < 0.7 ? pick(remainingAfterPhase) : pick(all));

  const nameJa = `${pick(FAMILY_NAMES)}${pick(GIVEN_NAMES)}`;

  const bt = PCM_TYPES[base];
  const pt = PCM_TYPES[phase];
  const tt = PCM_TYPES[tertiary];
  const summary = `${bt.labelJa}をベースに、${pt.labelJa}と${tt.labelJa}の側面を持つ。`;

  return { base, phase, tertiary, nameJa, summary };
}

/** ベース型を視覚パレット番号にマッピング (0-5) */
export function personalityToPalette(p: Personality): number {
  return PCM_TYPES[p.base].paletteHint;
}

function render(template: string, topic: string): string {
  return template.replaceAll('{topic}', topic);
}

/**
 * 発言生成: ベース/フェーズ/第三型の優先度に従ってテンプレートを選ぶ。
 * ラウンド位置に応じて opening / response / closing を切替。
 */
export function generateUtterance(
  p: Personality,
  topic: string,
  phase: 'opening' | 'response' | 'closing',
): string {
  // 選択する型を重み付けで決める (base 55%, phase 30%, tertiary 15%)
  const r = Math.random();
  const typeId: PcmTypeId = r < 0.55 ? p.base : r < 0.85 ? p.phase : p.tertiary;
  const def = PCM_TYPES[typeId];

  const pool =
    phase === 'opening'
      ? def.openingTemplates
      : phase === 'closing'
        ? def.closingTemplates
        : def.responseTemplates;

  const picked = pick(pool);
  return render(picked, topic || 'このテーマ');
}
