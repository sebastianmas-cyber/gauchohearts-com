'use client';

import { getFirestore, doc, setDoc, onSnapshot, getDoc, collection, deleteDoc, updateDoc, deleteField, query, getDocs } from "firebase/firestore";
import { useFirebase } from '../firebase/client-provider';
import { useCallback } from 'react';

/**
 * A hook for interacting with a project's specific storage subcollection in Firestore.
 * 
 * @param projectId The ID of the project whose storage is to be accessed.
 * @returns An object with functions to interact with the storage.
 */
export function useProjectStorage(projectId: string) {
  const { app } = useFirebase();
  const db = app ? getFirestore(app) : null;
  
  const storageCollectionRef = db && projectId ? collection(db, 'projects', projectId, 'storage') : null;

  const setDocInStorage = useCallback(async (docId: string, data: object) => {
    if (!storageCollectionRef) {
      console.error("Firestore not initialized or projectId is invalid.");
      throw new Error("Storage is not available.");
    }
    const docRef = doc(storageCollectionRef, docId);
    await setDoc(docRef, data, { merge: true });
  }, [storageCollectionRef]);

  const getDocFromStorage = useCallback(async (docId: string) => {
    if (!storageCollectionRef) {
      console.error("Firestore not initialized or projectId is invalid.");
      return null;
    }
    const docRef = doc(storageCollectionRef, docId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }, [storageCollectionRef]);

  const listenToDocInStorage = useCallback((docId: string, onDataChange: (data: object | null) => void) => {
    if (!storageCollectionRef) {
      console.error("Firestore not initialized or projectId is invalid.");
      return () => {}; 
    }
    const docRef = doc(storageCollectionRef, docId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      onDataChange(docSnap.exists() ? docSnap.data() : null);
    });
    return unsubscribe;
  }, [storageCollectionRef]);

  const deleteDocFromStorage = useCallback(async (docId: string) => {
    if (!storageCollectionRef) {
      console.error("Firestore not initialized or projectId is invalid.");
      throw new Error("Storage is not available.");
    }
    const docRef = doc(storageCollectionRef, docId);
    await deleteDoc(docRef);
  }, [storageCollectionRef]);

  const deleteFieldFromDoc = useCallback(async (docId: string, fieldName: string) => {
    if (!storageCollectionRef) {
      console.error("Firestore not initialized or projectId is invalid.");
      throw new Error("Storage is not available.");
    }
    const docRef = doc(storageCollectionRef, docId);
    await updateDoc(docRef, {
      [fieldName]: deleteField()
    });
  }, [storageCollectionRef]);

  /**
   * Lists all documents in the project's storage.
   * @returns A promise that resolves to an array of documents, including their IDs.
   */
  const listDocsInStorage = useCallback(async () => {
    if (!storageCollectionRef) {
      console.error("Firestore not initialized or projectId is invalid.");
      return [];
    }
    const querySnapshot = await getDocs(storageCollectionRef);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }, [storageCollectionRef]);

  return { 
    setDocInStorage, 
    getDocFromStorage, 
    listenToDocInStorage, 
    deleteDocFromStorage,
    deleteFieldFromDoc,
    listDocsInStorage
  };
}
