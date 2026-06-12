import { Button } from './ui/Button.js';

interface MigrationNoticeProps {
  onDismiss: () => void;
}

export function MigrationNotice({ onDismiss }: MigrationNoticeProps) {
  return (
    <div
      className="absolute inset-0 bg-black/70 flex items-center justify-center z-100"
      onClick={onDismiss}
    >
      <div
        className="pixel-panel py-24 px-32 max-w-xl text-center leading-[1.3]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl mb-12 text-accent">お詫びがあります</div>
        <p className="text-xl m-0 mb-12">
          完全オープンソース化されたアセットへ移行しました。これらは一から丁寧に作り直されたものです。残念ながらこの移行に伴い、以前のレイアウトはリセットされます。
        </p>
        <p className="text-xl m-0 mb-12">ご不便をおかけして申し訳ありません。</p>
        <p className="text-xl m-0 mb-12">
          朗報: これは一度きりの対応で、今後のわくわくするアップデートへの足がかりになります。
        </p>
        <p className="text-xl m-0 mb-20">今後の更新にご期待ください。Pixel Agents をご利用いただきありがとうございます。</p>
        <Button variant="accent" size="xl" onClick={onDismiss}>
          了解
        </Button>
      </div>
    </div>
  );
}
