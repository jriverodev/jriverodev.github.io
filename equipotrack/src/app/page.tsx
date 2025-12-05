import InventoryDashboard from "@/components/inventory-dashboard";
import { ThemeToggle } from "@/components/theme-toggle";
import { Boxes } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
        <div className="flex items-center gap-2">
          <Boxes className="h-6 w-6" />
          <h1 className="text-2xl font-bold">
            EquipoTrack
          </h1>
        </div>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 p-4 sm:px-6 sm:py-0">
        <InventoryDashboard />
      </main>
    </div>
  );
}
