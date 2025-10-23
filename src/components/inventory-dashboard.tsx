"use client";

import { useState, useMemo, startTransition, useEffect } from "react";
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
  Trash2,
  Upload,
} from "lucide-react";
import InventoryTable from "./inventory-table";
import StatusChart from "./status-chart";
import { InventoryDialog } from "./inventory-dialog";
import { ImportDialog } from "./import-dialog";
import { exportToCSV } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "./ui/card";
import { deleteAllInventoryItems, getInventoryItems } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

export default function InventoryDashboard() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);

  const router = useRouter();
  const { toast } = useToast();

  const fetchItems = async () => {
    setIsLoading(true);
    const fetchedItems = await getInventoryItems();
    setItems(fetchedItems);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);
  
  const sectors = useMemo(
    () => ["all", ...Array.from(new Set(items.map((item) => item.sector).filter(Boolean)))],
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
      fetchItems();
      router.refresh();
      setIsRefreshing(false);
    });
  };

  const handleDeleteAll = async () => {
    const result = await deleteAllInventoryItems();
    if (result.success) {
      toast({ title: "Éxito", description: result.message });
      fetchItems();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsDeleteAllOpen(false);
  };

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setIsDialogOpen(true)}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Agregar Fila
                  </Button>
                  <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" /> Importar CSV
                  </Button>
                  <Button variant="outline" onClick={() => exportToCSV(filteredItems, 'inventario.csv')}>
                      <Download className="mr-2 h-4 w-4" /> Exportar CSV
                  </Button>
                  <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
                      <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      Cargar Datos
                  </Button>
                  <Button variant="destructive" onClick={() => setIsDeleteAllOpen(true)} disabled={items.length === 0}>
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar Todo
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
                <InventoryTable items={filteredItems} loading={isLoading} onRefresh={fetchItems} />
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
          onSuccess={fetchItems}
        />
        <ImportDialog
          isOpen={isImportOpen}
          setIsOpen={setIsImportOpen}
          onSuccess={fetchItems}
        />
      </div>

      <AlertDialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente
              todos los registros de inventario de tu base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll}>Sí, eliminar todo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
