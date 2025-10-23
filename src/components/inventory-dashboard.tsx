"use client";

import { useState, useMemo, startTransition } from "react";
import type { InventoryItem } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  PlusCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import InventoryTable from "./inventory-table";
import StatusChart from "./status-chart";
import { InventoryDialog } from "./inventory-dialog";
import { exportToCSV } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "./ui/card";

export default function InventoryDashboard({
  initialItems,
}: {
  initialItems: InventoryItem[];
}) {
  const [items] = useState<InventoryItem[]>(initialItems);
  const [searchTerm, setSearchTerm] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const router = useRouter();

  const sectors = useMemo(
    () => ["all", ...Array.from(new Set(items.map((item) => item.sector)))],
    [items]
  );
  const statuses = ["all", "OPERATIVO", "INOPERATIVO", "ROBADO", "MIXTO"];

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(searchLower)
        ) ||
        (item.equipo1?.laptop && Object.values(item.equipo1.laptop).some(val => String(val).toLowerCase().includes(searchLower))) ||
        (item.equipo2?.escritorio && Object.values(item.equipo2.escritorio).some(val => String(val).toLowerCase().includes(searchLower)));

      const matchesSector =
        sectorFilter === "all" || item.sector === sectorFilter;
      const matchesStatus =
        statusFilter === "all" || item.statusGeneral === statusFilter;

      return matchesSearch && matchesSector && matchesStatus;
    });
  }, [items, searchTerm, sectorFilter, statusFilter]);
  
  const handleRefresh = () => {
    setIsRefreshing(true);
    startTransition(() => {
      router.refresh();
      setIsRefreshing(false);
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex flex-wrap gap-2">
                <Button onClick={() => setIsDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Agregar Fila
                </Button>
                <Button variant="outline" onClick={() => exportToCSV(filteredItems)}>
                    <Download className="mr-2 h-4 w-4" /> Exportar CSV
                </Button>
                <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Cargar Datos
                </Button>
            </div>
            <div className="flex flex-col sm:flex-row w-full md:w-auto gap-2">
                <div className="relative w-full md:w-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                      type="search"
                      placeholder="Buscar..."
                      className="pl-9 w-full md:w-[250px]"
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={sectorFilter} onValueChange={setSectorFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Filtrar por Sector" />
                    </SelectTrigger>
                    <SelectContent>
                        {sectors.map((sector) => (
                            <SelectItem key={sector} value={sector}>
                                {sector === "all" ? "Todos los Sectores" : sector}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Filtrar por Status" />
                    </SelectTrigger>
                    <SelectContent>
                        {statuses.map((status) => (
                            <SelectItem key={status} value={status}>
                                {status === "all" ? "Todos los Estados" : status}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>
      
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            <CardContent className="p-0">
              <InventoryTable items={filteredItems} />
            </CardContent>
          </Card>
        </div>
        <div className="md:col-span-1">
          <StatusChart items={items} />
        </div>
      </div>
      
      <InventoryDialog
        isOpen={isDialogOpen}
        setIsOpen={setIsDialogOpen}
      />
    </div>
  );
}
