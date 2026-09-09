// pages/user.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, requestPermissionAndGetToken, listenForMessages } from '../lib/firebase';
import { ref, set, onValue, child, push, get } from 'firebase/database';

export default function UserPage() {
  const router = useRouter();
  const [myToken, setMyToken] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    // 1. Generate/Load User ID dari LocalStorage
    let savedId = localStorage.getItem('notif_user_id');
    if (!savedId) {
      savedId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('notif_user_id', savedId);
    }
    setUserId(savedId);

    // 2. Ambil nama user (jika ada, dari input form atau default)
    const name = prompt("Masukkan nama Anda:") || "User_" + savedId.substring(5, 10);
    setUserName(name);

    // 3. Request Token & Update Status Online
    requestPermissionAndGetToken().then(token => {
      if (token) {
        setMyToken(token);
        const userRef = ref(db, 'users/' + savedId);
        set(userRef, { 
          id: savedId, 
          name: name,
          role: 'user', 
          fcm_token: token,
          isOnline: true,
          lastSeen: Date.now()
        });
      }
    });

    // 4. Listen Pesan (dari Admin & User Lain)
    const messagesRef = ref(db, 'messages');
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allMessages = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        // Filter pesan yang ditujukan ke user ini
        const myMessages = allMessages.filter(m => m.receiverId === savedId);
        setNotifications(myMessages.sort((a, b) => b.timestamp - a.timestamp));
      }
    });

    // 5. Listen FCM Push
    const unsubMessage = listenForMessages((payload) => {
      const { notification } = payload;
      if (notification) {
        setNotifications(prev => [{
          id: 'push_' + Date.now(),
          senderId: 'push_system',
          receiverId: savedId,
          content: notification.body,
          timestamp: Date.now(),
          isPush: true
        }, ...prev]);
      }
    });

    // Cleanup: Update status offline saat user keluar
    return () => {
      if (userId) {
        set(ref(db, 'users/' + userId), { isOnline: false, lastSeen: Date.now() });
      }
      unsubscribe();
      unsubMessage();
    };
  }, []);

  const handleLogout = () => {
    router.push('/');
  };

  if (!userId) {
    return <div style={{ padding: '20px' }}>⏳ Menyiapkan sesi user...</div>;
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Halaman User</h2>
        <span>Anda: {userId}</span>
        <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Keluar
        </button>
      </div>

      {myToken 
        ? <p style={{ color: 'green' }}>✅ Token Push terdaftar: {myToken.substring(0, 10)}...</p> 
        : <p>⏳ Meminta izin notifikasi...</p>
      }

      <h3>Pesan Masuk ({notifications.length})</h3>
      
      {notifications.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#888' }}>Belum ada pesan.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {notifications.map((n) => {
            // Tentukan nama pengirim
            let senderName = 'System';
            if (n.senderId === 'admin') senderName = 'Admin';
            else if (n.senderId.startsWith('user_')) senderName = 'User: ' + n.senderId;

            return (
              <li key={n.id} style={{ 
                padding: '15px', marginBottom: '10px', border: '1px solid #ddd', 
                borderRadius: '8px', background: n.isPush ? '#fff3cd' : '#f8f9fa'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{senderName}</strong>
                  <small style={{ color: '#666' }}>{new Date(n.timestamp).toLocaleTimeString()}</small>
                </div>
                <p style={{ margin: '5px 0 0' }}>{n.content || n.body}</p>
                {n.isPush && <small style={{ color: '#888' }}>🔔 Notifikasi Push</small>}
              </li>
            );
          })}
        </ul>
      )}
      
      <div style={{ marginTop: '20px', padding: '10px', background: '#e3f2fd', borderRadius: '4px', fontSize: '14px' }}>
        <strong>Catatan:</strong> Jika Admin mengirim pesan ke Anda, Anda akan menerima notif push meskipun browser ditutup.
      </div>
    </div>
  );
}












// // pages/user.js hanya nerima admin dan tidak online
// import { useState, useEffect } from 'react';
// import { useRouter } from 'next/router';
// import { db, requestPermissionAndGetToken, listenForMessages } from '../lib/firebase';
// import { ref, set, onValue } from 'firebase/database';

// export default function UserPage() {
//   const router = useRouter();
//   const [myToken, setMyToken] = useState(null);
//   const [notifications, setNotifications] = useState([]);
//   const [userId, setUserId] = useState(null);

//   useEffect(() => {
//     let savedId = localStorage.getItem('notif_user_id');
//     if (!savedId) {
//       savedId = 'user_' + Math.random().toString(36).substr(2, 9);
//       localStorage.setItem('notif_user_id', savedId);
//     }
//     setUserId(savedId);

//     requestPermissionAndGetToken().then(token => {
//       if (token) {
//         setMyToken(token);
//         const userRef = ref(db, 'users/' + savedId);
//         set(userRef, { 
//           id: savedId, 
//           role: 'user', 
//           fcm_token: token,
//           lastSeen: Date.now()
//         });
//       }
//     });

//     const notifRef = ref(db, 'notifications');
//     const unsubscribe = onValue(notifRef, (snapshot) => {
//       const data = snapshot.val();
//       if (data) {
//         const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
//         const myNotifs = list.filter(n => n.target === savedId || n.target === 'all');
//         setNotifications(myNotifs.sort((a, b) => b.timestamp - a.timestamp));
//       }
//     });

//     const unsubMessage = listenForMessages((payload) => {
//       const { notification } = payload;
//       if (notification) {
//         setNotifications(prev => [{
//           id: 'push_' + Date.now(),
//           title: notification.title,
//           body: notification.body,
//           sender: 'push_system',
//           target: 'all',
//           timestamp: Date.now(),
//           isPush: true
//         }, ...prev]);
//       }
//     });

//     return () => {
//       unsubscribe();
//       unsubMessage();
//     };
//   }, []);

//   const handleLogout = () => {
//     router.push('/');
//   };

//   if (!userId) {
//     return <div style={{ padding: '20px' }}>⏳ Menyiapkan sesi user...</div>;
//   }

//   return (
//     <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
//       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
//         <h2>Halaman User</h2>
//         <span>Anda: {userId}</span>
//         <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
//           Keluar
//         </button>
//       </div>

//       {myToken 
//         ? <p style={{ color: 'green' }}>✅ Token Push terdaftar: {myToken.substring(0, 10)}...</p> 
//         : <p>⏳ Meminta izin notifikasi...</p>
//       }

//       <h3>Pesan Masuk ({notifications.length})</h3>
      
//       {notifications.length === 0 ? (
//         <p style={{ textAlign: 'center', color: '#888' }}>Belum ada pesan.</p>
//       ) : (
//         <ul style={{ listStyle: 'none', padding: 0 }}>
//           {notifications.map((n) => (
//             <li key={n.id} style={{ 
//               padding: '15px', marginBottom: '10px', border: '1px solid #ddd', 
//               borderRadius: '8px', background: n.isPush ? '#fff3cd' : '#f8f9fa'
//             }}>
//               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
//                 <strong>{n.title}</strong>
//                 <small style={{ color: '#666' }}>{new Date(n.timestamp).toLocaleTimeString()}</small>
//               </div>
//               <p style={{ margin: '5px 0 0' }}>{n.body}</p>
//               <small style={{ color: '#888' }}>Dari: {n.sender || 'System'}</small>
//             </li>
//           ))}
//         </ul>
//       )}
//     </div>
//   );
// }



// // // pages/user.js
// // import { useState, useEffect } from 'react';
// // import { useRouter } from 'next/router';
// // import { db, requestPermissionAndGetToken, listenForMessages } from '../lib/firebase';
// // import { ref, set, onValue } from 'firebase/database';

// // export default function UserPage() {
// //   const router = useRouter();
// //   const [myToken, setMyToken] = useState(null);
// //   const [notifications, setNotifications] = useState([]);
  
// //   // ✅ PERBAIKAN: Mulai dengan null, generate ID hanya di client
// //   const [userId, setUserId] = useState(null);

// //   useEffect(() => {
// //     // Generate ID HANYA di browser (client-side)
// //     const newId = 'user_' + Math.random().toString(36).substr(2, 9);
// //     setUserId(newId);

// //     // 1. Minta izin dan ambil token
// //     requestPermissionAndGetToken().then(token => {
// //       if (token) {
// //         setMyToken(token);
// //         // Simpan token user di DB
// //         const userRef = ref(db, 'users/' + newId);
// //         set(userRef, { 
// //           id: newId, 
// //           role: 'user', 
// //           fcm_token: token,
// //           lastSeen: Date.now()
// //         });
// //       }
// //     });

// //     // 2. Listen notifikasi (gunakan newId, bukan userId dari state)
// //     const notifRef = ref(db, 'notifications');
// //     const unsubscribe = onValue(notifRef, (snapshot) => {
// //       const data = snapshot.val();
// //       if (data) {
// //         const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
// //         const myNotifs = list.filter(n => n.target === newId || n.target === 'all');
// //         setNotifications(myNotifs.sort((a, b) => b.timestamp - a.timestamp));
// //       }
// //     });

// //     // 3. Listen FCM Push
// //     const unsubMessage = listenForMessages((payload) => {
// //       const { notification } = payload;
// //       if (notification) {
// //         setNotifications(prev => [{
// //           id: 'push_' + Date.now(),
// //           title: notification.title,
// //           body: notification.body,
// //           sender: 'push_system',
// //           target: 'all',
// //           timestamp: Date.now(),
// //           isPush: true
// //         }, ...prev]);
// //       }
// //     });

// //     // Cleanup
// //     return () => {
// //       unsubscribe();
// //       unsubMessage();
// //     };
// //   }, []);

// //   const handleLogout = () => {
// //     router.push('/');
// //   };

// //   // ✅ PERBAIKAN: Render loading state sampai userId siap
// //   if (!userId) {
// //     return (
// //       <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
// //         <p>⏳ Menyiapkan sesi user...</p>
// //       </div>
// //     );
// //   }

// //   return (
// //     <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
// //       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
// //         <h2>Halaman User</h2>
// //         <span>Anda: {userId}</span>
// //         <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
// //           Keluar
// //         </button>
// //       </div>

// //       {myToken 
// //         ? <p style={{ color: 'green' }}>✅ Token Push terdaftar: {myToken.substring(0, 10)}...</p> 
// //         : <p>⏳ Meminta izin notifikasi...</p>
// //       }

// //       <h3>Pesan Masuk ({notifications.length})</h3>
      
// //       {notifications.length === 0 ? (
// //         <p style={{ textAlign: 'center', color: '#888' }}>Belum ada pesan.</p>
// //       ) : (
// //         <ul style={{ listStyle: 'none', padding: 0 }}>
// //           {notifications.map((n) => (
// //             <li key={n.id} style={{ 
// //               padding: '15px', marginBottom: '10px', border: '1px solid #ddd', 
// //               borderRadius: '8px', background: n.isPush ? '#fff3cd' : '#f8f9fa'
// //             }}>
// //               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
// //                 <strong>{n.title}</strong>
// //                 <small style={{ color: '#666' }}>{new Date(n.timestamp).toLocaleTimeString()}</small>
// //               </div>
// //               <p style={{ margin: '5px 0 0' }}>{n.body}</p>
// //               <small style={{ color: '#888' }}>Dari: {n.sender || 'System'}</small>
// //             </li>
// //           ))}
// //         </ul>
// //       )}
// //     </div>
// //   );
// // }





// // // // pages/user.js
// // // import { useState, useEffect } from 'react';
// // // import { useRouter } from 'next/router';
// // // import { db, requestPermissionAndGetToken, listenForMessages } from '../lib/firebase';
// // // import { ref, set, onValue, child, push } from 'firebase/database';

// // // export default function UserPage() {
// // //   const router = useRouter();
// // //   const [myToken, setMyToken] = useState(null);
// // //   const [notifications, setNotifications] = useState([]);
// // //   // const [userId] = useState('user_' + Math.random().toString(36).substr(2, 9)); // ID random sementara
// // //  // ✅ PERBAIKAN: Mulai dengan null, generate ID hanya di client
// // //   const [userId, setUserId] = useState(null);

// // //   useEffect(() => {
// // //     // 1. Minta izin dan ambil token
// // //     requestPermissionAndGetToken().then(token => {
// // //       if (token) {
// // //         setMyToken(token);
// // //         // Simpan token user di DB
// // //         const userRef = ref(db, 'users/' + userId);
// // //         set(userRef, { 
// // //           id: userId, 
// // //           role: 'user', 
// // //           fcm_token: token,
// // //           lastSeen: Date.now()
// // //         });
// // //       }
// // //     });

// // //     // 2. Listen notifikasi khusus user ini di DB
// // //     const notifRef = ref(db, 'notifications');
// // //     onValue(notifRef, (snapshot) => {
// // //       const data = snapshot.val();
// // //       if (data) {
// // //         const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
// // //         // Filter: Hanya tampilkan notifikasi yang targetnya user ini ATAU semua user
// // //         const myNotifs = list.filter(n => n.target === userId || n.target === 'all');
// // //         setNotifications(myNotifs.sort((a, b) => b.timestamp - a.timestamp));
// // //       }
// // //     });

// // //     // 3. Listen FCM Push saat app dibuka
// // //     listenForMessages((payload) => {
// // //       const { notification } = payload;
// // //       if (notification) {
// // //         // Tambah ke state UI jika app sedang dibuka
// // //         setNotifications(prev => [{
// // //           id: 'push_' + Date.now(),
// // //           title: notification.title,
// // //           body: notification.body,
// // //           sender: 'push_system',
// // //           target: 'all',
// // //           timestamp: Date.now(),
// // //           isPush: true
// // //         }, ...prev]);
// // //       }
// // //     });

// // //     // Cleanup listener
// // //     return () => {
// // //       // Tidak perlu cleanup onValue secara eksplisit di Next.js, tapi bagus practice
// // //     };
// // //   }, [userId]);

// // //   const handleLogout = () => {
// // //     router.push('/');
// // //   };

// // //   return (
// // //     <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
// // //       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
// // //         <h2>Halaman User</h2>
// // //         <span>Anda: {userId}</span>
// // //         <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
// // //           Keluar
// // //         </button>
// // //       </div>

// // //       {myToken ? <p style={{ color: 'green' }}>✅ Token Push terdaftar: {myToken.substring(0, 10)}...</p> : <p>⏳ Meminta izin notifikasi...</p>}

// // //       <h3>Pesan Masuk ({notifications.length})</h3>
      
// // //       {notifications.length === 0 ? (
// // //         <p style={{ textAlign: 'center', color: '#888' }}>Belum ada pesan.</p>
// // //       ) : (
// // //         <ul style={{ listStyle: 'none', padding: 0 }}>
// // //           {notifications.map((n) => (
// // //             <li key={n.id} style={{ 
// // //               padding: '15px', 
// // //               marginBottom: '10px', 
// // //               border: '1px solid #ddd', 
// // //               borderRadius: '8px',
// // //               background: n.isPush ? '#fff3cd' : '#f8f9fa'
// // //             }}>
// // //               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
// // //                 <strong>{n.title}</strong>
// // //                 <small style={{ color: '#666' }}>{new Date(n.timestamp).toLocaleTimeString()}</small>
// // //               </div>
// // //               <p style={{ margin: '5px 0 0' }}>{n.body}</p>
// // //               <small style={{ color: '#888' }}>Dari: {n.sender || 'System'}</small>
// // //             </li>
// // //           ))}
// // //         </ul>
// // //       )}
      
// // //       <div style={{ marginTop: '20px', padding: '10px', background: '#e3f2fd', borderRadius: '4px', fontSize: '14px' }}>
// // //         <strong>Catatan:</strong> Notifikasi juga akan muncul di device Anda meskipun tab ditutup (jika Service Worker aktif).
// // //       </div>
// // //     </div>
// // //   );
// // // }