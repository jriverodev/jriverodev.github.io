"use server";

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  query,
  where,
  getCountFromServer,
} from "firebase/firestore";
import { revalidatePath } from "next/cache";
import { db } from "./firebase";
import type { InventoryItem, InventoryItemForm } from "./definitions";

// This function is no longer needed as we fetch data on the client
// after authentication. We keep it as a reference or for future
// server-side rendering needs.
export async function getInventoryItems(): Promise<InventoryItem[]> {
  try {
    const querySnapshot = await getDocs(collection(db, "inventario"));
    const data: InventoryItem[] = [];
    querySnapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() } as InventoryItem);
    });
    return data;
  } catch (error) {
    console.error("Error loading data from Firestore:", error);
    return [];
  }
}


export async function addInventoryItem(itemData: InventoryItemForm) {
  try {
    const cleanData = JSON.parse(JSON.stringify(itemData));
    await addDoc(collection(db, "inventario"), cleanData);
    revalidatePath("/");
    return { success: true, message: "Elemento agregado exitosamente." };
  } catch (error) {
    console.error("Error adding document:", error);
    const errorMessage = error instanceof Error ? error.message : "Error al agregar el elemento.";
    return { success: false, message: errorMessage };
  }
}

export async function addMultipleInventoryItems(items: InventoryItemForm[]) {
  const batch = writeBatch(db);
  try {
    items.forEach((item) => {
      const docRef = doc(collection(db, "inventario"));
      const cleanItem = JSON.parse(JSON.stringify(item));
      batch.set(docRef, cleanItem);
    });
    await batch.commit();
    revalidatePath("/");
    return { success: true, message: `${items.length} elementos importados exitosamente.` };
  } catch (error) {
    console.error("Error importing documents:", error);
    const errorMessage = error instanceof Error ? error.message : "Error al importar los elementos.";
    return { success: false, message: errorMessage };
  }
}


export async function updateInventoryItem(id: string, itemData: InventoryItemForm) {
  try {
    const cleanData = JSON.parse(JSON.stringify(itemData));
    await updateDoc(doc(db, "inventario", id), cleanData);
    revalidatePath("/");
    return { success: true, message: "Elemento actualizado exitosamente." };
  } catch (error) {
    console.error("Error updating document:", error);
    const errorMessage = error instanceof Error ? error.message : "Error al actualizar el elemento.";
    return { success: false, message: errorMessage };
  }
}

export async function deleteInventoryItem(id: string) {
  try {
    await deleteDoc(doc(db, "inventario", id));
    revalidatePath("/");
    return { success: true, message: "Elemento eliminado exitosamente." };
  } catch (error) {
    console.error("Error deleting document:", error);
    const errorMessage = error instanceof Error ? error.message : "Error al eliminar el elemento.";
    return { success: false, message: errorMessage };
  }
}

export async function checkAndMigrateData() {
  try {
    console.log("Verificando si la migración de datos es necesaria...");
    const inventoryCollection = collection(db, "inventario");
    
    // Check if the collection is empty.
    const snapshot = await getCountFromServer(inventoryCollection);
    
    if (snapshot.data().count > 0) {
      console.log("La base de datos ya contiene datos. No se requiere migración.");
      return { success: true, message: "La base de datos ya contiene datos." };
    }
    
    // If empty, proceed with migration.
    console.log("La base de datos está vacía. Iniciando la migración de datos...");
    await migrateData();
    revalidatePath("/");
    return { success: true, message: "Migración de datos completada exitosamente." };

  } catch (error) {
    console.error("Error durante la verificación y migración:", error);
    const errorMessage = error instanceof Error ? error.message : "Error durante la verificación y migración.";
    return { success: false, message: errorMessage };
  }
}
