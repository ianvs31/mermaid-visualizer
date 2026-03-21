import { APPEARANCE_SWATCHES, normalizeHex } from "../app/appearance";

export function ColorSwatchGrid({
  selected,
  onPick,
}: {
  selected: string | "mixed";
  onPick: (color: string) => void;
}) {
  const normalizedSelected =
    selected === "mixed" ? "mixed" : normalizeHex(selected) ?? selected.toLowerCase();

  return (
    <div className="style-popover__swatches" role="list" aria-label="颜色选项">
      {APPEARANCE_SWATCHES.map((color) => {
        const normalized = normalizeHex(color) ?? color.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            role="listitem"
            className={`style-popover__swatch${normalized === normalizedSelected ? " is-selected" : ""}`}
            style={{ background: color }}
            onClick={() => onPick(color)}
            aria-label={`选择颜色 ${color}`}
          />
        );
      })}
      <label className="style-popover__swatch style-popover__swatch--custom" aria-label="自定义颜色">
        <input type="color" defaultValue={selected === "mixed" ? "#5fa1ef" : selected} onChange={(event) => onPick(event.target.value)} />
      </label>
    </div>
  );
}
