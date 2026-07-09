import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, EmptyState } from "@/components/ui-kit";
import { ngn } from "@/lib/format";

export type RangeKey = "7d" | "30d" | "90d" | "all";
export type AdminRangeKey = "today" | "7d" | "30d";
export type ChartDatum = Record<string, string | number | null | undefined>;

const palette = [
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-destructive)",
  "var(--color-primary-dark)",
  "var(--color-muted-foreground)",
];

const axisColor = "var(--color-muted-foreground)";
const gridColor = "var(--color-border)";

export function ChartCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="min-h-[20rem] p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function RangeTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex shrink-0 rounded-lg border border-border bg-card p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-md px-2 py-1 text-[11px] font-medium ${
            value === option.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function DonutChart({ data }: { data: { name: string; value: number }[] }) {
  const rows = data.filter((item) => item.value > 0);
  if (rows.length === 0) return <ChartEmpty />;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip formatter={(value) => Number(value).toLocaleString()} />
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
          >
            {rows.map((_, index) => (
              <Cell key={index} fill={palette[index % palette.length]} />
            ))}
          </Pie>
          <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VerticalBarChart({
  data,
  bars,
  currencyKeys = [],
}: {
  data: ChartDatum[];
  bars: { key: string; label: string }[];
  currencyKeys?: string[];
}) {
  if (
    !hasValues(
      data,
      bars.map((bar) => bar.key),
    )
  )
    return <ChartEmpty />;
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={gridColor} vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tick={{ fill: axisColor, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: axisColor, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={34}
          />
          <Tooltip
            formatter={(value, name) =>
              currencyKeys.includes(String(name))
                ? ngn(Number(value))
                : Number(value).toLocaleString()
            }
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {bars.map((bar, index) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              name={bar.label}
              fill={palette[index % palette.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({
  data,
  series,
}: {
  data: ChartDatum[];
  series: { key: string; label: string }[];
}) {
  if (
    !hasValues(
      data,
      series.map((item) => item.key),
    )
  )
    return <ChartEmpty />;
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={gridColor} vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tick={{ fill: axisColor, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: axisColor, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={34}
          />
          <Tooltip formatter={(value) => Number(value).toLocaleString()} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((item, index) => (
            <Area
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label}
              stroke={palette[index % palette.length]}
              fill={palette[index % palette.length]}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineBarChart({
  data,
  bars,
  lines,
}: {
  data: ChartDatum[];
  bars: { key: string; label: string }[];
  lines?: { key: string; label: string }[];
}) {
  const keys = [...bars.map((bar) => bar.key), ...(lines ?? []).map((line) => line.key)];
  if (!hasValues(data, keys)) return <ChartEmpty />;
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={gridColor} vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tick={{ fill: axisColor, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: axisColor, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={34}
          />
          <Tooltip formatter={(value) => Number(value).toLocaleString()} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {bars.map((bar, index) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              name={bar.label}
              fill={palette[index % palette.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
          {(lines ?? []).map((line, index) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.label}
              stroke={palette[(index + bars.length) % palette.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartEmpty() {
  return (
    <EmptyState title="No chart data yet" description="Data will appear here once records exist." />
  );
}

function hasValues(data: ChartDatum[], keys: string[]) {
  return data.some((row) => keys.some((key) => Number(row[key] ?? 0) > 0));
}
