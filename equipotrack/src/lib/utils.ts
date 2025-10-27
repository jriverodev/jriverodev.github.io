import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Equipment, InventoryItem, DesktopEquipment, InventoryItemForm } from "./definitions";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function parseEquipmentString(equipString: string): Equipment | undefined {
  if (!equipString || equipString.toUpperCase() === 'NO APLICA' || equipString.toUpperCase() === 'N/A') {
    return undefined;
  }
  const parts = equipString.split('/').map(part => part.trim());
  const [marca, modelo, serial, etiqueta, status, obs] = parts;
  const result: Equipment = {};
  if (marca && marca !== 'SIN INFORMACION') result.marca = marca;
  if (modelo && modelo !== 'SIN INFORMACION') result.modelo = modelo;
  if (serial && serial !== 'SIN INFORMACION') result.serial = serial;
  if (etiqueta && etiqueta !== 'SIN INFORMACION') result.etiqueta = etiqueta;
  if (status && status !== 'SIN INFORMACION') result.status = status;
  if (obs && obs !== 'SIN INFORMACION' && obs.trim() !== '-') result.obs = obs;
  
  return Object.keys(result).length > 0 ? result : undefined;
}


function parseDesktopString(desktopString: string): DesktopEquipment | undefined {
  if (!desktopString || desktopString.toUpperCase() === 'NO APLICA' || desktopString.toUpperCase() === 'N/A') {
    return undefined;
  }

  const components = desktopString.split(';').map(s => s.trim());
  const desktop: DesktopEquipment = {};

  components.forEach(compString => {
    const [type, ...rest] = compString.split(':');
    const data = rest.join(':').trim();
    const equipment = parseEquipmentString(data);
    if(equipment) {
      const typeLower = type.toLowerCase();
      if (typeLower.includes('cpu')) desktop.cpu = equipment;
      else if (typeLower.includes('monitor')) desktop.monitor = equipment;
      else if (typeLower.includes('teclado')) desktop.teclado = equipment;
      else if (typeLower.includes('mouse')) desktop.mouse = equipment;
      else if (typeLower.includes('teléfono')) desktop.telefono = equipment;
    }
  });

  return Object.keys(desktop).length > 0 ? desktop : undefined;
}


export function parseCSVRow(row: any): InventoryItemForm {
  return {
    responsable: row.Responsable || '',
    cedula: row.Cédula || '',
    cargo: row.Cargo || '',
    sector: row.Sector || '',
    statusGeneral: row['Status General'] as InventoryItem['statusGeneral'] || 'OPERATIVO',
    equipo1: { laptop: parseEquipmentString(row.Laptop) },
    equipo2: { escritorio: parseDesktopString(row.Escritorio) },
    obsGenerales: row['Obs Generales'] || '',
  };
}


export function formatEquipment(equipment: Equipment | undefined): string {
  if (!equipment || Object.keys(equipment).length === 0) return 'N/A';
  
  const values = Object.values(equipment).filter(v => v);
  if(values.length === 0) return 'N/A';

  const parts = [
    equipment.marca,
    equipment.modelo,
    equipment.serial,
    equipment.etiqueta,
    equipment.status,
    equipment.obs,
  ].map(p => (p || 'S/I').trim()); // S/I for 'Sin Información'
  return parts.join('/');
}

export function formatDesktopEquipment(desktop: DesktopEquipment | undefined): string {
  if (!desktop || Object.keys(desktop).length === 0) return 'N/A';
  
  const parts = [];
  if (desktop.cpu && Object.keys(desktop.cpu).length > 0) parts.push(`CPU: ${formatEquipment(desktop.cpu)}`);
  if (desktop.monitor && Object.keys(desktop.monitor).length > 0) parts.push(`Monitor: ${formatEquipment(desktop.monitor)}`);
  if (desktop.teclado && Object.keys(desktop.teclado).length > 0) parts.push(`Teclado: ${formatEquipment(desktop.teclado)}`);
  if (desktop.mouse && Object.keys(desktop.mouse).length > 0) parts.push(`Mouse: ${formatEquipment(desktop.mouse)}`);
  if (desktop.telefono && Object.keys(desktop.telefono).length > 0) parts.push(`Teléfono: ${formatEquipment(desktop.telefono)}`);
  
  return parts.length > 0 ? parts.join('; ') : 'N/A';
}


export function exportToCSV(data: InventoryItem[], fileName: string) {
  const headers = 'Responsable,Cédula,Cargo,Sector,Status General,Laptop,Escritorio,Obs Generales\n';
  const rows = data.map(item => 
    [
      `"${item.responsable || ''}"`,
      `"${item.cedula || ''}"`,
      `"${item.cargo || ''}"`,
      `"${item.sector || ''}"`,
      `"${item.statusGeneral || ''}"`,
      `"${formatEquipment(item.equipo1?.laptop)}"`,
      `"${formatDesktopEquipment(item.equipo2?.escritorio)}"`,
      `"${item.obsGenerales || ''}"`
    ].join(',')
  ).join('\n');

  const csv = headers + rows;
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
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
