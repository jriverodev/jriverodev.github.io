"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { InventoryItem } from "@/lib/definitions";
import { formatEquipment, getStatusBadgeClass, cn, formatDesktopEquipment } from "@/lib/utils";
import { FilePenLine, MoreVertical, Trash2, ArrowUpDown } from "lucide-react";
import { InventoryDialog } from "./inventory-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteInventoryItem } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "./ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InventoryTableProps {
  items: InventoryItem[];
  loading: boolean;
  onRefresh: () => void;
}

type SortKey = keyof InventoryItem | 'laptop' | 'escritorio';

export default function InventoryTable({ items, loading, onRefresh }: InventoryTableProps) {
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const { toast } = useToast();
  const router = useRouter();

  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof InventoryItem];
        const bValue = b[sortConfig.key as keyof InventoryItem];

        if (aValue == null) return 1;
        if (bValue == null) return -1;

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedItems.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);

  const requestSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    const result = await deleteInventoryItem(deletingItem.id);
    if (result.success) {
      toast({ title: "Éxito", description: result.message });
      onRefresh();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setDeletingItem(null);
  };

  const handleRowClick = (item: InventoryItem, e: React.MouseEvent<HTMLTableRowElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-radix-dropdown-menu-trigger]') || target.closest('[data-radix-dropdown-menu-content]')) {
      return;
    }
    router.push(`/item/${item.id}`);
  };

  const renderSortArrow = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Button variant="ghost" onClick={() => requestSort('responsable')}>Responsable{renderSortArrow('responsable')}</Button></TableHead>
              <TableHead><Button variant="ghost" onClick={() => requestSort('cedula')}>Cédula{renderSortArrow('cedula')}</Button></TableHead>
              <TableHead><Button variant="ghost" onClick={() => requestSort('cargo')}>Cargo{renderSortArrow('cargo')}</Button></TableHead>
              <TableHead><Button variant="ghost" onClick={() => requestSort('sector')}>Sector{renderSortArrow('sector')}</Button></TableHead>
              <TableHead><Button variant="ghost" onClick={() => requestSort('statusGeneral')}>Status{renderSortArrow('statusGeneral')}</Button></TableHead>
              <TableHead>Laptop</TableHead>
              <TableHead>Escritorio</TableHead>
              <TableHead>Obs. Generales</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={9}><Skeleton className="h-8 w-full" /></TableCell>
                </TableRow>
              ))
            ) : paginatedItems.length > 0 ? (
              paginatedItems.map((item) => (
                <TableRow key={item.id} onClick={(e) => handleRowClick(item, e)} className="cursor-pointer">
                  <TableCell className="font-medium">{item.responsable}</TableCell>
                  <TableCell>{item.cedula}</TableCell>
                  <TableCell>{item.cargo}</TableCell>
                  <TableCell>{item.sector}</TableCell>
                  <TableCell>
                    <Badge className={cn(getStatusBadgeClass(item.statusGeneral))}>{item.statusGeneral}</Badge>
                  </TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate">{formatEquipment(item.equipo1?.laptop)}</TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate">{formatDesktopEquipment(item.equipo2?.escritorio)}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{item.obsGenerales}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(item); }}><FilePenLine className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeletingItem(item); }} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">No se encontraron resultados.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between py-4">
        <div className="text-sm text-muted-foreground">
          Total {items.length} registros.
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm">Filas por página:</span>
          <Select value={String(itemsPerPage)} onValueChange={(value) => setItemsPerPage(Number(value))}>
            <SelectTrigger className="w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 40, 50].map(size => (
                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm">Página {currentPage} de {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>{"<<"}</Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>{"<"}</Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>{">"}</Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>{">>"}</Button>
        </div>
      </div>
      {editingItem && (
        <InventoryDialog
          isOpen={!!editingItem}
          setIsOpen={(open) => !open && setEditingItem(null)}
          item={editingItem}
          onSuccess={() => { setEditingItem(null); onRefresh(); }}
        />
      )}
      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el registro de <span className="font-bold">{deletingItem?.responsable}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
