'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User, getAuth } from 'firebase/auth';
import { app } from './client'; // Import the initialized app
import { FirebaseApp } from 'firebase/app';
import { useRouter, usePathname } from 'next/navigation';

// Define the shape of the context value
interface FirebaseContextValue {
  app: FirebaseApp;
  user: User | null | undefined; // undefined for loading state, null for signed out
}

// Create the context with a default null value
export const FirebaseContext = createContext<FirebaseContextValue | null>(null);

// Create the provider component
export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const auth = getAuth(app);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user && pathname === '/login') {
        router.push('/admin');
      }
    });
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [auth, pathname, router]);

  return (
    <FirebaseContext.Provider value={{ app, user }}>
      {children}
    </FirebaseContext.Provider>
  );
}

// Create a custom hook to use the Firebase context
export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === null) {
    throw new Error('useFirebase must be used within a FirebaseClientProvider');
  }
  return context;
};
