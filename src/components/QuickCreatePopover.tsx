import { QUICK_CREATE_ITEMS, type PaletteItemId } from "../app/palette";

interface QuickCreatePopoverProps {
  x: number;
  y: number;
  onSelect: (itemId: PaletteItemId) => void;
  onClose: () => void;
}

export function QuickCreatePopover({ x, y, onSelect, onClose }: QuickCreatePopoverProps) {
  return (
    <div
      className="quick-create-popover"
      style={{ left: x, top: y }}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      role="dialog"
      aria-label="快速创建节点"
    >
      <div className="quick-create-popover__title">创建并连线</div>
      <div className="quick-create-popover__grid">
        {QUICK_CREATE_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="quick-create-popover__item"
            onClick={() => onSelect(item.id)}
            aria-label={item.label}
          >
            <span className={`quick-create-popover__shape quick-create-popover__shape--${item.id}`} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <button type="button" className="quick-create-popover__close" onClick={onClose}>
        取消
      </button>
    </div>
  );
}
