import { useId, useState } from 'react';

/**
 * Daily counts as bars.
 *
 * Meetings and participants are plotted as two of these rather than one chart
 * with two y-axes: they are different measures on different scales, and a dual
 * axis lets the reader invent a relationship between them that the data does
 * not support.
 *
 * The hue is categorical slot 1 from the project's validated palette. There is
 * one series per chart, so the title names it and no legend is needed.
 */

const SERIES_COLOR = '#2a78d6';
const WIDTH = 360;
const HEIGHT = 120;
const BASELINE = HEIGHT - 18;
const GAP = 2;

function shortDay(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString([], { weekday: 'short' });
}

export default function TrendChart({ title, data, valueKey, unit }) {
  const [hovered, setHovered] = useState(null);
  const tableId = useId();

  const points = data ?? [];
  const values = points.map((point) => point[valueKey] ?? 0);
  const max = Math.max(1, ...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  const peakIndex = values.indexOf(Math.max(...values));

  const columnWidth = points.length > 0 ? WIDTH / points.length : WIDTH;
  const barWidth = Math.max(4, columnWidth - GAP * 2);

  return (
    <figure className="m-0">
      <figcaption className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="text-xs text-slate-500">
          {total} {unit} over {points.length} days
        </span>
      </figcaption>

      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full"
          role="img"
          aria-labelledby={tableId}
        >
          {/* A single recessive baseline; no grid competing with the bars. */}
          <line
            x1="0"
            y1={BASELINE + 0.5}
            x2={WIDTH}
            y2={BASELINE + 0.5}
            stroke="#e2e8f0"
            strokeWidth="1"
          />

          {points.map((point, index) => {
            const value = point[valueKey] ?? 0;
            const height = value === 0 ? 0 : Math.max(3, (value / max) * (BASELINE - 14));
            const x = index * columnWidth + GAP;
            const y = BASELINE - height;
            const active = hovered === index;

            return (
              <g key={point.date}>
                {height > 0 && (
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={height}
                    rx="3"
                    fill={SERIES_COLOR}
                    opacity={hovered === null || active ? 1 : 0.45}
                  />
                )}

                {/* Only the peak is labelled, so the chart stays readable. */}
                {index === peakIndex && value > 0 && !active && (
                  <text
                    x={x + barWidth / 2}
                    y={y - 4}
                    textAnchor="middle"
                    className="fill-slate-500"
                    fontSize="9"
                  >
                    {value}
                  </text>
                )}

                <text
                  x={x + barWidth / 2}
                  y={HEIGHT - 4}
                  textAnchor="middle"
                  className="fill-slate-400"
                  fontSize="9"
                >
                  {shortDay(point.date)}
                </text>

                {/* The hit target is the whole column, not the bar. */}
                <rect
                  x={index * columnWidth}
                  y="0"
                  width={columnWidth}
                  height={HEIGHT}
                  fill="transparent"
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                />
              </g>
            );
          })}
        </svg>

        {hovered !== null && points[hovered] && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{
              left: `${((hovered + 0.5) / points.length) * 100}%`,
              top: '0',
            }}
          >
            <span className="block font-semibold">{points[hovered][valueKey] ?? 0} {unit}</span>
            <span className="block text-white/70">{points[hovered].date}</span>
          </div>
        )}
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
          View data
        </summary>
        <table id={tableId} className="mt-2 w-full text-left text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="py-1 font-medium">Date</th>
              <th className="py-1 font-medium">{title}</th>
            </tr>
          </thead>
          <tbody className="text-slate-600">
            {points.map((point) => (
              <tr key={point.date}>
                <td className="py-0.5">{point.date}</td>
                <td className="py-0.5">{point[valueKey] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
