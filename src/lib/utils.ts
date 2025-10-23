import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Equipment, InventoryItem, DesktopEquipment } from "./definitions";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatEquipment(equipment: Equipment | undefined): string {
  if (!equipment) return 'N/A';
  const parts = [
    equipment.marca,
    equipment.modelo,
    equipment.serial,
    equipment.etiqueta,
    equipment.status,
    equipment.obs,
  ].map(p => p || 'N/A');
  return parts.join(' / ');
}

function formatDesktopEquipment(desktop: DesktopEquipment | undefined): string {
  if (!desktop) return 'N/A';
  
  const parts = [];
  if (desktop.cpu) parts.push(`CPU: ${formatEquipment(desktop.cpu)}`);
  if (desktop.monitor) parts.push(`Monitor: ${formatEquipment(desktop.monitor)}`);
  if (desktop.teclado) parts.push(`Teclado: ${formatEquipment(desktop.teclado)}`);
  if (desktop.mouse) parts.push(`Mouse: ${formatEquipment(desktop.mouse)}`);
  if (desktop.telefono) parts.push(`Teléfono: ${formatEquipment(desktop.telefono)}`);
  
  return parts.length > 0 ? parts.join('; ') : 'N/A';
}


export function exportToCSV(data: InventoryItem[]) {
  const headers = 'Responsable,Cédula,Cargo,Sector,Status General,Laptop,Escritorio,Obs Generales\n';
  const rows = data.map(item => 
    [
      `"${item.responsable}"`,
      `"${item.cedula}"`,
      `"${item.cargo}"`,
      `"${item.sector}"`,
      `"${item.statusGeneral}"`,
      `"${formatEquipment(item.equipo1?.laptop)}"`,
      `"${formatDesktopEquipment(item.equipo2?.escritorio)}"`,
      `"${item.obsGenerales}"`
    ].join(',')
  ).join('\n');

  const csv = headers + rows;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'inventario.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function getStatusBadgeClass(status: string | undefined): string {
  switch (status) {
    case 'OPERATIVO':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700';
    case 'INOPERATIVO':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700';
    case 'ROBADO':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700';
    case 'MIXTO':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}
