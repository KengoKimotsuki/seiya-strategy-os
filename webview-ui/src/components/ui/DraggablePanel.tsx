import { useCallback, useEffect, useRef, useState } from 'react';

interface DraggablePanelProps {
  title: string;
  defaultX: number;
  defaultY: number;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  zIndex?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  children: React.ReactNode;
}

export function DraggablePanel({
  title,
  defaultX,
  defaultY,
  defaultWidth = 280,
  defaultHeight,
  minWidth = 180,
  minHeight = 60,
  maxWidth = 550,
  maxHeight,
  zIndex = 20,
  collapsed = false,
  onToggleCollapse,
  children,
}: DraggablePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: defaultX, y: defaultY });
  const [size, setSize] = useState({ w: defaultWidth, h: defaultHeight as number | undefined });
  const dragState = useRef<{
    sx: number;
    sy: number;
    ox: number;
    oy: number;
  } | null>(null);
  const resizeState = useRef<{
    sx: number;
    sy: number;
    ow: number;
    oh: number;
  } | null>(null);

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      e.preventDefault();
      dragState.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    },
    [pos.x, pos.y],
  );

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    resizeState.current = {
      sx: e.clientX,
      sy: e.clientY,
      ow: rect.width,
      oh: rect.height,
    };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragState.current) {
        setPos({
          x: dragState.current.ox + (e.clientX - dragState.current.sx),
          y: dragState.current.oy + (e.clientY - dragState.current.sy),
        });
      }
      if (resizeState.current) {
        const maxH = maxHeight ?? window.innerHeight * 0.85;
        setSize({
          w: Math.max(minWidth, Math.min(maxWidth, resizeState.current.ow + (e.clientX - resizeState.current.sx))),
          h: Math.max(minHeight, Math.min(maxH, resizeState.current.oh + (e.clientY - resizeState.current.sy))),
        });
      }
    };
    const onUp = () => {
      dragState.current = null;
      resizeState.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [minWidth, minHeight, maxWidth, maxHeight]);

  return (
    <div
      ref={panelRef}
      translate="no"
      className="notranslate pixel-panel flex flex-col select-none"
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: collapsed ? undefined : size.h,
        zIndex,
        overflow: 'hidden',
      }}
    >
      {/* Title bar = drag handle */}
      <div
        onMouseDown={onDragStart}
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ cursor: 'grab' }}
      >
        <span className="text-base text-accent-bright leading-none">{title}</span>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="text-sm text-text-muted bg-transparent border-none cursor-pointer px-2"
          >
            {collapsed ? '▸' : '▾'}
          </button>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-4 flex flex-col gap-3">
          {children}
        </div>
      )}

      {/* Resize handle */}
      {!collapsed && (
        <div
          onMouseDown={onResizeStart}
          className="absolute right-0 bottom-0 opacity-30 hover:opacity-60 text-2xs leading-none"
          style={{
            width: 16,
            height: 16,
            cursor: 'nwse-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ⟋
        </div>
      )}
    </div>
  );
}
