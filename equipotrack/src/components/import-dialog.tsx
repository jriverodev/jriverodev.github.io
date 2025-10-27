"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { addMultipleInventoryItems } from "@/lib/actions";
import { parseCSVRow, exportToCSV } from "@/lib/utils";
import type { InventoryItemForm } from "@/lib/definitions";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Download, FileWarning } from "lucide-react";

interface ImportDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportDialog({ isOpen, setIsOpen, onSuccess }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [{
        Responsable: "John Doe",
        Cédula: "V-12345678",
        Cargo: "Analista",
        Sector: "Oficina Principal",
        "Status General": "OPERATIVO",
        Laptop: "Dell / Latitude 5420 / 12345ABC / ETIQ001 / OPERATIVO / Sin novedad",
        Escritorio: "CPU: HP/ProDesk/SGH123/ETIQ002/OPERATIVO/-; Monitor: Dell/P2419H/MX0123/ETIQ003/OPERATIVO/-",
        "Obs Generales": "Entregado en fecha X"
    }];
    exportToCSV(templateData as any, "plantilla_importacion.csv");
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "Error",
        description: "Por favor, selecciona un archivo CSV para importar.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: header => header.trim(),
      delimiter: ",", // Forzar la coma como delimitador principal
      complete: async (results) => {
        try {
          if (results.errors.length > 0) {
            // Filtrar errores comunes que no son críticos, como "mismatched fields"
            const criticalErrors = results.errors.filter(e => e.code !== 'TooFewFields' && e.code !== 'TooManyFields');
            if (criticalErrors.length > 0) {
              const firstError = criticalErrors[0];
              const errorMessage = `Fila ${firstError.row}: ${firstError.message}`;
              console.error("CSV Parsing errors:", criticalErrors);
              toast({
                title: "Error de formato CSV",
                description: `Se encontraron errores críticos al leer el archivo. ${errorMessage}`,
                variant: "destructive",
              });
              setIsProcessing(false);
              return;
            }
          }

          const parsedData = results.data
            .map((row: any) => parseCSVRow(row))
            .filter(
              (item): item is InventoryItemForm => {
                return item && typeof item === 'object' && !!item.responsable;
              }
            );

          if(parsedData.length === 0) {
            toast({
              title: "Sin datos válidos",
              description: "El archivo CSV está vacío o no contiene filas con un 'Responsable' válido.",
              variant: "destructive",
            });
            setIsProcessing(false);
            return;
          }

          const result = await addMultipleInventoryItems(parsedData);

          if (result.success) {
            toast({ title: "Éxito", description: result.message });
            setFile(null);
            setIsOpen(false);
            onSuccess();
          } else {
            toast({
              title: "Error al guardar",
              description: result.message,
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error(error);
          toast({
            title: "Error de procesamiento",
            description: "No se pudo procesar el archivo CSV. Revisa el formato e inténtalo de nuevo.",
            variant: "destructive",
          });
        } finally {
          setIsProcessing(false);
        }
      },
      error: (error: any) => {
        console.error("PapaParse error:", error);
        toast({
          title: "Error de archivo",
          description: `No se pudo leer el archivo CSV. ${error.message}`,
          variant: "destructive",
        });
        setIsProcessing(false);
      },
    });
  };
  
  const handleClose = () => {
    setFile(null);
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar desde CSV</DialogTitle>
          <DialogDescription>
            Sube un archivo CSV para agregar múltiples elementos al inventario.
            Asegúrate de que las columnas coincidan con la plantilla.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Descargar Plantilla
          </Button>
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="csv-file">Archivo CSV</Label>
            <Input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} />
          </div>
          {file && (
             <Alert>
                <FileWarning className="h-4 w-4" />
                <AlertTitle>Confirmación de Importación</AlertTitle>
                <AlertDescription>
                  Se importarán los datos desde <strong>{file.name}</strong>. Los registros existentes no serán modificados.
                </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={!file || isProcessing}>
            {isProcessing ? "Procesando..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
