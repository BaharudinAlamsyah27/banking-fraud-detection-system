"use client";

import React from "react";
import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
  ),
});

interface EChartBoxProps {
  option: Record<string, unknown>;
  height?: number | string;
}

export function EChartBox({ option, height = 260 }: EChartBoxProps) {
  return (
    <div style={{ height }} className="w-full">
      <ReactECharts
        option={option}
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "svg" }}
        notMerge={true}
      />
    </div>
  );
}
