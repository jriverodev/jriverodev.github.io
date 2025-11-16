"use client";

import { useMemo } from "react";
import { Pie, PieChart, Cell, Tooltip } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import type { InventoryItem } from "@/lib/definitions";

const COLORS: { [key: string]: string } = {
  OPERATIVO: "hsl(var(--chart-2))",
  INOPERATIVO: "hsl(var(--destructive))",
  ROBADO: "hsl(var(--chart-4))",
  MIXTO: "hsl(var(--chart-5))",
};

export default function StatusChart({ items }: { items: InventoryItem[] }) {
  const chartData = useMemo(() => {
    const statusCounts = items.reduce((acc, item) => {
      acc[item.statusGeneral] = (acc[item.statusGeneral] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    return Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
      fill: COLORS[name] || "hsl(var(--muted))",
    }));
  }, [items]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado de Equipos</CardTitle>
        <CardDescription>Distribución de equipos por estado general.</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ChartContainer config={{}} className="mx-auto aspect-square max-h-[300px]">
            <PieChart>
              <Tooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                strokeWidth={5}
              >
                  {chartData.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                  ))}
              </Pie>
               <ChartLegend
                content={<ChartLegendContent nameKey="name" />}
                className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
              />
            </PieChart>
          </ChartContainer>
        ) : (
          <div className="flex justify-center items-center h-[300px] text-muted-foreground">
            No hay datos para mostrar.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
