"use client";

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

const formSchema = z.object({
  responsable: z.string().min(1, "Responsable es requerido."),
  cedula: z.string().min(1, "Cédula es requerida."),
  cargo: z.string().min(1, "Cargo es requerido."),
  sector: z.string().min(1, "Sector es requerido."),
  statusGeneral: z.enum(["OPERATIVO", "INOPERATIVO", "ROBADO", "MIXTO"]),
  equipo1: z.object({ laptop: equipmentSchema }).optional(),
  equipo2: z.object({ escritorio: equipmentSchema }).optional(),
  obsGenerales: z.string().optional(),
});

type InventoryFormValues = z.infer<typeof formSchema>;

interface InventoryDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  item?: InventoryItem | null;
}

export function InventoryDialog({
  isOpen,
  setIsOpen,
  item,
}: InventoryDialogProps) {
  const { toast } = useToast();
  const form = useForm<InventoryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: item
      ? { ...item, obsGenerales: item.obsGenerales || "" }
      : {
          responsable: "",
          cedula: "",
          cargo: "",
          sector: "",
          statusGeneral: "OPERATIVO",
          equipo1: { laptop: {} },
          equipo2: { escritorio: {} },
          obsGenerales: "",
        },
  });

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
      <DialogContent className="sm:max-w-[600px]">
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
            <ScrollArea className="max-h-[60vh] p-1">
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
                  
                  <div className="space-y-2 p-3 border rounded-md">
                    <h3 className="font-semibold text-sm">Laptop</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="equipo1.laptop.marca" render={({ field }) => (<FormItem><FormLabel>Marca</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                      <FormField control={form.control} name="equipo1.laptop.modelo" render={({ field }) => (<FormItem><FormLabel>Modelo</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                      <FormField control={form.control} name="equipo1.laptop.serial" render={({ field }) => (<FormItem><FormLabel>Serial</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                      <FormField control={form.control} name="equipo1.laptop.etiqueta" render={({ field }) => (<FormItem><FormLabel>Etiqueta</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                      <FormField control={form.control} name="equipo1.laptop.status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                      <FormField control={form.control} name="equipo1.laptop.obs" render={({ field }) => (<FormItem><FormLabel>Obs.</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                    </div>
                  </div>
                  <div className="space-y-2 p-3 border rounded-md">
                    <h3 className="font-semibold text-sm">Escritorio</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="equipo2.escritorio.marca" render={({ field }) => (<FormItem><FormLabel>Marca</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                      <FormField control={form.control} name="equipo2.escritorio.modelo" render={({ field }) => (<FormItem><FormLabel>Modelo</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                      <FormField control={form.control} name="equipo2.escritorio.serial" render={({ field }) => (<FormItem><FormLabel>Serial</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                      <FormField control={form.control} name="equipo2.escritorio.etiqueta" render={({ field }) => (<FormItem><FormLabel>Etiqueta</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                      <FormField control={form.control} name="equipo2.escritorio.status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                      <FormField control={form.control} name="equipo2.escritorio.obs" render={({ field }) => (<FormItem><FormLabel>Obs.</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                    </div>
                  </div>
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
