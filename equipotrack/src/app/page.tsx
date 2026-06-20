"use client";

import InventoryDashboard from "@/components/inventory-dashboard";
import { ThemeToggle } from "@/components/theme-toggle";
import { getInventoryItems } from "@/lib/actions";
import { useEffect, useState } from "react";

export default function Home() {
  const [itemCount, setItemCount] = useState<number | null>(null);

  useEffect(() => {
    async function fetchCount() {
      try {
        const items = await getInventoryItems();
        setItemCount(items.length);
      } catch (error) {
        console.error("Error fetching item count:", error);
        setItemCount(0);
      }
    }
    fetchCount();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto flex justify-between items-center p-4 border-b">
        <div>
          <h1 className="text-3xl font-bold font-headline text-primary">
            EquipoTrack
          </h1>
          {itemCount !== null && (
            <p className="text-sm text-muted-foreground mt-1">
              Registros encontrados en la base de datos: <strong>{itemCount}</strong>
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </header>
      <main className="container mx-auto p-4 md:p-6 lg:p-8">
        <InventoryDashboard />
      </main>
    </div>
  );
}
