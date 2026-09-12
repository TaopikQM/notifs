// pages/api/send-notification.js
import admin from 'firebase-admin';
import { db } from '../../lib/firebase';
import { ref, push, set, get } from 'firebase/database';

// Inisialisasi Firebase Admin (HANYA SEKALI)   
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) // Dari Vercel Env
      )
    });
  } catch (error) {
    console.error('Firebase Admin init error:', error);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { title, body, targetType, targetIds } = req.body;

  if (!title || !body) {
    return res.status(400).json({ message: 'Title dan Body wajib diisi' });
  }

  try {
    let receivers = [];

    // 1. Tentukan penerima
    if (targetType === 'all') {
      const usersRef = ref(db, 'users');
      const snapshot = await get(usersRef);
      const data = snapshot.val();
      if (data) {
        receivers = Object.keys(data).filter(key => data[key].role === 'user');
      }
    } else if (targetType === 'specific' && Array.isArray(targetIds)) {
      receivers = targetIds;
    }

    if (receivers.length === 0) {
      return res.status(400).json({ message: 'Tidak ada penerima valid' });
    }

    // 2. Ambil FCM Token dari Database untuk setiap receiver
     // const allTokens = [];
     let allTokens = [];
    for (const userId of receivers) {
      const userSnap = await get(ref(db, `users/${userId}/fcm_tokens`));
      // const token = userSnap.val();
      // if (token) {
      //   userTokens.push({ userId, token });
      // }
      
      const tokensArray = userSnap.val();
     if (tokensArray && Array.isArray(tokensArray) && tokensArray.length > 0) {
        allTokens.push(...tokensArray); // Gabungkan semua token
      }
    }

    // if (userTokens.length === 0) {
    //   return res.status(400).json({ message: 'Tidak ada user dengan FCM Token valid' });
    // }
    if (allTokens.length === 0) {
      return res.status(400).json({ 
        message: 'Tidak ada token FCM valid ditemukan di database',
        receivers: receivers.length,
        tokens: 0
      });
    }

    // 3. Simpan ke Realtime Database (untuk riwayat chat)
    const messageData = {
      title,
      content: body,
      senderId: 'api_system',
      timestamp: Date.now(),
      type: targetType
    };

    const dbPromises = receivers.map(receiverId => {
      const newRef = push(ref(db, 'messages'));
      return set(newRef, { ...messageData, receiverId });
    });
    await Promise.all(dbPromises);

    // 4. ✅ KIRIM PUSH NOTIFICATION VIA FCM HTTP v1
    const messaging = admin.messaging();
    // const pushPromises = userTokens.map(async ({ userId, token }) => {
    //   try {
    //     await messaging.send({
    //       token: token,
    //       notification: {
    //         title: title,
    //         body: body
    //       },
    //       webpush: {
    //         notification: {
    //           requireInteraction: true, // Agar notif tidak hilang otomatis di Android
    //           icon: '/favicon.ico'
    //         },
    //         fcmOptions: {
    //           link: `https://ns.vercel.app/user/${userId}` // Link saat notif diklik
    //         }
    //       }
    //     });
    //     console.log(`✅ Push sent to ${userId}`);
    //   } catch (pushError) {
    //     console.error(`❌ Push failed for ${userId}:`, pushError.message);
    //   }
    // });
    const pushPromises = allTokens.map(token => {
      return messaging.send({
        token: token,
        notification: {
          title: title,
          body: body
        },
        webpush: {
          notification: {
            requireInteraction: true,
            icon: '/favicon.ico'
          },
          fcmOptions: {
            // Link ini akan mengarah ke halaman user (tidak spesifik user, user login sendiri)
            link: 'https://notifs-peach.vercel.app/user' 
          }
        }
      }).catch(err => {
        console.error(`❌ Push failed for token:`, err.message);
      });
    });

    await Promise.all(pushPromises);

    res.status(200).json({
      message: 'Notifikasi berhasil dikirim ke DB + Push FCM',
      dbCount: receivers.length,
      pushCount: userTokens.length
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}


// // pages/api/send-notification.js
// import { db } from '../../lib/firebase';
// import { ref, push, set, get, onValue } from 'firebase/database';

// export default async function handler(req, res) {
//   // Hanya izinkan metode POST
//   if (req.method !== 'POST') {
//     return res.status(405).json({ message: 'Method Not Allowed' });
//   }

//   const { title, body, targetType, targetIds } = req.body;

//   // Validasi Input
//   if (!title || !body) {
//     return res.status(400).json({ message: 'Title dan Body wajib diisi' });
//   }

//   try {
//     let receivers = [];

//     // 1. Jika target adalah SEMUA USER
//     if (targetType === 'all') {
//       const usersRef = ref(db, 'users');
//       const snapshot = await get(usersRef);
//       const data = snapshot.val();
      
//       if (data) {
//         receivers = Object.keys(data).filter(key => data[key].role === 'user');
//       }
//     } 
//     // 2. Jika target SPESIFIK (array ID user)
//     else if (targetType === 'specific' && Array.isArray(targetIds)) {
//       receivers = targetIds;
//     }
//     // 3. Jika target SINGLE USER
//     else if (targetType === 'single' && targetIds) {
//       receivers = [targetIds]; // anggap targetIds adalah string ID
//     }

//     if (receivers.length === 0) {
//       return res.status(400).json({ message: 'Tidak ada penerima yang valid' });
//     }

//     // Simpan pesan ke Database (Realtime Database)
//     const messageData = {
//       title: title,
//       content: body,
//       senderId: 'api_system', // Penanda bahwa ini dikirim via API
//       timestamp: Date.now(),
//       type: targetType
//     };

//     // Looping simpan pesan ke setiap receiver
//     const promises = receivers.map(receiverId => {
//       const newRef = push(ref(db, 'messages'));
//       return set(newRef, {
//         ...messageData,
//         receiverId: receiverId
//       });
//     });

//     await Promise.all(promises);

//     // Response sukses
//     res.status(200).json({ 
//       message: 'Notifikasi berhasil dikirim', 
//       count: receivers.length 
//     });

//   } catch (error) {
//     console.error('API Error:', error);
//     res.status(500).json({ message: 'Internal Server Error', error: error.message });
//   }
// }
