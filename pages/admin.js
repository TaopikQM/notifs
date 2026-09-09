// pages/admin.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { ref, onValue, push, set, get } from 'firebase/database';

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null); // User yang dipilih untuk chat
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Ambil semua user dari database
  useEffect(() => {
    const usersRef = ref(db, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      setLoading(false);
      
      if (data) {
        // Convert object ke array
        const userList = Object.keys(data).map(key => ({ 
          id: key, 
          ...data[key] 
        }));
        
        // Filter hanya role 'user' (bukan admin)
        const filteredUsers = userList.filter(u => u.role === 'user');
        setUsers(filteredUsers);
      } else {
        setUsers([]);
      }
    }, (error) => {
      console.error("Error ambil user:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Jika user dipilih, ambil riwayat chat dengan user tersebut
  useEffect(() => {
    if (!selectedUser) {
      setChatHistory([]);
      return;
    }

    const messagesRef = ref(db, 'messages');
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allMessages = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        
        // Filter pesan antara Admin dan User terpilih
        const relevantChat = allMessages.filter(m => 
          (m.senderId === 'admin' && m.receiverId === selectedUser.id) ||
          (m.senderId === selectedUser.id && m.receiverId === 'admin')
        );

        // Urutkan berdasarkan waktu
        setChatHistory(relevantChat.sort((a, b) => a.timestamp - b.timestamp));
      } else {
        setChatHistory([]);
      }
    });

    return () => unsubscribe();
  }, [selectedUser]);

  const handleLogout = () => {
    router.push('/');
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedUser) return;

    const newMessageData = {
      senderId: 'admin',
      receiverId: selectedUser.id,
      content: message,
      timestamp: Date.now(),
      read: false
    };

    try {
      const newMessageRef = push(ref(db, 'messages'));
      await set(newMessageRef, newMessageData);
      setMessage(''); // Kosongkan input
    } catch (error) {
      console.error("Gagal kirim:", error);
      alert("Gagal kirim pesan");
    }
  };

  // Helper untuk status badge
  const StatusBadge = ({ online }) => (
    <span style={{ 
      display: 'inline-block', 
      width: '10px', 
      height: '10px', 
      borderRadius: '50%', 
      background: online ? '#28a745' : '#dc3545',
      marginRight: '8px'
    }} />
  );

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Dashboard Admin</h2>
        <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#e60000', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Keluar
        </button>
      </div>

      {!selectedUser ? (
        /* --- TAMPILAN DAFTAR USER --- */
        <div>
          <h3>Daftar User ({users.length})</h3>
          {users.length === 0 ? (
            <p>Belum ada user yang terdaftar. Buka halaman User di tab lain dulu.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {users.map(u => (
                <li 
                  key={u.id} 
                  onClick={() => setSelectedUser(u)}
                  style={{ 
                    padding: '15px', 
                    marginBottom: '10px', 
                    border: '1px solid #ddd', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#fff'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f0f0f0'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                >
                  <div>
                    <StatusBadge online={u.isOnline} />
                    <strong>{u.name || 'User Tanpa Nama'}</strong>
                    <div style={{ fontSize: '12px', color: '#666' }}>ID: {u.id}</div>
                  </div>
                  <small>{u.isOnline ? 'Online' : 'Offline'}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        /* --- TAMPILAN CHAT DENGAN USER SPESIFIK --- */
        <div>
          <button 
            onClick={() => setSelectedUser(null)} 
            style={{ marginBottom: '15px', padding: '8px 12px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px', background: '#f9f9f9' }}
          >
            ← Kembali
          </button>

          <div style={{ marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
            <h3>Chat dengan: {selectedUser.name || selectedUser.id}</h3>
            <p style={{ margin: 0 }}>
              Status: <StatusBadge online={selectedUser.isOnline} /> 
              <strong>{selectedUser.isOnline ? 'Online' : 'Offline (Notif Push akan dikirim jika offline)'}</strong>
            </p>
          </div>

          {/* Area Chat History */}
          <div style={{ 
            height: '300px', 
            overflowY: 'auto', 
            border: '1px solid #ccc', 
            padding: '15px', 
            marginBottom: '15px',
            background: '#f9f9f9',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {chatHistory.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#888', marginTop: '50%' }}>Belum ada pesan.</p>
            ) : (
              chatHistory.map(m => (
                <div key={m.id} style={{ 
                  marginBottom: '10px', 
                  maxWidth: '80%',
                  alignSelf: m.senderId === 'admin' ? 'flex-end' : 'flex-start',
                  padding: '10px',
                  borderRadius: '10px',
                  background: m.senderId === 'admin' ? '#0070f3' : '#e9ecef',
                  color: m.senderId === 'admin' ? 'white' : 'black'
                }}>
                  <p style={{ margin: 0, wordBreak: 'break-word' }}>{m.content}</p>
                  <small style={{ fontSize: '10px', opacity: 0.7, display: 'block', textAlign: 'right' }}>
                    {new Date(m.timestamp).toLocaleTimeString()}
                  </small>
                </div>
              ))
            )}
          </div>

          {/* Input Pesan */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ketik pesan..."
              style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button 
              onClick={handleSendMessage}
              style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Kirim
            </button>
          </div>
        </div>
      )}
    </div>
  );
}







// // pages/admin.js
// import { useState, useEffect } from 'react';
// import { useRouter } from 'next/router';
// import { db, listenForMessages } from '../lib/firebase';
// import { ref, set, onValue, push, child } from 'firebase/database';

// export default function AdminPage() {
//   const router = useRouter();
//   const [message, setMessage] = useState('');
//   const [users, setUsers] = useState([]);
//   const [selectedUser, setSelectedUser] = useState('');
//   const [targetType, setTargetType] = useState('all'); // 'all' atau 'specific'

//   useEffect(() => {
//     // Ambil daftar user yang sedang online (dari DB)
//     const userRef = ref(db, 'users');
//     onValue(userRef, (snapshot) => {
//       const data = snapshot.val();
//       if (data) {
//         const userList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
//         // Filter user (bukan admin)
//         const usersList = userList.filter(u => u.role === 'user');
//         setUsers(usersList);
//       }
//     });
//   }, []);

//   const handleLogout = () => {
//     router.push('/');
//   };

//   const handleSend = async () => {
//     if (!message) return alert('Isi pesan dulu!');

//     const notifData = {
//       title: 'Pesan dari Admin',
//       body: message,
//       sender: 'admin',
//       timestamp: Date.now()
//     };

//     if (targetType === 'all') {
//       // Kirim ke semua user
//       notifData.target = 'all';
//     } else {
//       // Kirim ke user spesifik
//       notifData.target = selectedUser;
//     }

//     // Simpan ke database (Realtime)
//     const newNotifRef = push(ref(db, 'notifications'));
//     await set(newNotifRef, notifData);

//     setMessage('');
//     alert('✅ Notifikasi terkirim!');
//   };

//   return (
//     <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
//       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
//         <h2>Dashboard Admin</h2>
//         <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#e60000', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
//           Keluar
//         </button>
//       </div>

//       <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
//         <h3>Kirim Notifikasi Baru</h3>
        
//         {/* Pilihan Target */}
//         <div style={{ marginBottom: '15px' }}>
//           <label style={{ display: 'block', marginBottom: '5px' }}>Target:</label>
//           <select 
//             value={targetType} 
//             onChange={(e) => setTargetType(e.target.value)}
//             style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
//           >
//             <option value="all">Semua User</option>
//             <option value="specific">User Spesifik</option>
//           </select>
//         </div>

//         {/* Dropdown User Spesifik */}
//         {targetType === 'specific' && (
//           <div style={{ marginBottom: '15px' }}>
//             <label style={{ display: 'block', marginBottom: '5px' }}>Pilih User:</label>
//             <select 
//               value={selectedUser} 
//               onChange={(e) => setSelectedUser(e.target.value)}
//               style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
//             >
//               <option value="">-- Pilih User --</option>
//               {users.map(u => (
//                 <option key={u.id} value={u.id}>{u.id} (Token: {u.fcm_token ? 'Ada' : 'Tidak'})</option>
//               ))}
//             </select>
//             {users.length === 0 && <p style={{ color: '#888', fontSize: '14px' }}>Belum ada user online.</p>}
//           </div>
//         )}

//         <textarea
//           value={message}
//           onChange={(e) => setMessage(e.target.value)}
//           placeholder="Tulis pesan notifikasi..."
//           style={{ width: '100%', height: '100px', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '10px' }}
//         />
        
//         <button 
//           onClick={handleSend}
//           style={{ width: '100%', padding: '12px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
//         >
//           Kirim Notifikasi
//         </button>
//       </div>

//       <div style={{ marginTop: '20px' }}>
//         <h3>Daftar User Online ({users.length})</h3>
//         {users.length === 0 ? <p>Belum ada user online.</p> : (
//           <ul style={{ listStyle: 'none', padding: 0 }}>
//             {users.map(u => (
//               <li key={u.id} style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
//                 {u.id} <span style={{ color: 'green', fontSize: '12px' }}>● Online</span>
//               </li>
//             ))}
//           </ul>
//         )}
//       </div>
//     </div>
//   );
// }