import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function ChartHistory({ chart }: { chart: { week: string; rank: number; score: number; people: number; momentum: number; i: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chart}>
        <defs><linearGradient id="score"><stop offset="0%" stopColor="var(--primary)" stopOpacity={.5} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="week" stroke="var(--muted-foreground)" fontSize={11} />
        <YAxis reversed domain={[1, 100]} stroke="var(--muted-foreground)" fontSize={11} />
        <Tooltip contentStyle={{ background: "var(--card)", borderColor: "var(--border)", borderRadius: 8 }} />
        <Area dataKey="rank" name="Rank" stroke="var(--primary)" fill="url(#score)" strokeWidth={3} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
