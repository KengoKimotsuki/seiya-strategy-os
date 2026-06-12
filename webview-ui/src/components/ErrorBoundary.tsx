import { Component, type ErrorInfo, type ReactNode } from 'react';

/* eslint-disable pixel-agents/no-inline-colors -- error fallback UI uses inline colors for safety (no theme dependency) */

interface Props {
  children: ReactNode;
  label?: string;
  /** 局所化したい時のカスタム fallback UI */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 一部のコンポーネントが throw しても画面全体を真っ白にしないための境界。
 * 議論シミュレータなど動的に更新される領域を必ずラップすること。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ErrorBoundary:${this.props.label ?? 'root'}]`, error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        className="pixel-panel"
        style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: 16,
          maxWidth: 480,
          zIndex: 1000,
          background: '#2a1010',
        }}
      >
        <div style={{ color: '#ff6b6b', fontSize: 14, marginBottom: 8 }}>
          ⚠ 表示エラー: {this.props.label ?? 'unknown'}
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#ccc',
            marginBottom: 10,
            maxHeight: 100,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {error.message}
        </div>
        <button
          onClick={this.reset}
          style={{
            padding: '6px 14px',
            background: '#3a3a4a',
            color: '#fff',
            border: '2px solid #5a5a6a',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          リセット
        </button>
      </div>
    );
  }
}
