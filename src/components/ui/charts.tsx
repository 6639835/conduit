"use client";

import * as React from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "./card";
import { cn } from "@/lib/utils/cn";

// Color palette for charts
const CHART_COLORS = [
  "#10b981", // accent/success (green)
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // destructive (red)
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];

interface ChartWrapperProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

const ChartWrapper = ({
  title,
  description,
  children,
  className,
}: ChartWrapperProps) => {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle className="text-lg">{title}</CardTitle>}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </CardHeader>
      )}
      <CardContent className={cn(!title && !description && "pt-6")}>
        {children}
      </CardContent>
    </Card>
  );
};

// Line/Area Chart for usage over time
interface UsageChartProps {
  data: Array<{
    date: string;
    value: number;
    [key: string]: string | number;
  }>;
  title?: string;
  description?: string;
  dataKey?: string;
  type?: "line" | "area";
  height?: number;
  className?: string;
}

const UsageChart = ({
  data,
  title,
  description,
  dataKey = "value",
  type = "area",
  height = 300,
  className,
}: UsageChartProps) => {
  const Chart = type === "area" ? AreaChart : LineChart;

  return (
    <ChartWrapper title={title} description={description} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <Chart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            className="text-xs"
            tick={{ fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            className="text-xs"
            tick={{ fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "var(--foreground)" }}
          />
          {type === "area" ? (
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorValue)"
            />
          ) : (
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: "#10b981" }}
            />
          )}
        </Chart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
};

// Stacked Bar Chart for provider/model breakdown
interface StackedBarChartProps {
  data: Array<Record<string, string | number>>;
  title?: string;
  description?: string;
  categories: string[];
  height?: number;
  className?: string;
}

const StackedBarChart = ({
  data,
  title,
  description,
  categories,
  height = 300,
  className,
}: StackedBarChartProps) => {
  return (
    <ChartWrapper title={title} description={description} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="name"
            className="text-xs"
            tick={{ fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            className="text-xs"
            tick={{ fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "var(--foreground)" }}
          />
          <Legend />
          {categories.map((category, index) => (
            <Bar
              key={category}
              dataKey={category}
              stackId="a"
              fill={CHART_COLORS[index % CHART_COLORS.length]}
              radius={index === categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
};

// Pie/Doughnut Chart for distribution
interface PieChartData {
  name: string;
  value: number;
  [key: string]: string | number;
}

interface DonutChartProps {
  data: PieChartData[];
  title?: string;
  description?: string;
  height?: number;
  showLegend?: boolean;
  innerRadius?: number;
  className?: string;
}

const DonutChart = ({
  data,
  title,
  description,
  height = 300,
  showLegend = true,
  innerRadius = 60,
  className,
}: DonutChartProps) => {
  return (
    <ChartWrapper title={title} description={description} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value) => (value ?? 0).toLocaleString()}
          />
          {showLegend && <Legend />}
        </PieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
};

// Multi-line chart for comparing multiple metrics
interface MultiLineChartProps {
  data: Array<Record<string, string | number>>;
  title?: string;
  description?: string;
  lines: Array<{
    key: string;
    name: string;
    color?: string;
  }>;
  height?: number;
  className?: string;
}

const MultiLineChart = ({
  data,
  title,
  description,
  lines,
  height = 300,
  className,
}: MultiLineChartProps) => {
  return (
    <ChartWrapper title={title} description={description} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            className="text-xs"
            tick={{ fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            className="text-xs"
            tick={{ fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "var(--foreground)" }}
          />
          <Legend />
          {lines.map((line, index) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color || CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
};

export {
  ChartWrapper,
  UsageChart,
  StackedBarChart,
  DonutChart,
  MultiLineChart,
  CHART_COLORS,
};
