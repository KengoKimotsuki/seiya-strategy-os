import { isBrowserRuntime } from './runtime';
import { simulationController } from './simulation/simulationController';

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };

interface VsCodeLike {
  postMessage(msg: unknown): void;
}

/**
 * Browser runtime: delegate agent lifecycle messages to the simulation controller.
 * The controller owns timers, stats, scenarios, and dispatches synthetic
 * extension-side messages back to the webview.
 */
function createBrowserMockVscode(): VsCodeLike {
  return {
    postMessage(msg: unknown): void {
      console.log('[vscode.postMessage]', msg);
      if (!msg || typeof msg !== 'object') return;
      const m = msg as Record<string, unknown>;

      if (m.type === 'openClaude') {
        simulationController.addAgent();
      } else if (m.type === 'closeAgent') {
        simulationController.removeAgent(m.id as number);
      } else if (m.type === 'focusAgent') {
        simulationController.focusAgent(m.id as number);
      }
      // Other message types (settings, layout save, etc.) are no-ops in browser mode
    },
  };
}

export const vscode: VsCodeLike = isBrowserRuntime
  ? createBrowserMockVscode()
  : (acquireVsCodeApi() as VsCodeLike);
