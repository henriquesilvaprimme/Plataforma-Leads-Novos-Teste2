import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, setDoc, query, where } from "firebase/firestore";
import { Lead, User } from "../types";

// COLOQUE SUAS CHAVES DO FIREBASE AQUI
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "SEU_AUTH_DOMAIN.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Conversores de dados para garantir tipagem
export const mapDocumentToLead = (doc: any): Lead => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        // Garante que datas venham como string se estiverem salvas de outra forma
        createdAt: data.createdAt || new Date().toISOString()
    } as Lead;
};

export const mapDocumentToUser = (doc: any): User => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data
    } as User;
};

// Funções de Assinatura (Real-time)

export const subscribeToCollection = (collectionName: string, callback: (data: any[]) => void) => {
    const q = query(collection(db, collectionName));
    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => {
             if(collectionName === 'usuarios') return mapDocumentToUser(doc);
             return mapDocumentToLead(doc);
        });
        callback(items);
    });
};

export const subscribeToRenovationsTotal = (callback: (total: number) => void) => {
    const docRef = doc(db, 'totalrenovacoes', 'stats');
    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data().count || 0);
        } else {
            callback(0);
        }
    });
};

// Funções de Escrita

export const addDataToCollection = async (collectionName: string, data: any) => {
    // Remove ID se existir para deixar o Firestore criar um
    const { id, ...rest } = data;
    await addDoc(collection(db, collectionName), {
        ...rest,
        createdAt: new Date().toISOString()
    });
};

export const updateDataInCollection = async (collectionName: string, id: string, data: any) => {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, data);
};

export const updateTotalRenovacoes = async (newTotal: number) => {
    const docRef = doc(db, 'totalrenovacoes', 'stats');
    // Usa setDoc com merge true para criar se não existir
    await setDoc(docRef, { count: newTotal }, { merge: true });
};
