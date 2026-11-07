"use client";

import React, { useMemo, useState } from "react";
import { AgentReceipt, AccountFinancialSummary } from "@/types/receipt";
import { NEAR_USD_ESTIMATE } from "@/lib/near";
import { TrendingUp, PieChart, Activity, Layers, ArrowUpRight } from "lucide-react";

interface SpendingChartsProps {
  receipts: AgentReceipt[];
  summary: AccountFinancialSummary | null;
}

const CATEGORY_COLORS = [
  "#3978F6", // Primary blue
  "#20B486", // Emerald fintech
  "#8B5CF6", // Violet
  "#F0A83B", // Amber
  "#06B6D4", // Cyan
  "#EC4899", // Magenta/pink
];

// Generates a smooth cubic Bézier spline through all points
function createSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    const dx = points[1].x - points[0].x;
    return `M ${points[0].x} ${points[0].y} C ${points[0].x + dx * 0.4} ${points[0].y}, ${points[1].x - dx * 0.4} ${points[1].y}, ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    // Catmull-Rom to Cubic Bézier control points
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export default function SpendingCharts({ receipts, summary }: SpendingChartsProps) {
  const [selectedPoint, setSelectedPoint] = useState<{
    date: string;
    amount: number;
    count: number;
  } | null>(null);

  // 1. Compute real daily/chronological outgoing trend data
  const trendData = useMemo(() => {
    const outgoing = receipts
      .filter((r) => r.direction === "OUTGOING" && r.status === "SUCCESS")
      .sort((a, b) => a.blockTimestamp - b.blockTimestamp);

    if (outgoing.length === 0) return [];

    // Group by date (YYYY-MM-DD)
    const grouped: Record<string, { date: string; amount: number; count: number }> = {};
    outgoing.forEach((r) => {
      const d = new Date(r.blockTimestamp).toISOString().split("T")[0];
      if (!grouped[d]) {
        grouped[d] = { date: d, amount: 0, count: 0 };
      }
      grouped[d].amount += r.amountNear;
      grouped[d].count += 1;
    });

    return Object.values(grouped);
  }, [receipts]);

  // Compute SVG coordinates with smooth cubic Bézier spline
  const svgMetrics = useMemo(() => {
    if (trendData.length === 0) return null;

    const width = 520;
    const height = 170;
    const paddingX = 28;
    const paddingY = 22;

    const maxAmount = Math.max(...trendData.map((d) => d.amount), 0.05);
    const minAmount = 0;

    const points = trendData.map((d, index) => {
      const x =
        trendData.length > 1
          ? paddingX + (index / (trendData.length - 1)) * (width - 2 * paddingX)
          : width / 2;
      const y =
        height -
        paddingY -
        ((d.amount - minAmount) / (maxAmount - minAmount || 1)) * (height - 2 * paddingY);
      return { x, y, ...d };
    });

    const linePath = createSmoothPath(points);
    const firstX = points.length === 1 ? paddingX : points[0].x;
    const lastX = points.length === 1 ? width - paddingX : points[points.length - 1].x;
    const areaPath = `${linePath} L ${lastX} ${height} L ${firstX} ${height} Z`;

    const peakAmount = Math.max(...trendData.map((d) => d.amount));
    const totalTrendNear = trendData.reduce((acc, d) => acc + d.amount, 0);

    return { width, height, points, linePath, areaPath, maxAmount, peakAmount, totalTrendNear };
  }, [trendData]);

  // 2. Compute spending distribution by Agent or Category
  const categoryData = useMemo(() => {
    const outgoing = receipts.filter(
      (r) => r.direction === "OUTGOING" && r.status === "SUCCESS"
    );

    const totalOut = outgoing.reduce((acc, r) => acc + r.amountNear, 0);
    if (totalOut === 0) return [];

    const grouped: Record<
      string,
      { label: string; amount: number; count: number; category: string }
    > = {};

    outgoing.forEach((r) => {
      const label =
        r.attribution?.agentName ||
        r.attribution?.category ||
        r.evidence?.inferences?.purposeTitle ||
        "Direct Protocol Transfers";

      if (!grouped[label]) {
        grouped[label] = {
          label,
          amount: 0,
          count: 0,
          category: r.attribution?.category || "General",
        };
      }
      grouped[label].amount += r.amountNear;
      grouped[label].count += 1;
    });

    return Object.values(grouped)
      .map((item, idx) => ({
        ...item,
        percentage: Number(((item.amount / totalOut) * 100).toFixed(1)),
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [receipts]);

  const totalOutgoingNear = summary?.totalOutgoingNear || 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Chart 1: Spending Trend */}
      <div className="group rounded-2xl bg-[#0D1627]/85 backdrop-blur-sm border border-[#1A2840] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] p-5 sm:p-6 flex flex-col justify-between transition-all duration-200 hover:border-[#273B5E] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/[0.06] relative overflow-hidden">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-[#3978F6] shadow-[0_0_8px_rgba(57,120,246,0.6)]" />
                <h3 className="text-base font-bold text-white tracking-tight">Spending Trend</h3>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                On-chain outgoing transfer volume over time
              </p>
            </div>
            <div className="text-right">
              <span className="font-mono font-extrabold text-base sm:text-lg text-white tabular-nums tracking-tight">
                {totalOutgoingNear.toFixed(2)} NEAR
              </span>
              <span className="text-[11px] text-[#64748B] block tabular-nums">
                ≈ ${(totalOutgoingNear * NEAR_USD_ESTIMATE).toFixed(2)} USD
              </span>
            </div>
          </div>

          {/* SVG Area Chart */}
          <div className="mt-4 relative bg-[#080E1C]/90 rounded-xl border border-[#162338] p-3.5 overflow-hidden">
            {svgMetrics && svgMetrics.points.length > 0 ? (
              <div>
                <svg
                  viewBox={`0 0 ${svgMetrics.width} ${svgMetrics.height}`}
                  className="w-full h-44 overflow-visible"
                >
                  <defs>
                    <linearGradient id="spendingAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3978F6" stopOpacity="0.35" />
                      <stop offset="60%" stopColor="#3978F6" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#3978F6" stopOpacity="0.0" />
                    </linearGradient>
                    <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#3978F6" floodOpacity="0.45" />
                    </filter>
                  </defs>

                  {/* Subtle Grid Lines */}
                  <line
                    x1="12"
                    y1="40"
                    x2={svgMetrics.width - 12}
                    y2="40"
                    stroke="#162338"
                    strokeDasharray="4 4"
                    strokeOpacity="0.8"
                  />
                  <line
                    x1="12"
                    y1="90"
                    x2={svgMetrics.width - 12}
                    y2="90"
                    stroke="#162338"
                    strokeDasharray="4 4"
                    strokeOpacity="0.8"
                  />
                  <line
                    x1="12"
                    y1="140"
                    x2={svgMetrics.width - 12}
                    y2="140"
                    stroke="#162338"
                    strokeDasharray="4 4"
                    strokeOpacity="0.8"
                  />

                  {/* Smooth Area Gradient Fill */}
                  <path d={svgMetrics.areaPath} fill="url(#spendingAreaGrad)" />

                  {/* Glowing Smooth Cubic Spline Line */}
                  <path
                    d={svgMetrics.linePath}
                    fill="none"
                    stroke="#3978F6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glowEffect)"
                  />

                  {/* Interactive Points */}
                  {svgMetrics.points.map((pt, idx) => {
                    const isSelected = selectedPoint?.date === pt.date;
                    return (
                      <g key={idx}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isSelected ? 6 : 4}
                          className="fill-[#3978F6] stroke-[#080D19] stroke-2 cursor-pointer transition-all hover:scale-125"
                          onMouseEnter={() =>
                            setSelectedPoint({
                              date: pt.date,
                              amount: pt.amount,
                              count: pt.count,
                            })
                          }
                        />
                        {isSelected && (
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={9}
                            className="fill-none stroke-[#3978F6]/40 stroke-1 animate-ping pointer-events-none"
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* X-axis date labels & Interactive Tooltip Banner */}
                <div className="flex items-center justify-between text-[11px] text-[#64748B] font-mono mt-2 pt-2.5 border-t border-[#162338]">
                  <span>{svgMetrics.points[0]?.date}</span>
                  {selectedPoint ? (
                    <span className="font-semibold text-[#60A5FA] bg-[#3978F6]/10 px-2.5 py-0.5 rounded-full border border-[#3978F6]/25 animate-fadeIn">
                      {selectedPoint.date}: {selectedPoint.amount.toFixed(2)} NEAR ({selectedPoint.count} txs)
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#475569] font-sans">
                      Hover points for daily breakdown
                    </span>
                  )}
                  <span>{svgMetrics.points[svgMetrics.points.length - 1]?.date}</span>
                </div>
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-center text-xs text-[#94A3B8] space-y-1.5">
                <Activity className="w-5 h-5 text-[#475569] stroke-[1.8]" />
                <span className="font-medium text-[#CBD5E1]">No outgoing spending activity recorded yet.</span>
                <span className="text-[11px] text-[#64748B] max-w-sm">
                  Confirmed on-chain transactions will render your activity curve here.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Stats */}
        <div className="mt-4 pt-3.5 border-t border-[#162338] grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-[#64748B] text-[11px] block">Analyzed Activity</span>
            <span className="font-semibold text-[#F8FAFC]">
              {receipts.filter((r) => r.direction === "OUTGOING" && r.status === "SUCCESS").length}{" "}
              verified outlays
            </span>
          </div>
          <div>
            <span className="text-[#64748B] text-[11px] block">Peak Daily Outlay</span>
            <span className="font-semibold font-mono text-[#F8FAFC]">
              {svgMetrics?.peakAmount ? `${svgMetrics.peakAmount.toFixed(2)} NEAR` : "0.00 NEAR"}
            </span>
          </div>
        </div>
      </div>

      {/* Chart 2: Spending by Agent or Category */}
      <div className="group rounded-2xl bg-[#0D1627]/85 backdrop-blur-sm border border-[#1A2840] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] p-5 sm:p-6 flex flex-col justify-between transition-all duration-200 hover:border-[#273B5E] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/[0.06] relative overflow-hidden">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-[#20B486] shadow-[0_0_8px_rgba(32,180,134,0.6)]" />
                <h3 className="text-base font-bold text-white tracking-tight">Spending by Category</h3>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Task attribution and disbursement distribution
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[#20B486] bg-[#20B486]/10 px-2.5 py-1 rounded-full border border-[#20B486]/25">
              {categoryData.length} active
            </span>
          </div>

          {/* Stacked Progress Bar */}
          <div className="mt-4">
            <div className="w-full h-3 rounded-full bg-[#080E1C] overflow-hidden flex border border-[#162338] shadow-inner p-0.5">
              {categoryData.length > 0 ? (
                categoryData.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                    }}
                    title={`${item.label}: ${item.amount.toFixed(2)} NEAR (${item.percentage}%)`}
                    className="h-full rounded-sm transition-all first:rounded-l-full last:rounded-r-full"
                  />
                ))
              ) : (
                <div className="w-full h-full bg-[#162338] rounded-full" />
              )}
            </div>
          </div>

          {/* Itemized Legend List */}
          <div className="mt-4 space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {categoryData.length > 0 ? (
              categoryData.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#080E1C]/80 border border-[#162338] text-xs hover:border-[#233758] hover:bg-[#0D1627] transition-colors"
                >
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="min-w-0">
                      <span className="font-semibold text-[#F8FAFC] truncate block">
                        {item.label}
                      </span>
                      <span className="text-[10px] text-[#64748B] block">
                        {item.count} transaction{item.count === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-[#F8FAFC] block tabular-nums">
                      {item.amount < 0.01 ? item.amount.toFixed(4) : item.amount.toFixed(2)} NEAR
                    </span>
                    <span className="text-[10px] text-[#20B486] font-medium block">
                      {item.percentage}% of total
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-[#94A3B8]">
                <PieChart className="w-5 h-5 text-[#475569] mx-auto stroke-[1.8] mb-1.5" />
                <span className="text-[#CBD5E1] font-medium">No categorized agent spending found.</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-4 pt-3.5 border-t border-[#162338] flex items-center justify-between text-xs text-[#64748B]">
          <span>Attributed via cryptographic consensus</span>
          <span className="text-[#20B486] font-medium flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20B486]" />
            <span>100% On-chain Verified</span>
          </span>
        </div>
      </div>
    </div>
  );
}
