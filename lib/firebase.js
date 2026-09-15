// import { initializeApp, getApps, getApp } from "firebase/app";
// import { getMessaging, getToken, onMessage } from "firebase/messaging";
// import { getDatabase } from "firebase/database";

// lib/firebase.js
// import { initializeApp } from 'firebase/app';
// import { getDatabase } from 'firebase/database';
// import { getMessaging, onMessage, getToken, isSupported  } from 'firebase/messaging'; // Import langsung dari modul


import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, push, update, get, remove, off } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getMessaging, onMessage, getToken, isSupported } from 'firebase/messaging';
import { getAnalytics, logEvent } from "firebase/analytics";
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword } from "firebase/auth";


const firebaseConfig = {

  apiKey: process.env.NEXT_PUBLIC_DOLANREKID_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_DOLANREKID_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_DOLANREKID_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_DOLANREKID_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_DOLANREKID_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_DOLANREKID_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_DOLANREKID_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_DOLANREKID_MEANSUREMENT_ID,

};


const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

const auth = getAuth(app);
// data utama dolanrekid
 const database = getDatabase(app); // Add this line to initialize Realtime Database
 const rtdb = getDatabase(app); // Add this line to initialize Realtime Database
 // const db = getDatabase(app); // Add this line to initialize Realtime Database


// PENTING: Hanya inisialisasi messaging jika di browser
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;
export { getToken, onMessage };
 
 export { rtdb,db,database, storage, push, update, get, set, ref, off, storageBackup,storageBackup1};//,db, storage,   auth, signInWithEmailAndPassword, signInWithPopup,  createUserWithEmailAndPassword, GoogleAuthProvider

// Helper: Ambil waktu WIB lengkap (hari, tanggal, bulan, tahun, jam, menit, detik)
export const getWIBTime = () => {
  const now = new Date();
  const options = {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };

  const formatted = new Intl.DateTimeFormat("id-ID", options).format(now);

  // Contoh hasil: "Senin, 15 September 2026 14.30.45"
  return {
    full: `${formatted} WIB`,
    iso: now.toISOString(),
    timestamp: now.getTime(),
  };
};

// Helper: Cari chat pair berdasarkan 2 user
export const getChatPairKey = (userA, userB) => {
  return [userA, userB].sort().join("_");
};


export const requestPermissionAndGetToken = async () => {
  if (!messaging) return null;

  // Cek apakah browser support messaging
  const supported = await isSupported();
  if (!supported) {
    console.error('Firebase Messaging tidak didukung di browser ini');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  try {
    const token = await getToken(messaging, {
      vapidKey: "BBiuf9a4Q4j75ggkXu-oSJ2ywJZhQL-D01V0V3RdOK4sQ449WDmXo11Km1MTTF5eioVgPg4B_SGhzhDWEhAW580"// WAJIB GANTI
    });
    console.log('✅ getToken() berhasil! Token:', token);
    return token;
  } catch (error) {
    console.error('Token error:', error);
    return null;
  }
};

export const listenForMessages = (callback) => {
  if (!messaging) return;
  return onMessage(messaging, callback);
};

// const app = initializeApp(firebaseConfig);
// export const db = getDatabase(app);
// export const messaging = getMessaging(app);

// // // Fungsi request izin dan ambil token
// // export const requestPermissionAndGetToken = async () => {
// //   const permission = await Notification.requestPermission();
// //   if (permission !== 'granted') {
// //     return null;
// //   }
  
// //   try {
// //     const token = await getToken(messaging, {
// //       // vapidKey: 'YOUR_VAPID_KEY_PUBLIC' // Ganti dengan VAPID Key dari Firebase Console
// //       vapidKey: 'process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY' // Ganti dengan VAPID Key dari Firebase Console
// //     });
// //     return token;
// //   } catch (error) {
// //     console.error('Gagal ambil token:', error);
// //     return null;
// //   }
// // };


// // Fungsi request izin & ambil token
// export const requestPermissionAndGetToken = async () => {
//   try {
//     // 1. Minta izin notifikasi browser
//     const permission = await Notification.requestPermission();
//     if (permission !== 'granted') {
//       console.log('Notifikasi ditolak oleh user');
//       return null;
//     }

//     // 2. Ambil FCM Token
//     const token = await getToken(messaging, {
//       vapidKey: 'YOUR_VAPID_KEY_DARI_FIREBASE_CONSOLE' // PENTING: Ganti dengan VAPID Key asli
//     });

//     console.log('FCM Token:', token);
//     return token;
//   } catch (error) {
//     console.error('Gagal ambil token:', error);
//     return null;
//   }
// };

// // Listen pesan saat app terbuka
// export const listenForMessages = (callback) => {
//   onMessage(messaging, (payload) => {
//     callback(payload);
//   });
// };




// export const requestNotificationPermission = async () => {
//   if (typeof window === "undefined" || !("Notification" in window)) return null;
//   try {
//     const permission = await Notification.requestPermission();
//     if (permission === "granted") {
//       const messaging = getMessaging(app);
//       // return await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });
//      const token = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });  
//       console.log("Token FCM berhasil didapatkan:", token);
//     }
//   } catch (error) {
//     console.error("Gagal dapat token FCM:", error);
//   }
//   return null;
// };

// export const requestNotificationPermission = async () => {
//   if (typeof window === "undefined" || !("Notification" in window)) return null;
//   try {
//     const permission = await Notification.requestPermission();
//     if (permission === "granted") {
//       // Wajib daftarkan Service Worker secara manual agar tidak crash di browser
//       const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
//       await navigator.serviceWorker.ready; // Tunggu sampai siap

//       const messaging = getMessaging(app);
//       // return await getToken(messaging, { 
//       //   vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
//       //   serviceWorkerRegistration: registration // Hubungkan ke SW yang aktif
//       // });
//       const token = await getToken(messaging, { 
//         vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
//         serviceWorkerRegistration: registration // Hubungkan ke SW yang aktif
//       });
//       console.log("Token FCM berhasil didapatkan:", token);
//     }
//   } catch (error) {
//     console.error("Gagal dapat token FCM:", error);
//   }
//   return null;
// };


// export const onMessageListener = () =>
//   new Promise((resolve) => {
//     const messaging = getMessaging(app);
//     onMessage(messaging, (payload) => resolve(payload));
//   });






  
// #dolanrek-f88ad
// NEXT_PUBLIC_API_KEY= AIzaSyCV1zYTlwkDooDDh88AnzIov7XpmXz73eQ
// NEXT_PUBLIC_AUTH_DOMAIN= dolanrek-f88ad.firebaseapp.com
// NEXT_PUBLIC_DATABASE_URL= https://dolanrek-f88ad-default-rtdb.europe-west1.firebasedatabase.app
// NEXT_PUBLIC_PROJECT_ID= dolanrek-f88ad
// NEXT_PUBLIC_STORAGE_BUCKET= dolanrek-f88ad.appspot.com
// NEXT_PUBLIC_MESSAGING_SENDER_ID= 888649724443
// NEXT_PUBLIC_APP_ID= 1:888649724443:web:985e08bbfa25c98f9bbebe
// NEXT_PUBLIC_MEANSUREMENT_ID= G-9XBD69HYXS

// FIREBASE_PROJECT_IDdolan=dolanrek-f88ad
// FIREBASE_CLIENT_EMAILdolan=firebase-adminsdk-m50mo@dolanrek-f88ad.iam.gserviceaccount.com
// FIREBASE_PRIVATE_KEYdolan="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDP/jhWQe5TskD6\n05YJOu9apPQpK4SHylYs58KEr+Z+/uScZy937Pcphy7CxS+O5UxMSk6rsjbN+qRr\nGqMSFbx1+6QKNE7ARyaziEvmcaPhxftv6sTFIAKlqjhIDJB7W+cKa6E6vl+ihuOA\np/4QSM4lqnT3Ld94oDXNvLdInkz3ZWkjMiSnhNpgKL+UDT/X2arnjDGWioAPBHl9\nx/WLoDPJDPOG+4yMBd5Yb5wPkZFKAzbpA20voGxeSIiyHK/9IPKuHd+vy3nF9cwL\n3j1XvqoX1vjh32cYHMZ1uBuOL9TFmeXEzSJLkAtofi7hYF+uVhRMUM0UVDdBH6uL\nSqj7a7NBAgMBAAECggEABDlihYXzRCnjnfR8IJXc1JdzCf8DQwq9802FqtIzuTKO\nDAsgcKwUXPiM35HHpHxNr2L29A+7gzVq723sD+r3F+JTc42aZ9dKFu1WtUhrjqNJ\ntv0qn+JFi33IhNYUfRzhtVl4Pcwt/wwERNGknEoOPb+Xfomk9zsxvIrvof7tCz0v\npOZI99vjF4buz4V2o3ZmdCQ1DuhRnTcbLCQvgrar1M0V4EC+6Cne4CQ/38GeAyOi\nnj2pEJZ9YQCgREj8VD3K9f6/tQ+9uJqqvCocCFN1pXEarOyeolnqxzZouoRGECHr\nvbSq0SNan94jZ/iDEAR4ITGTnF2U4StUbwUEi2RYkQKBgQDoylN43I1H0COMW6mg\nb1+nr+Hcyb9BPovpDfZdloNS8utJX+dSGIA5nLuUo7TlMV7+krEag+OQvrPuuC2w\nt1w+IK2z8Nd3f5r3ByMRXt0pJ4rS2HEaKWDQ6bZhTYMGHxgZjaHHhm+4qvSwvmKZ\nRmb8HkgnvQ91BZT53iIlS65X7QKBgQDkuvmfpd+7c1t+h2MD0nJV0WhSRwwnoZg5\npTgtCaho638zzPInbWj6UhYeHa3JYNXju6EfROxfFkBOZ7WQDu3TjzmawrayAQn8\nSZ4XTvP5KwITkSnp4oLPcHdy6PgXd8W3g9VHkuS+mTsot+AmFnkp8IrlNTAhrfEX\n7qiAh8E2JQKBgDjIcYf/tG6Z9LHeAghiYmDS5DMo+v/9M7+Lalb1yd7H5mClhhVe\naJilBJSDQjLN0jAitBSVq0K5YcaPIoYCk/uLmRNVYhmCBNjQ4trv2t6ZCKHZre0F\nvtn2yEf/0kACAazqAVZcEpBnEvyx0/czVxeUg2E+GrEexXIVnxqd1U8ZAoGBAMzo\nL+50tA0C2AlvEiX/Zsw4sENdQKdUXcHuoHfAei2cIzVtudXWb0ApP4U1Q1XvuU2t\n7jbMERFSJsPWptHqfeaUHZ/mJbMruR1ZehYZdflXLSIIXssXT+a0M14vFOo5M1gm\n82+OSfvx3AyrRVP5uAv5YQTbdEYHxL+S30Nd2po9AoGALC3Kqr92A2g0JYGcfsaV\nQIT6Mc5C8WemBtH8FAySrYxRxO+BCNOG0fvI3iKS2eyzdMZ06jI6e5dX6Ota9rES\nm85wkJ3wYvbA4KMeAjxhxZmQxo7s4XnP21VJXSsXm6s/RR26EWHLcjwUxRTzYWy1\nOIlOGdxPP1lBbbApCB451R4=\n-----END PRIVATE KEY-----\n"
