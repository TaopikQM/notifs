import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    // databaseURL: process.env.FIREBASE_DATABASE_URL,
    databaseURL:  process.env.NEXT_PUBLIC_DOLANREKID_DATABASE_URL,
    // NEXT_PUBLIC_DOLANREKID_DATABASE_URLapiKey: process.env.NEXT_PUBLIC_DOLANREKID_API_KEY,

  });
}

export const dbAdmin = admin.database();
export const adminMessaging = admin.messaging();
