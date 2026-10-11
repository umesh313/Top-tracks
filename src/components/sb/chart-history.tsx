// Zero-dependency rank-trend sparkline. Replaces recharts (~100 kB gz) — the
// chart is a single monotone rank line over weeks, which plain SVG draws fine.
type Point = {
  week: string;
  rank: number;
  score: number;
  people: number;
  momentum: number;
  i: number;
};

export default function ChartHistory({ chart }: { chart: Point[] }) {
  const W = 600;
  const H = 220;
  const PAD = { t: 12, r: 10, b: 26, l: 30 };
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;

  const points = chart.filter((d) => typeof d.rank === "number" && d.rank > 0);
  if (points.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        No rank history yet.
      </div>
    );
  }

  const n = points.length;
  // Rank: 1 at top, 100 at bottom. Single point sits mid-chart.
  const x = (i: number) => PAD.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (rank: number) => PAD.t + ((Math.min(100, Math.max(1, rank)) - 1) / 99) * ih;

  const line = points
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.rank).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${PAD.t + ih} L${x(0).toFixed(1)},${PAD.t + ih} Z`;
  const ticks = [1, 25, 50, 75, 100];
  // Show at most ~6 x labels so they never collide.
  const labelEvery = Math.max(1, Math.ceil(n / 6));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      role="img"
      aria-label={`Chart rank over ${n} week${n === 1 ? "" : "s"}`}
    >
      <defs>
        <linearGradient id="score" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <text
            x={PAD.l - 6}
            y={y(t) + 3}
            textAnchor="end"
            fontSize={10}
            fill="var(--muted-foreground)"
          >
            {t}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#score)" />
      <path
        d={line}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((d, i) => (
        <g key={d.i}>
          <circle cx={x(i)} cy={y(d.rank)} r={3} fill="var(--primary)" />
          <title>{`${d.week} — #${d.rank}`}</title>
        </g>
      ))}
      {points.map((d, i) =>
        i % labelEvery === 0 || i === n - 1 ? (
          <text
            key={`x${d.i}`}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize={10}
            fill="var(--muted-foreground)"
          >
            {d.week}
          </text>
        ) : null,
      )}
    </svg>
  );
}
