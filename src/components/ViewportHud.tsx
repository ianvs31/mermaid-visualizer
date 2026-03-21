interface ViewportHudProps {
  zoom: number;
  visible: boolean;
}

export function ViewportHud({ zoom, visible }: ViewportHudProps) {
  return (
    <div className={`viewport-hud${visible ? " is-visible" : ""}`} aria-live="polite">
      {Math.round(zoom * 100)}%
    </div>
  );
}
