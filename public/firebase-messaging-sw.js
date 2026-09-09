// public/service-worker.js
// importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js');
// importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js');

importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAxaRJ7h5TlE_-1eU-AHwr9S3W-yFAMSwM",
  authDomain: "dolanrekid.firebaseapp.com",
  projectId: "dolanrekid",
  storageBucket: "dolanrekid.appspot.com",
  messagingSenderId: "306874347713",
  appId: "1:306874347713:web:a5fe7af51d7b3658bca440"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();



messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message', payload);
  const { title, body } = payload.notification;
  self.registration.showNotification(title || 'Notifikasi', { body });
});
// // Handle pesan saat tab tertutup
// messaging.onBackgroundMessage((payload) => {
//   console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
//   // Extract notification data
//   const notificationTitle = payload.notification.title || 'Notifikasi Baru';
//   const notificationOptions = {
//     body: payload.notification.body || 'Anda memiliki pesan baru',
//     icon: '/firebase-logo.png' // Pastikan icon ada di public folder, atau hapus baris ini jika tidak ada
//   };

//   self.registration.showNotification(notificationTitle, notificationOptions);
// });


// // public/service-worker.js
// importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js');
// importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js');

// const firebaseConfig = {
//   apiKey: "YOUR_API_KEY",
//   authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
//   projectId: "YOUR_PROJECT_ID",
//   storageBucket: "YOUR_PROJECT_ID.appspot.com",
//   messagingSenderId: "YOUR_SENDER_ID",
//   appId: "YOUR_APP_ID"
// };

// firebase.initializeApp(firebaseConfig);

// const messaging = new firebase.messaging.Messaging();

// // Handle pesan saat tab tertutup
// messaging.setBackgroundMessageHandler((payload) => {
//   const notification = payload.notification;
  
//   return self.registration.showNotification(notification.title, {
//     body: notification.body,
//     icon: '/icon.png', // Pastikan ada icon di folder public
//     tag: 'notif-tag',
//     requireInteraction: false
//   });
// });




// // // public/service-worker.js
// // importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js');
// // importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js');

// // const firebaseConfig = {
// //   apiKey: "AIzaSyAxaRJ7h5TlE_-1eU-AHwr9S3W-yFAMSwM",
// //   authDomain: "dolanrekid.firebaseapp.com",
// //   databaseURL: "https://dolanrekid-default-rtdb.asia-southeast1.firebasedatabase.app", // Sesuaikan rtdb url kamu jika ada
// //   projectId: "dolanrekid",
// //   storageBucket: "dolanrekid.appspot.com",
// //   messagingSenderId: "306874347713", // Contoh angka sender id kamu
// //   appId: "1:306874347713:web:a5fe7af51d7b3658bca440" // Contoh app id kamu
// // };

// // firebase.initializeApp(firebaseConfig);

// // const messaging = new firebase.messaging.Messaging();

// // // Handle pesan saat app ditutup/tanpa tab aktif
// // messaging.setBackgroundMessageHandler((payload) => {
// //   const { title, body } = payload.notification;
  
// //   return self.registration.showNotification(title, {
// //     body: body,
// //     icon: '/icon-192x192.png', // Icon browser
// //     tag: 'notif-1'
// //   });
// // });