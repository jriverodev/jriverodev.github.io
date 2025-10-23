"use client";

import { useState } from "react";
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
import { FilePenLine, MoreVertical, Trash2 } from "lucide-react";
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

interface InventoryTableProps {
  items: InventoryItem[];
  loading: boolean;
  onRefresh: () => void;
}

export default function InventoryTable({ items, loading, onRefresh }: InventoryTableProps) {
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const { toast } = useToast();

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

  return (
    <>
      <div className="relative w-full overflow-auto max-h-[70vh]">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead>Responsable</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead>Status</TableHead>
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
                  <TableCell colSpan={9}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length > 0 ? (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.responsable}</TableCell>
                  <TableCell>{item.cedula}</TableCell>
                  <TableCell>{item.cargo}</TableCell>
                  <TableCell>{item.sector}</TableCell>
                  <TableCell>
                    <Badge className={cn(getStatusBadgeClass(item.statusGeneral))}>
                      {item.statusGeneral}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{formatEquipment(item.equipo1?.laptop)}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{formatDesktopEquipment(item.equipo2?.escritorio)}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{item.obsGenerales}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(item)}>
                          <FilePenLine className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeletingItem(item)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                  No se encontraron resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {editingItem && (
        <InventoryDialog
          isOpen={!!editingItem}
          setIsOpen={(open) => {
            if (!open) setEditingItem(null);
          }}
          item={editingItem}
          onSuccess={() => {
            setEditingItem(null);
            onRefresh();
          }}
        />
      )}
      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el registro de
              <span className="font-bold"> {deletingItem?.responsable}</span>.
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
