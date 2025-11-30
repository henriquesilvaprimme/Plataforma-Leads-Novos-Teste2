
// @ts-ignore
import { initializeApp } from "firebase/app";
// @ts-ignore
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, setDoc, query, where } from "firebase/firestore";
import { Lead, User } from "../types";

// COLOQUE SUAS CHAVES DO FIREBASE AQUI
const firebaseConfig = {
  apiKey: "AIzaSyAMLDTyqFCQhfll1yPMxUtttgjIxCisIP4",
  authDomain: "painel-de-leads-novos.firebaseapp.com",
  projectId: "painel-de-leads-novos",
  storageBucket: "painel-de-leads-novos.firebasestorage.app",
  messagingSenderId: "630294246900",
  appId: "1:630294246900:web:764b52308c2ffa805175a1"
};

// Exportação explícita da constante de verificação
export const isFirebaseConfigured = firebaseConfig.apiKey !== "AIzaSyAMLDTyqFCQhfll1yPMxUtttgjIxCisIP4";

let app: any;
let db: any;

// Inicialização segura
if (isFirebaseConfigured) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        console.log("Firebase inicializado com sucesso.");
    } catch (error) {
        console.error("Erro ao inicializar Firebase:", error);
        db = null;
    }
} else {
    console.warn("Firebase não configurado. O app rodará em modo de visualização (Mock).");
}

// === FUNÇÕES AUXILIARES DE MAPEAMENTO ===

export const mapDocumentToLead = (doc: any): Lead => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
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

// === FUNÇÕES DE LEITURA (REAL-TIME) ===

export const subscribeToCollection = (collectionName: string, callback: (data: any[]) => void) => {
    if (!isFirebaseConfigured || !db) {
        callback([]); 
        return () => {};
    }

    try {
        const q = query(collection(db, collectionName));
        return onSnapshot(q, (snapshot: any) => {
            const items = snapshot.docs.map((doc: any) => {
                 if(collectionName === 'usuarios') return mapDocumentToUser(doc);
                 return mapDocumentToLead(doc);
            });
            callback(items);
        }, (error: any) => {
            console.error(`Erro na coleção ${collectionName}:`, error);
            callback([]);
        });
    } catch (error) {
        console.error(`Erro ao assinar ${collectionName}:`, error);
        callback([]);
        return () => {};
    }
};

export const subscribeToRenovationsTotal = (callback: (total: number) => void) => {
    if (!isFirebaseConfigured || !db) {
        callback(0);
        return () => {};
    }

    try {
        const docRef = doc(db, 'totalrenovacoes', 'stats');
        return onSnapshot(docRef, (docSnap: any) => {
            if (docSnap.exists()) {
                callback(docSnap.data().count || 0);
            } else {
                callback(0);
            }
        }, (error: any) => {
             console.error("Erro em totalrenovacoes:", error);
             callback(0);
        });
    } catch (error) {
        console.error("Erro ao assinar totalrenovacoes:", error);
        callback(0);
        return () => {};
    }
};

// === FUNÇÕES DE ESCRITA ===

export const addDataToCollection = async (collectionName: string, data: any) => {
    if (!isFirebaseConfigured || !db) {
        alert("Firebase não configurado. Dados não serão salvos (Modo Mock).");
        return;
    }
    
    try {
        // Remove ID se existir para deixar o Firestore gerar (ou mantenha se for intencional)
        const { id, ...rest } = data;
        await addDoc(collection(db, collectionName), {
            ...rest,
            createdAt: new Date().toISOString()
        });
    } catch (error) {
        console.error(`Erro ao salvar em ${collectionName}:`, error);
        alert("Erro ao salvar dados.");
    }
};

export const updateDataInCollection = async (collectionName: string, id: string, data: any) => {
    if (!isFirebaseConfigured || !db) return;

    try {
        const docRef = doc(db, collectionName, id);
        await updateDoc(docRef, data);
    } catch (error) {
        console.error(`Erro ao atualizar ${collectionName}:`, error);
    }
};

export const updateTotalRenovacoes = async (newTotal: number) => {
    if (!isFirebaseConfigured || !db) return;

    try {
        const docRef = doc(db, 'totalrenovacoes', 'stats');
        await setDoc(docRef, { count: newTotal }, { merge: true });
    } catch (error) {
        console.error("Erro ao atualizar total:", error);
    }
};
