import { getInventoryItemById } from "@/lib/actions";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, getStatusBadgeClass } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { Equipment, DesktopEquipment } from "@/lib/definitions";

function EquipmentDetail({ equipment, title }: { equipment: Equipment | undefined, title: string }) {
    if (!equipment || Object.keys(equipment).filter(k => equipment[k as keyof Equipment]).length === 0) return null;

    return (
        <div className="rounded-lg border p-4">
            <h4 className="font-semibold text-lg mb-3 text-primary">{title}</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                {equipment.marca && <div><span className="font-semibold">Marca:</span> {equipment.marca}</div>}
                {equipment.modelo && <div><span className="font-semibold">Modelo:</span> {equipment.modelo}</div>}
                {equipment.serial && <div><span className="font-semibold">Serial:</span> {equipment.serial}</div>}
                {equipment.etiqueta && <div><span className="font-semibold">Etiqueta:</span> {equipment.etiqueta}</div>}
                {equipment.status && <div><span className="font-semibold">Status:</span> {equipment.status}</div>}
                {equipment.obs && <div className="col-span-full"><span className="font-semibold">Obs:</span> {equipment.obs}</div>}
            </div>
        </div>
    );
}

function DesktopDetail({ desktop, title }: { desktop: DesktopEquipment | undefined, title: string }) {
     if (!desktop || Object.keys(desktop).filter(k => desktop[k as keyof DesktopEquipment]).length === 0) return null;
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <EquipmentDetail equipment={desktop.cpu} title="CPU" />
                <EquipmentDetail equipment={desktop.monitor} title="Monitor" />
                <EquipmentDetail equipment={desktop.teclado} title="Teclado" />
                <EquipmentDetail equipment={desktop.mouse} title="Mouse" />
                <EquipmentDetail equipment={desktop.telefono} title="Teléfono" />
            </CardContent>
        </Card>
    );
}


export default async function ItemDetailPage({ params }: { params: { id: string } }) {
  const item = await getInventoryItemById(params.id);

  if (!item) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto flex items-center p-4 border-b">
        <Button asChild variant="outline" size="icon" className="mr-4">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-headline text-primary">
            Detalle del Registro
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ID del Registro: {item.id}
          </p>
        </div>
      </header>
      <main className="container mx-auto p-4 md:p-6 lg:p-8">
        <Card className="w-full">
          <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="text-3xl">{item.responsable}</CardTitle>
                    <CardDescription>{item.cargo} - {item.sector}</CardDescription>
                </div>
                <Badge className={cn("text-base", getStatusBadgeClass(item.statusGeneral))}>
                  {item.statusGeneral}
                </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-2">Información del Responsable</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <p><span className="font-semibold">Cédula:</span> {item.cedula}</p>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
                <h3 className="font-semibold text-lg">Equipos Asignados</h3>
                <EquipmentDetail equipment={item.equipo1?.laptop} title="Laptop" />
                <DesktopDetail desktop={item.equipo2?.escritorio} title="Equipo de Escritorio" />
            </div>
            
            {(item.equipo1?.laptop || item.equipo2?.escritorio) && <Separator />}

            {item.obsGenerales && (
              <div>
                <h3 className="font-semibold text-lg mb-2">Observaciones Generales</h3>
                <p className="text-sm text-muted-foreground bg-slate-50 dark:bg-slate-800 p-3 rounded-md">{item.obsGenerales}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
