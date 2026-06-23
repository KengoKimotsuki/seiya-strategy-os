import { useRef, useState } from 'react';

import {
  type AttachedFile,
  ATTACHMENT_ACCEPT,
  attachmentKind,
  extractFileText,
  MAX_FILES,
} from '../../strategy/fileImport';
import { Button } from '../ui/Button';

interface AttachmentPanelProps {
  attachments: AttachedFile[];
  onChange: (files: AttachedFile[]) => void;
}

/** 添付資料（PDF / CSV）のアップロード・解析・一覧 UI。案件ブリーフに組み込む。 */
export function AttachmentPanel({ attachments, onChange }: AttachmentPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(0);
  const [notice, setNotice] = useState('');

  const handleFiles = async (fileList: FileList | null): Promise<void> => {
    if (!fileList || fileList.length === 0) return;
    const picked = Array.from(fileList);
    const valid = picked.filter((f) => attachmentKind(f.name) !== null);

    const messages: string[] = [];
    if (valid.length < picked.length) {
      messages.push(
        `${picked.length - valid.length}件は対象外の形式のためスキップ（PDF / CSV のみ）`,
      );
    }

    const room = Math.max(0, MAX_FILES - attachments.length);
    const slice = valid.slice(0, room);
    if (valid.length > room) {
      messages.push(`添付は最大${MAX_FILES}件まで。${valid.length - room}件をスキップ`);
    }
    setNotice(messages.join(' / '));

    setParsing((n) => n + slice.length);
    let current = attachments;
    for (const file of slice) {
      const kind = attachmentKind(file.name);
      if (!kind) continue;
      const parsed = await extractFileText(file, kind);
      // 同一ファイル（id 一致）は置き換える
      current = [...current.filter((f) => f.id !== parsed.id), parsed];
      onChange(current);
      setParsing((n) => n - 1);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (id: string): void => {
    onChange(attachments.filter((f) => f.id !== id));
  };

  const atLimit = attachments.length >= MAX_FILES;

  return (
    <div className="flex flex-col gap-4">
      <span className="text-2xs text-text-muted">添付資料（PDF / CSV）</span>

      <input
        ref={inputRef}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <Button
        size="sm"
        variant={atLimit ? 'disabled' : 'default'}
        onClick={() => (atLimit ? undefined : inputRef.current?.click())}
      >
        ＋ ファイルを添付
      </Button>

      {parsing > 0 && <div className="text-2xs text-text-muted">{parsing}件を解析中…</div>}
      {notice && <div className="text-2xs text-status-permission">※ {notice}</div>}

      {attachments.length > 0 && (
        <ul className="flex flex-col gap-2">
          {attachments.map((f) => (
            <li
              key={f.id}
              className="pixel-panel p-6 flex items-start justify-between gap-4"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="text-2xs text-text truncate">
                  <span className="text-accent-bright">{f.kind.toUpperCase()}</span> {f.name}
                </div>
                {f.error ? (
                  <div className="text-2xs text-status-permission break-words">{f.error}</div>
                ) : (
                  <div className="text-2xs text-text-muted">
                    {f.truncated
                      ? `全${f.originalCharCount}文字中${f.charCount}文字を使用`
                      : `${f.charCount}文字`}
                  </div>
                )}
              </div>
              <button
                onClick={() => remove(f.id)}
                className="text-2xs text-text-muted hover:text-status-permission bg-transparent border-0 p-0 cursor-pointer shrink-0"
                aria-label={`${f.name} を削除`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
