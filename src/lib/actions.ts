"use server";

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
} from "firebase/firestore";
import { revalidatePath } from "next/cache";
import { serverDB } from "./firebase-server";
import type { InventoryItem, InventoryItemForm } from "./definitions";

export async function getInventoryItems(): Promise<InventoryItem[]> {
  try {
    const querySnapshot = await getDocs(collection(serverDB, "inventario"));
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
    await addDoc(collection(serverDB, "inventario"), cleanData);
    revalidatePath("/");
    return { success: true, message: "Elemento agregado exitosamente." };
  } catch (error) {
    console.error("Error adding document:", error);
    const errorMessage = error instanceof Error ? error.message : "Error al agregar el elemento.";
    return { success: false, message: errorMessage };
  }
}

export async function addMultipleInventoryItems(items: InventoryItemForm[]) {
  const batch = writeBatch(serverDB);
  try {
    items.forEach((item) => {
      const docRef = doc(collection(serverDB, "inventario"));
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
    await updateDoc(doc(serverDB, "inventario", id), cleanData);
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
    await deleteDoc(doc(serverDB, "inventario", id));
    revalidatePath("/");
    return { success: true, message: "Elemento eliminado exitosamente." };
  } catch (error) {
    console.error("Error deleting document:", error);
    const errorMessage = error instanceof Error ? error.message : "Error al eliminar el elemento.";
    return { success: false, message: errorMessage };
  }
}

export async function deleteAllInventoryItems() {
  try {
    const querySnapshot = await getDocs(collection(serverDB, "inventario"));
    if (querySnapshot.empty) {
      return { success: true, message: "La base de datos ya está vacía." };
    }
    
    const batch = writeBatch(serverDB);
    querySnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    revalidatePath("/");
    return { success: true, message: "Todos los registros han sido eliminados." };
  } catch (error) {
    console.error("Error deleting all documents:", error);
    const errorMessage = error instanceof Error ? error.message : "Error al eliminar los registros.";
    return { success: false, message: errorMessage };
  }
}
