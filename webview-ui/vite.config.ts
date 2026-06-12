import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';

import { buildAssetIndex, buildFurnitureCatalog } from '../shared/assets/build.ts';
import {
  decodeAllCharacters,
  decodeAllFloors,
  decodeAllFurniture,
  decodeAllWalls,
} from '../shared/assets/loader.ts';

// ── Decoded asset cache (invalidated on file change) ─────────────────────────

interface DecodedCache {
  characters: ReturnType<typeof decodeAllCharacters> | null;
  floors: ReturnType<typeof decodeAllFloors> | null;
  walls: ReturnType<typeof decodeAllWalls> | null;
  furniture: ReturnType<typeof decodeAllFurniture> | null;
}

// ── Vite plugin ───────────────────────────────────────────────────────────────

function browserMockAssetsPlugin(): Plugin {
  const assetsDir = path.resolve(__dirname, 'public/assets');
  const distAssetsDir = path.resolve(__dirname, '../dist/webview/assets');

  const cache: DecodedCache = { characters: null, floors: null, walls: null, furniture: null };

  function clearCache(): void {
    cache.characters = null;
    cache.floors = null;
    cache.walls = null;
    cache.furniture = null;
  }

  return {
    name: 'browser-mock-assets',
    configureServer(server) {
      // Strip trailing slash: '/' → '', '/sub/' → '/sub'
      const base = server.config.base.replace(/\/$/, '');

      // Catalog & index (existing)
      server.middlewares.use(`${base}/assets/furniture-catalog.json`, (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(buildFurnitureCatalog(assetsDir)));
      });
      server.middlewares.use(`${base}/assets/asset-index.json`, (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(buildAssetIndex(assetsDir)));
      });

      // Pre-decoded sprites (new — eliminates browser-side PNG decoding)
      server.middlewares.use(`${base}/assets/decoded/characters.json`, (_req, res) => {
        cache.characters ??= decodeAllCharacters(assetsDir);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(cache.characters));
      });
      server.middlewares.use(`${base}/assets/decoded/floors.json`, (_req, res) => {
        cache.floors ??= decodeAllFloors(assetsDir);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(cache.floors));
      });
      server.middlewares.use(`${base}/assets/decoded/walls.json`, (_req, res) => {
        cache.walls ??= decodeAllWalls(assetsDir);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(cache.walls));
      });
      server.middlewares.use(`${base}/assets/decoded/furniture.json`, (_req, res) => {
        cache.furniture ??= decodeAllFurniture(assetsDir, buildFurnitureCatalog(assetsDir));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(cache.furniture));
      });

      // Claude CLI proxy — POST /api/claude { prompt: string, systemPrompt?: string }
      // Hardened: bounded body size, request timeout, error isolation, child stdin closed.
      const MAX_BODY_SIZE = 200_000; // 200 KB ハードリミット
      const CLI_TIMEOUT_MS = 90_000; // 90 秒
      const MAX_BUFFER = 4 * 1024 * 1024; // 4 MB stdout 上限

      server.middlewares.use(`${base}/api/claude`, (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }

        // レスポンスエラーを安全に処理(クライアント切断時のクラッシュ防止)
        res.on('error', (err) => {
          console.warn('[claude-proxy] response error:', err.message);
        });
        req.on('error', (err) => {
          console.warn('[claude-proxy] request error:', err.message);
        });

        let body = '';
        let aborted = false;

        req.on('data', (chunk: Buffer) => {
          if (aborted) return;
          body += chunk.toString();
          if (body.length > MAX_BODY_SIZE) {
            aborted = true;
            try {
              res.writeHead(413, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'body too large' }));
            } catch {
              // ignore
            }
          }
        });

        req.on('end', () => {
          if (aborted) return;
          let parsed: { prompt?: string; systemPrompt?: string };
          try {
            parsed = JSON.parse(body) as { prompt?: string; systemPrompt?: string };
          } catch {
            try {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid JSON body' }));
            } catch {
              // ignore
            }
            return;
          }

          const { prompt, systemPrompt } = parsed;
          if (!prompt || typeof prompt !== 'string') {
            try {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'prompt is required' }));
            } catch {
              // ignore
            }
            return;
          }

          const args = ['-p', prompt, '--max-turns', '1'];
          if (systemPrompt && typeof systemPrompt === 'string') {
            args.push('--system-prompt', systemPrompt);
          }
          const claudePath =
            process.env.CLAUDE_PATH || path.join(process.env.HOME || '', '.local/bin/claude');

          console.log(`[claude-proxy] -> ${claudePath} prompt=${prompt.slice(0, 40)}...`);

          // spawn を使い、stdin を ignore、stdout/stderr を pipe で受け取る。
          // execFile は Vite dev server 環境でコールバックが呼ばれないことがあるため避ける。
          let responded = false;
          const stdoutChunks: Buffer[] = [];
          const stderrChunks: Buffer[] = [];

          // claude CLI は cwd 配下に `.claude/sessions/*` を書き出す。これが dev サーバの
          // 監視ツリー内だと討議中に full-reload が走り、進行中の fetch が中断される。
          // cwd を監視外の一時ディレクトリに固定して根本的に回避する。
          const claudeCwd = path.join(os.tmpdir(), 'seiya-claude-cwd');
          try {
            fs.mkdirSync(claudeCwd, { recursive: true });
          } catch {
            // ignore
          }

          // stdin は pipe で開き、即座に end() を呼んで EOF を送る。
          // 'ignore' だと Claude CLI が即終了してしまうため使えない。
          const child = spawn(claudePath, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: process.env,
            cwd: claudeCwd,
          });
          child.stdin.end();

          const timeoutHandle = setTimeout(() => {
            if (responded) return;
            console.error('[claude-proxy] timeout');
            try {
              child.kill('SIGTERM');
            } catch {
              // ignore
            }
            sendResponse(504, { error: 'CLI timeout' });
          }, CLI_TIMEOUT_MS);

          function sendResponse(status: number, payload: Record<string, unknown>): void {
            if (responded) return;
            responded = true;
            clearTimeout(timeoutHandle);
            try {
              if (!res.headersSent) {
                res.writeHead(status, { 'Content-Type': 'application/json' });
              }
              res.end(JSON.stringify(payload));
            } catch {
              // ignore
            }
          }

          child.stdout.on('data', (c: Buffer) => {
            stdoutChunks.push(c);
            if (Buffer.concat(stdoutChunks).length > MAX_BUFFER) {
              child.kill('SIGTERM');
              sendResponse(500, { error: 'output too large' });
            }
          });

          child.stderr.on('data', (c: Buffer) => {
            stderrChunks.push(c);
          });

          child.on('error', (e) => {
            console.error('[claude-proxy] spawn error:', e.message);
            sendResponse(500, { error: e.message });
          });

          child.on('close', (code, signal) => {
            const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim();
            const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
            console.log(
              `[claude-proxy] <- exit=${code} signal=${signal} pid=${child.pid ?? 'n/a'} stdout=${stdout.length}B stderr=${stderr.length}B`,
            );
            if (stderr) console.log(`[claude-proxy] stderr: ${stderr.slice(0, 300)}`);
            if (stdout) console.log(`[claude-proxy] stdout (first 100): ${stdout.slice(0, 100)}`);
            if (code === 0 && stdout) {
              sendResponse(200, { content: stdout });
            } else {
              sendResponse(500, {
                error:
                  stderr.slice(0, 500) ||
                  `claude exited with code=${code ?? 'null'} signal=${signal ?? 'none'}`,
              });
            }
          });

          console.log(`[claude-proxy] spawned pid=${child.pid ?? 'unknown'}`);

          // クライアント切断時に子プロセスを kill (response 側で監視)
          // 注意: req.on('close') は keep-alive 切断などで誤発火するため使わない。
          // res.on('close') は response が完了 or client が切断した時のみ発火する。
          res.on('close', () => {
            if (!responded && !child.killed) {
              try {
                child.kill('SIGTERM');
              } catch {
                // ignore
              }
            }
          });
        });
      });

      // Hot-reload on asset file changes (PNGs, manifests, layouts)
      server.watcher.add(assetsDir);
      server.watcher.on('change', (file) => {
        if (file.startsWith(assetsDir)) {
          console.log(`[browser-mock-assets] Asset changed: ${path.relative(assetsDir, file)}`);
          clearCache();
          server.ws.send({ type: 'full-reload' });
        }
      });
    },
    // Build output includes lightweight metadata consumed by browser runtime.
    closeBundle() {
      fs.mkdirSync(distAssetsDir, { recursive: true });

      const catalog = buildFurnitureCatalog(assetsDir);
      fs.writeFileSync(path.join(distAssetsDir, 'furniture-catalog.json'), JSON.stringify(catalog));
      fs.writeFileSync(
        path.join(distAssetsDir, 'asset-index.json'),
        JSON.stringify(buildAssetIndex(assetsDir)),
      );
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), react(), browserMockAssetsPlugin()],
  build: {
    outDir: '../dist/webview',
    emptyOutDir: true,
  },
  base: './',
  server: {
    port: 5180,
    strictPort: false,
    // 0.0.0.0 = LAN 上の他端末からもアクセス可能
    host: '0.0.0.0',
    // 誤った full-reload を防ぐ。特に claude-cli モードでは、プロキシが起動する
    // `claude` CLI が dev サーバの cwd 配下に `.claude/sessions/*` を書き出すため、
    // これを無視しないと討議の途中でリロードが走り、進行中の fetch が中断される。
    // Playwright のスナップショット・スクリーンショット・レポート出力も同様に無視する。
    watch: {
      ignored: [
        '**/.claude/**',
        '**/.playwright-mcp/**',
        '**/*.png',
        '**/*.md',
        '**/dist/**',
      ],
    },
  },
});
