import admin from 'firebase-admin';

let firestore: admin.firestore.Firestore;

try {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error('The FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  }

  const serviceAccount = JSON.parse(serviceAccountKey);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  firestore = admin.firestore();

} catch (error: any) {
  console.error('FIREBASE ADMIN SDK INITIALIZATION ERROR:', error.message);
  // A proxy is used to throw a clear error message when firestore is accessed,
  // preventing the app from crashing on import.
  firestore = new Proxy({}, {
    get() {
      throw new Error('Firebase Admin SDK not initialized. Check server logs for the FIREBASE ADMIN SDK INITIALIZATION ERROR.');
    }
  }) as admin.firestore.Firestore;
}

export { firestore };
