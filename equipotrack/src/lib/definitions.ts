export type Equipment = {
  marca?: string;
  modelo?: string;
  serial?: string;
  etiqueta?: string;
  status?: string;
  obs?: string;
};

export type DesktopEquipment = {
  cpu?: Equipment;
  monitor?: Equipment;
  teclado?: Equipment;
  mouse?: Equipment;
  telefono?: Equipment;
}

export type InventoryItem = {
  id: string;
  responsable: string;
  cedula: string;
  cargo: string;
  sector: string;
  statusGeneral: "OPERATIVO" | "INOPERATIVO" | "ROBADO" | "MIXTO";
  equipo1?: { laptop?: Equipment };
  equipo2?: { escritorio?: DesktopEquipment };
  obsGenerales: string;
};

// Type for form data, without the 'id'
export type InventoryItemForm = Omit<InventoryItem, "id">;
