"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import InventoryDashboard from "@/components/inventory-dashboard";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";

export default function Home() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto flex justify-between items-center p-4 border-b">
        <h1 className="text-3xl font-bold font-headline text-primary">
          EquipoTrack
        </h1>
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground hidden sm:block">{user.email}</p>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Cerrar Sesión
          </Button>
          <ThemeToggle />
        </div>
      </header>
      <main className="container mx-auto p-4 md:p-6 lg:p-8">
        <InventoryDashboard />
      </main>
    </div>
  );
}
