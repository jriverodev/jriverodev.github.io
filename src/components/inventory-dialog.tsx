
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { InventoryItem } from "@/lib/definitions";
import { addInventoryItem, updateInventoryItem } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";

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
}

const renderEquipmentFields = (form: any, basePath: string) => (
  <div className="grid grid-cols-2 gap-4">
    <FormField control={form.control} name={`${basePath}.marca`} render={({ field }) => (<FormItem><FormLabel>Marca</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
    <FormField control={form.control} name={`${basePath}.modelo`} render={({ field }) => (<FormItem><FormLabel>Modelo</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
    <FormField control={form.control} name={`${basePath}.serial`} render={({ field }) => (<FormItem><FormLabel>Serial</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
    <FormField control={form.control} name={`${basePath}.etiqueta`} render={({ field }) => (<FormItem><FormLabel>Etiqueta</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
    <FormField control={form.control} name={`${basePath}.status`} render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
    <FormField control={form.control} name={`${basePath}.obs`} render={({ field }) => (<FormItem><FormLabel>Obs.</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
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
}: InventoryDialogProps) {
  const { toast } = useToast();
  const form = useForm<InventoryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(item)
  });
  
  React.useEffect(() => {
    form.reset(getDefaultValues(item));
  }, [item, form]);


  async function onSubmit(values: InventoryFormValues) {
    const result = item
      ? await updateInventoryItem(item.id, values)
      : await addInventoryItem(values);

    if (result.success) {
      toast({ title: "Éxito", description: result.message });
      setIsOpen(false);
      form.reset();
    } else {
      toast({
        title: "Error",
        description: result.message,
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[800px]">
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
            <ScrollArea className="max-h-[70vh] p-1">
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="responsable"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsable</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre Apellido" {...field} />
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
                          <Input placeholder="V-12345678" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cargo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cargo</FormLabel>
                          <FormControl>
                            <Input placeholder="Analista" {...field} />
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
                            <Input placeholder="Oficina Central" {...field} />
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
                  
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                      <AccordionTrigger>Laptop</AccordionTrigger>
                      <AccordionContent>
                        <div className="p-1">
                         {renderEquipmentFields(form, "equipo1.laptop")}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                      <AccordionTrigger>Equipo de Escritorio</AccordionTrigger>
                      <AccordionContent>
                        <Accordion type="single" collapsible className="w-full px-2">
                          <AccordionItem value="sub-item-1">
                            <AccordionTrigger className="text-sm">CPU</AccordionTrigger>
                            <AccordionContent className="p-1">
                              {renderEquipmentFields(form, "equipo2.escritorio.cpu")}
                            </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="sub-item-2">
                            <AccordionTrigger className="text-sm">Monitor</AccordionTrigger>
                            <AccordionContent className="p-1">
                              {renderEquipmentFields(form, "equipo2.escritorio.monitor")}
                            </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="sub-item-3">
                            <AccordionTrigger className="text-sm">Teclado</AccordionTrigger>
                            <AccordionContent className="p-1">
                               {renderEquipmentFields(form, "equipo2.escritorio.teclado")}
                            </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="sub-item-4">
                            <AccordionTrigger className="text-sm">Mouse</AccordionTrigger>
                            <AccordionContent className="p-1">
                              {renderEquipmentFields(form, "equipo2.escritorio.mouse")}
                            </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="sub-item-5">
                            <AccordionTrigger className="text-sm">Teléfono</AccordionTrigger>
                            <AccordionContent className="p-1">
                              {renderEquipmentFields(form, "equipo2.escritorio.telefono")}
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                 
                 <FormField
                  control={form.control}
                  name="obsGenerales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observaciones Generales</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Añadir observaciones..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4 pr-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {item ? "Guardar Cambios" : "Crear Elemento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
