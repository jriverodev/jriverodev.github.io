"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { InventoryItem } from "@/lib/definitions";
import { addInventoryItem, updateInventoryItem } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "./ui/separator";

const equipmentSchema = z.object({
  marca: z.string().optional(),
  modelo: z.string().optional(),
  serial: z.string().optional(),
  etiqueta: z.string().optional(),
  status: z.string().optional(),
  obs: z.string().optional(),
}).optional();

const desktopEquipmentSchema = z.object({
  cpu: equipmentSchema,
  monitor: equipmentSchema,
  teclado: equipmentSchema,
  mouse: equipmentSchema,
  telefono: equipmentSchema,
}).optional();


const formSchema = z.object({
  responsable: z.string().min(1, "Responsable es requerido."),
  cedula: z.string().min(1, "Cédula es requerida."),
  cargo: z.string().min(1, "Cargo es requerido."),
  sector: z.string().min(1, "Sector es requerido."),
  statusGeneral: z.enum(["OPERATIVO", "INOPERATIVO", "ROBADO", "MIXTO"]),
  equipo1: z.object({ laptop: equipmentSchema }).optional(),
  equipo2: z.object({ escritorio: desktopEquipmentSchema }).optional(),
  obsGenerales: z.string().optional(),
});

type InventoryFormValues = z.infer<typeof formSchema>;

interface InventoryDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  item?: InventoryItem | null;
  onSuccess: () => void;
}

const renderEquipmentFields = (form: any, basePath: string, label: string) => (
  <div className="space-y-4 rounded-md border p-4">
    <h4 className="font-semibold text-foreground">{label}</h4>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField control={form.control} name={`${basePath}.marca`} render={({ field }) => (<FormItem><FormLabel>Marca</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
      <FormField control={form.control} name={`${basePath}.modelo`} render={({ field }) => (<FormItem><FormLabel>Modelo</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
      <FormField control={form.control} name={`${basePath}.serial`} render={({ field }) => (<FormItem><FormLabel>Serial</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
      <FormField control={form.control} name={`${basePath}.etiqueta`} render={({ field }) => (<FormItem><FormLabel>Etiqueta</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
      <FormField control={form.control} name={`${basePath}.status`} render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
      <FormField control={form.control} name={`${basePath}.obs`} render={({ field }) => (<FormItem><FormLabel>Obs.</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
    </div>
  </div>
);

const getDefaultValues = (item: InventoryItem | null | undefined): InventoryFormValues => {
    const defaultEquipment = { marca: '', modelo: '', serial: '', etiqueta: '', status: '', obs: '' };
    const defaultDesktop = { cpu: defaultEquipment, monitor: defaultEquipment, teclado: defaultEquipment, mouse: defaultEquipment, telefono: defaultEquipment };

    if (item) {
        return {
            responsable: item.responsable || "",
            cedula: item.cedula || "",
            cargo: item.cargo || "",
            sector: item.sector || "",
            statusGeneral: item.statusGeneral || "OPERATIVO",
            equipo1: {
                laptop: { ...defaultEquipment, ...(item.equipo1?.laptop || {}) }
            },
            equipo2: {
                escritorio: {
                    cpu: { ...defaultEquipment, ...(item.equipo2?.escritorio?.cpu || {}) },
                    monitor: { ...defaultEquipment, ...(item.equipo2?.escritorio?.monitor || {}) },
                    teclado: { ...defaultEquipment, ...(item.equipo2?.escritorio?.teclado || {}) },
                    mouse: { ...defaultEquipment, ...(item.equipo2?.escritorio?.mouse || {}) },
                    telefono: { ...defaultEquipment, ...(item.equipo2?.escritorio?.telefono || {}) },
                }
            },
            obsGenerales: item.obsGenerales || "",
        };
    }

    return {
        responsable: "",
        cedula: "",
        cargo: "",
        sector: "",
        statusGeneral: "OPERATIVO",
        equipo1: { laptop: defaultEquipment },
        equipo2: { escritorio: defaultDesktop },
        obsGenerales: "",
    };
};


export function InventoryDialog({
  isOpen,
  setIsOpen,
  item,
  onSuccess,
}: InventoryDialogProps) {
  const { toast } = useToast();
  
  const form = useForm<InventoryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(item)
  });
  
  React.useEffect(() => {
    form.reset(getDefaultValues(item));
  }, [item, form, isOpen]);


  async function onSubmit(values: InventoryFormValues) {
    // We use JSON.parse(JSON.stringify()) to remove undefined values and create a plain object
    const plainValues = JSON.parse(JSON.stringify(values));
    
    const action = item
      ? updateInventoryItem(item.id, plainValues)
      : addInventoryItem(plainValues);

    action.then(result => {
      if (result.success) {
        toast({ title: "Éxito", description: result.message });
        setIsOpen(false);
        onSuccess();
      } else {
        toast({
          title: "Error al guardar",
          description: result.message,
          variant: "destructive",
        });
      }
    }).catch(error => {
      console.error("Submit error:", error);
      toast({
        title: "Error inesperado",
        description: "Ha ocurrido un error al guardar.",
        variant: "destructive",
      });
    }).finally(() => {
      // Re-enable the form fields/button if needed, react-hook-form handles isSubmitting
    });
  }

  const handleClose = () => {
    setIsOpen(false);
  }

  const { isSubmitting } = form.formState;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{item ? "Editar Elemento" : "Agregar Elemento"}</DialogTitle>
          <DialogDescription>
            {item
              ? "Actualiza los detalles del inventario."
              : "Agrega un nuevo elemento al inventario."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="max-h-[75vh] overflow-y-auto p-1 pr-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Información del Responsable</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="responsable"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsable</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre Apellido" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cedula"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cédula</FormLabel>
                        <FormControl>
                          <Input placeholder="V-12345678" {...field} value={field.value ?? ''}/>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cargo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cargo</FormLabel>
                          <FormControl>
                            <Input placeholder="Analista" {...field} value={field.value ?? ''}/>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sector"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sector</FormLabel>
                          <FormControl>
                            <Input placeholder="Oficina Central" {...field} value={field.value ?? ''}/>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="statusGeneral"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status General</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un estado" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="OPERATIVO">OPERATIVO</SelectItem>
                            <SelectItem value="INOPERATIVO">INOPERATIVO</SelectItem>
                            <SelectItem value="ROBADO">ROBADO</SelectItem>
                            <SelectItem value="MIXTO">MIXTO</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Separator className="my-6" />
                  
                  <h3 className="text-lg font-medium">Equipos</h3>
                  
                  <div className="space-y-4">
                    {renderEquipmentFields(form, "equipo1.laptop", "Laptop")}
                    
                    <h4 className="font-semibold text-foreground pt-4">Equipo de Escritorio</h4>
                    <div className="space-y-4 pl-4 border-l">
                        {renderEquipmentFields(form, "equipo2.escritorio.cpu", "CPU")}
                        {renderEquipmentFields(form, "equipo2.escritorio.monitor", "Monitor")}
                        {renderEquipmentFields(form, "equipo2.escritorio.teclado", "Teclado")}
                        {renderEquipmentFields(form, "equipo2.escritorio.mouse", "Mouse")}
                        {renderEquipmentFields(form, "equipo2.escritorio.telefono", "Teléfono")}
                    </div>
                  </div>
                 
                 <Separator className="my-6" />
                 
                 <FormField
                  control={form.control}
                  name="obsGenerales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observaciones Generales</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Añadir observaciones..." {...field} value={field.value ?? ''}/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <DialogFooter className="pt-6 border-t mt-4">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (item ? "Guardando..." : "Creando...") : (item ? "Guardar Cambios" : "Crear Elemento")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
