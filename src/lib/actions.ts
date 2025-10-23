"use server";

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch
} from "firebase/firestore";
import { revalidatePath } from "next/cache";
import { db } from "./firebase";
import type { InventoryItem, InventoryItemForm } from "./definitions";

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
    await addDoc(collection(db, "inventario"), itemData);
    revalidatePath("/");
    return { success: true, message: "Elemento agregado exitosamente." };
  } catch (error) {
    console.error("Error adding document:", error);
    return { success: false, message: "Error al agregar el elemento." };
  }
}

export async function addMultipleInventoryItems(items: InventoryItemForm[]) {
  const batch = writeBatch(db);
  try {
    items.forEach((item) => {
      const docRef = doc(collection(db, "inventario"));
      batch.set(docRef, item);
    });
    await batch.commit();
    revalidatePath("/");
    return { success: true, message: `${items.length} elementos importados exitosamente.` };
  } catch (error) {
    console.error("Error importing documents:", error);
    return { success: false, message: "Error al importar los elementos." };
  }
}


export async function updateInventoryItem(id: string, itemData: InventoryItemForm) {
  try {
    await updateDoc(doc(db, "inventario", id), itemData);
    revalidatePath("/");
    return { success: true, message: "Elemento actualizado exitosamente." };
  } catch (error) {
    console.error("Error updating document:", error);
    return { success: false, message: "Error al actualizar el elemento." };
  }
}

export async function deleteInventoryItem(id: string) {
  try {
    await deleteDoc(doc(db, "inventario", id));
    revalidatePath("/");
    return { success: true, message: "Elemento eliminado exitosamente." };
  } catch (error) {
    console.error("Error deleting document:", error);
    return { success: false, message: "Error al eliminar el elemento." };
  }