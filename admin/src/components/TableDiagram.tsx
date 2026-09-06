import { useEffect, useRef, useState, type ReactNode } from "react";
import { tableLayout } from "../domain/tableLayout";
import type { SeatingTable } from "../domain/types";

export function TableDiagram({ table, expanded = false, renderSeat }: {
  table: SeatingTable;
  expanded?: boolean;
  renderSeat: (number: number) => ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(400);
  const [zoom, setZoom] = useState(1);
  const layout = tableLayout(table, expanded);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const fitScale = Math.min(1, availableWidth / layout.width);
  const scale = expanded ? 1 : Math.min(2, fitScale * zoom);
  return (
    <>
      {!expanded && fitScale < 1 && <div className="diagram-zoom" role="group" aria-label={`Zoom ${table.name}`}>
        <button type="button" className="text-button" disabled={scale >= 2} onClick={() => setZoom(zoom * 1.5)}>Zoom in</button>
        <button type="button" className="text-button" disabled={zoom === 1} onClick={() => setZoom(1)}>Fit table</button>
      </div>}
      <div ref={container} className={`diagram-viewport${expanded ? " is-expanded" : ""}`} tabIndex={0} aria-label={`Seating around ${table.name}`}>
        <div style={{ width: layout.width * scale, height: layout.height * scale }}>
          <div className="table-diagram" style={{ width: layout.width, height: layout.height, transform: `scale(${scale})` }}>
            <div className={`table-surface surface-${table.shape}`} style={layout.surface} aria-hidden="true">
              <span>Table {table.number}</span><strong>{table.name}</strong><small>Clockwise seating ↻</small>
            </div>
            {layout.seats.map((position) => (
              <div className="physical-seat" key={position.number} style={{ left: position.x, top: position.y, width: layout.seatWidth, height: layout.seatHeight }}>
                {renderSeat(position.number)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
