"use server";

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { revalidatePath } from "next/cache";
import { serverDB } from "./firebase-server";
import type { InventoryItem, InventoryItemForm } from "./definitions";

// Helper to remove undefined values from nested objects
const removeUndefined = (obj: any): any => {
    if (obj === undefined) {
        return null; // Convert top-level undefined to null
    }
    if (Array.isArray(obj)) {
        return obj.map(removeUndefined);
    }
    if (obj !== null && typeof obj === 'object') {
        if (Object.keys(obj).length === 0) {
            return null; // Convert empty objects to null
        }
        return Object.entries(obj).reduce((acc, [key, value]) => {
            if (value !== undefined) {
                const cleanedValue = removeUndefined(value);
                if (cleanedValue !== null) {
                    (acc as any)[key] = cleanedValue;
                }
            }
            return acc;
        }, {});
    }
    return obj;
};

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

export async function getInventoryItemById(id: string): Promise<InventoryItem | null> {
  try {
    const docRef = doc(serverDB, "inventario", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as InventoryItem;
    } else {
      console.log("No such document!");
      return null;
    }
  } catch (error) {
    console.error("Error getting document:", error);
    return null;
  }
}

export async function addInventoryItem(itemData: InventoryItemForm) {
  try {
    const cleanData = JSON.parse(JSON.stringify(itemData));
    const result = { success: true, message: "Elemento agregado exitosamente." };
    await addDoc(collection(serverDB, "inventario"), cleanData);
    revalidatePath("/");
    return result;
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
      const cleanItem = removeUndefined(JSON.parse(JSON.stringify(item)));
      batch.set(docRef, cleanItem);
    });
    const result = { success: true, message: `${items.length} elementos importados exitosamente.` };
    await batch.commit();
    revalidatePath("/");
    return result;
  } catch (error) {
    console.error("Error importing documents:", error);
    const errorMessage = error instanceof Error ? error.message : "Error al importar los elementos.";
    return { success: false, message: errorMessage };
  }
}


export async function updateInventoryItem(id: string, itemData: Partial<InventoryItemForm>) {
   try {
    const cleanData = JSON.parse(JSON.stringify(itemData));
    const result = { success: true, message: "Elemento actualizado exitosamente." };
    await updateDoc(doc(serverDB, "inventario", id), cleanData);
    revalidatePath("/");
    revalidatePath(`/item/${id}`);
    return result;
  } catch (error) {
    console.error("Error updating document:", error);
    const errorMessage = error instanceof Error ? error.message : "Error al actualizar el elemento.";
    return { success: false, message: errorMessage };
  }
}

export async function deleteInventoryItem(id: string) {
  try {
    const result = { success: true, message: "Elemento eliminado exitosamente." };
    await deleteDoc(doc(serverDB, "inventario", id));
    revalidatePath("/");
    return result;
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
    
    const result = { success: true, message: "Todos los registros han sido eliminados." };
    await batch.commit();
    revalidatePath("/");
    return result;
  } catch (error) {
    console.error("Error deleting all documents:", error);
    const errorMessage = error instanceof Error ? error.message : "Error al eliminar los registros.";
    return { success: false, message: errorMessage };
  }
}