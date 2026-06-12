# 戦略構築AI SEIYA

`戦略構築OS 完全仕様書 v4`（古賀聖也の「視点・思考回路・ロジック」を言語化した戦略思考フレーム）を、**動く戦略会議ツール**として実装したもの。`Pixel＿シミュレーター`（pixel-agents）の議論エンジンをフォークし、戦略コンサルティング用途に作り替えている。

案件を入力すると、**6名の専門家**が討議し、モデレーター兼結論者の**古賀聖也（CMO）**が v4 OS で統合して、**エグゼクティブ要約＋打ち手3案（松竹梅）**の構造化レポートを生成する。

---

## UI コンセプト — Strategy Cockpit × War Room

```
┌─ ヘッダー: SEIYA / 案件名 / フェーズステッパー / LLMモード ───────────┐
├──────────┬───────────────────────────────┬──────────────────┤
│ 案件ブリーフ │ 戦略コックピット                  │ War Room フィード │
│ (左/入力)  │ 診断(WHERE/WHY US/WHAT) → 松竹梅 │ 6専門家＋古賀の討議 │
│          │ → 最初のドミノ・Go基準・KPI       │ (右/ライブ)       │
└──────────┴───────────────────────────────┴──────────────────┘
```

- **中央 = Strategy Cockpit**: 議論の「成果」を構造化して表示（チャットの延長にしない）。
- **右 = War Room**: 専門家と古賀の討議をライブ表示（アバター付き）。
- 討議が終わると、診断・打ち手3案・ドミノ/KPI が中央に「点灯」する。

---

## 参謀ロスター（人格）

| 役割 | 担当 |
|---|---|
| **古賀聖也（CMO）** | モデレーター兼・最終結論者。v4 OS（7つの問い・判断アルゴリズム・出力規則）を内蔵。 |
| マーケ戦略 | 市場・需要構造・想起導線・ファネル設計 |
| 経営参謀（マーケ視点） | 事業ポートフォリオ・経営意思決定支援 |
| 組織・人材（CHRO視点） | 実行体制・組織構築・マネジメント |
| CX アーキテクト | シームレスな顧客体験・接点横断設計 |
| ブランド & DX | ブランド戦略・DX/マーケ施策の立案 |
| 投資・ファイナンス | 金融市場/マクロ分析・投資戦略/資産配分 |

各専門家は自領域のレンズで診断し、「最大の反証」を必ず1つ提示する（Devil's Advocate 内蔵）。

---

## v4 仕様 → 実装 の対応

| v4 の概念 | 実装 |
|---|---|
| 7つの問い（WHERE/WHY US/WHAT/HOW MUCH/HOW/STOCK/SELL） | 古賀CMOの system prompt（`src/strategy/osPrompt.ts`） |
| 判断アルゴリズム・優先順位・弱点ガード(N1–N4) | 同上 |
| 出力構造（診断 → 松竹梅×1変数 → 最初のドミノ → Go基準 → 留保） | `StrategyReport`（`src/strategy/reportSchema.ts`） |
| 敵比 × 絶対値の両建て | `firstDomino.kpis[].type` |
| 断言と留保の同居（F原則） | `reservations` |
| 重い数理（需要方程式・NBD・λ・Kelly・EVPI） | 古賀の**内部思考のみ**。本文には出さない（出力深度の方針） |

---

## 動かし方

### 必要要件
- Node.js（`.nvmrc` 準拠）
- **ローカルの `claude` CLI（Claude Code）** — 既定の LLM モード。APIキー不要。
  - `~/.local/bin/claude`（または環境変数 `CLAUDE_PATH`）に存在すること。

### 起動
```bash
cd webview-ui
npm install
npm run dev          # → http://localhost:5180
```

### 使い方
1. 左の**案件ブリーフ**を入力（案件名・事業課題は必須）。
2. **討議ラウンド数**（1〜5、既定2）を選ぶ。
3. **「会議を招集」** → 6専門家が討議し、古賀CMOが結論とレポートを生成。
4. 中央の**戦略コックピット**に診断・松竹梅3案・最初のドミノが点灯。
5. **「MD出力」/「JSON出力」** でレポートをダウンロード。

### LLM モード（ヘッダー右）
- **CLI**（既定）: ローカル Claude を使用。`npm run dev` のプロキシ経由、APIキー不要。
- **API**: Anthropic API キーを UI に入力（パッケージ/デプロイ向き、従量課金）。
- **テンプレ**: オフラインのダミー応答（討議フローの確認用。レポートは生成しない）。

> claude-cli モードでは、6専門家×ラウンド＋結論＋レポートで LLM 呼び出しが多数・逐次に走るため、
> 1案件あたり数分かかることがあります（進捗は War Room のステータスで確認できます）。

---

## レポートのスキーマ（`StrategyReport`）

`src/strategy/reportSchema.ts` を参照。古賀CMOの最終出力は JSON 一本で、UI 各パネルと Markdown 出力の両方に使われる。

```ts
{
  title, execSummary[],
  diagnosis: { where, whyUs, what: { before, after } },
  plans: [{ rank: 'matsu'|'take'|'ume', name, aim, actions[], resources, expectedImpact, risks[] }],
  recommended,                       // 原則 'take'
  firstDomino: { action, goCriteria[], kpis: [{ name, type: '敵比'|'絶対値', note }] },
  reservations[]                     // 叩き台/別途協議
}
```

JSON のパースに失敗した場合は1回だけ「JSON のみで再出力」を促し、それでも失敗すればプローズのまま縮退表示する。

---

## アーキテクチャ

```
webview-ui/src/
├─ strategy/                  ← 今回の追加（戦略レイヤー）
│  ├─ personas.ts             古賀CMO ＋ 6専門家の人格定義
│  ├─ osPrompt.ts             v4 OS の言語化（古賀の思考エンジン・出力指示）
│  ├─ reportSchema.ts         StrategyReport 型 ＋ パーサ
│  ├─ caseInput.ts            案件ブリーフ ＋ 討議コンテキスト整形
│  └─ reportExport.ts         Markdown / JSON 出力
├─ simulation/                ← 議論エンジン（フォーク元を最小改修）
│  ├─ discussionController.ts 討議の進行・古賀の要約/結論/レポート生成
│  ├─ simulationController.ts spawnCouncil / addPersonaAgent
│  ├─ llmClient.ts            systemPrompt 優先・claude-cli/API
│  └─ personalities.ts        Personality に persona フィールド追加
└─ components/cockpit/        ← Cockpit UI
   ├─ CockpitApp.tsx          合成ルート・状態・セッション保存
   ├─ HeaderBar.tsx           題字・フェーズステッパー・モード
   ├─ BriefPanel.tsx          案件入力フォーム
   ├─ WarRoomFeed.tsx         討議ライブ（アバター付き）
   └─ ReportView.tsx          診断・松竹梅・ドミノ・KPI・留保・出力
```

- ブラウザ単体（`npm run dev`）では `App.tsx` が Cockpit を表示する。
  VS Code 拡張ホスト時は従来のピクセルオフィス UI を維持する（元の挙動を温存）。
- セッションは `localStorage`（`seiya-sessions`）に保存され、起動時に直近を復元できる。

---

## 既知の制約・今後

- **claude-cli は `npm run dev`（dev サーバのプロキシ）前提**。パッケージ/デプロイ運用は API モードへ切替が必要。
- ピクセルオフィスの「小窓ライブビュー」は将来の拡張（現状は War Room のアバターでピクセル要素を表現）。
- Simulation Lab（前提を変えて1コール再試算）は Phase 2 の任意拡張。
