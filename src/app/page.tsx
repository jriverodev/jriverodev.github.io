"use client";

import InventoryDashboard from "@/components/inventory-dashboard";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto flex justify-between items-center p-4 border-b">
        <h1 className="text-3xl font-bold font-headline text-primary">
          EquipoTrack
        </h1>
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
