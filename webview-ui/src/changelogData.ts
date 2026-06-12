interface ChangelogSection {
  title: string;
  items: string[];
}

interface ChangelogContributor {
  name: string;
  url: string;
  description: string;
}

interface ChangelogEntry {
  version: string;
  sections: ChangelogSection[];
  contributors: ChangelogContributor[];
}

/** Extract "major.minor" from a semver string (e.g. "1.1.1" → "1.1") */
export function toMajorMinor(version: string): string {
  const parts = version.split('.');
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : version;
}

export const CHANGELOG_REPO_URL = 'https://github.com/pablodelucca/pixel-agents';

export const changelogEntries: ChangelogEntry[] = [
  {
    version: '1.2',
    sections: [
      {
        title: '新機能',
        items: [
          '権限スキップモード — 「＋エージェント」を右クリックでツール承認をスキップ',
          '外部アセットパック — ユーザー指定ディレクトリから家具を読み込み',
          '着席処理、サブエージェントの生成、バックグラウンドエージェント対応を改善',
          'エージェントラベルを常に表示する設定を追加',
          'エージェントの接続診断と JSONL パーサーの堅牢化',
          '開発・レビュー向けのブラウザプレビューモード',
        ],
      },
      {
        title: '修正',
        items: ['フォルダ未オープン時に Linux Mint/macOS でエージェントが表示されない不具合'],
      },
      {
        title: 'テスト',
        items: ['モック Claude CLI を用いた Playwright E2E テスト'],
      },
      {
        title: 'メンテナンス',
        items: [
          'Vite 8.0、ESLint 10 などの依存関係更新',
          'Dependabot とバッジ更新のための CI 改善',
        ],
      },
    ],
    contributors: [
      {
        name: '@marctebo',
        url: 'https://github.com/marctebo',
        description: '外部アセットパック対応',
      },
      {
        name: '@dankadr',
        url: 'https://github.com/dankadr',
        description: '権限スキップモード',
      },
      {
        name: '@d4rkd0s',
        url: 'https://github.com/d4rkd0s',
        description: 'フォルダ未オープン時の Linux/macOS 向け修正',
      },
      {
        name: '@daniel-dallimore',
        url: 'https://github.com/daniel-dallimore',
        description: 'ラベル常時表示設定の追加',
      },
      {
        name: '@NNTin',
        url: 'https://github.com/NNTin',
        description: 'Playwright E2E テストとブラウザプレビューモード',
      },
      {
        name: '@florintimbuc',
        url: 'https://github.com/florintimbuc',
        description: 'エージェント診断、JSONL の堅牢化、CI 改善',
      },
    ],
  },
];
