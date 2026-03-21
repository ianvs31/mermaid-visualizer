import { getPaletteItem, type PaletteItemId } from "../app/palette";

interface PaletteDragPreviewProps {
  itemId: PaletteItemId;
  x: number;
  y: number;
  insideCanvas?: boolean;
}

export function PaletteDragPreview({ itemId, x, y, insideCanvas }: PaletteDragPreviewProps) {
  const item = getPaletteItem(itemId);
  const width = item.defaultSize.width;
  const height = item.defaultSize.height;

  return (
    <div
      className={`palette-drag-preview${insideCanvas ? " is-inside" : ""}${itemId === "swimlane" ? " is-swimlane" : ""}`}
      style={{
        width,
        height,
        left: x - width / 2,
        top: y - height / 2,
      }}
      aria-hidden="true"
    >
      {itemId === "swimlane" ? <div className="palette-drag-preview__header">泳道</div> : null}
      <div className={`palette-drag-preview__shape palette-drag-preview__shape--${itemId}`}>{item.label}</div>
    </div>
  );
}
