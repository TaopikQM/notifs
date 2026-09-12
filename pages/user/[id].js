// pages/user/[id].js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, requestPermissionAndGetToken, listenForMessages } from '../../lib/firebase';
import { ref, set, onValue, push, get, update } from 'firebase/database';
import { getDeviceType, getBrowser } from '../../lib/device-utils'; // Import 

export default function UserPage({ userId }) {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState(null);
  const [myToken, setMyToken] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // User lain (kecuali diri sendiri)
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    // 1. Cek apakah user ini ada di database
    const userRef = ref(db, 'users/' + userId);
    get(userRef).then((snapshot) => {
      const data = snapshot.val();
      if (data) {
        setUserProfile(data);
        if (!data.name) {
          const name = prompt("Masukkan nama Anda:") || "User_" + userId.substring(5, 10);
          set(ref(userRef, 'name'), name);
          setUserProfile({ ...data, name });
        }
      } else {
        alert("User ID tidak ditemukan! Akses link yang benar.");
        router.push('/');
      }
    });

    // 2. Request Token & Update Status Online
    requestPermissionAndGetToken().then(token => {
      if (token) {
        setMyToken(token);
        // set(ref(userRef, 'fcm_token'), token);
        // set(ref(userRef, 'isOnline'), true);
        // set(ref(userRef, 'lastSeen'), Date.now());

        // Ambil User Agent (Browser mengirim ini secara otomatis)
        const userAgent = navigator.userAgent;
        const deviceInfo = getDeviceType(userAgent);
        const browserName = getBrowser(userAgent);

        // // Update data user di Firebase dengan info device terbaru
        // // Kita gunakan update() agar tidak menimpa data lain
        // update(userRef, {
        //   fcm_token: token,
        //   isOnline: true,
        //   lastSeen: Date.now(),
        //   device_name: `${deviceInfo.device} (${deviceInfo.platform})`,
        //   browser: browserName,
        //   user_agent_raw: userAgent // Opsional: simpan raw string untuk debug
        // }).then(() => {
        //   console.log('✅ Device info updated:', deviceInfo.device);
        const newDevice = {
          name: `${deviceInfo.device} (${deviceInfo.platform})`,
          browser: browserName,
          lastSeen: Date.now(),
          timestamp: Date.now()
        };

        // Ambil data user terbaru lagi (untuk memastikan kita ambil array yang benar)
        get(userRef).then((currentSnapshot) => {
          const currentData = currentSnapshot.val();
          
          // Jika 'devices' belum ada, buat array baru
          let devicesList = [];
          if (currentData && currentData.devices) {
            devicesList = Array.isArray(currentData.devices) ? [...currentData.devices] : [];
          }

          // Cek apakah device ini sudah pernah dicatat (opsional, untuk hindari duplikat jika login berkali-kali di device sama dalam waktu singkat)
          const isDuplicate = devicesList.some(d => d.name === newDevice.name && (Date.now() - d.timestamp < 60000)); // Jika sama dalam 1 menit, abaikan

          if (!isDuplicate) {
            // Tambahkan device baru ke array
            devicesList.push(newDevice);
            
            // Update Firebase dengan array yang sudah diperbarui
            update(userRef, {
              fcm_token: token,
              isOnline: true,
              lastSeen: Date.now(),
              devices: devicesList // Simpan array lengkap
            }).then(() => {
              console.log('✅ Device ditambahkan ke daftar:', newDevice.name);
            });
          } else {
            console.log('ℹ️ Device sudah ada (mungkin update status online), tidak menambah duplikat.');
          }
        });
      }
    });

    // 3. Ambil semua user lain (kecuali diri sendiri)
    const usersRef = ref(db, 'users');
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const userList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        const others = userList.filter(u => u.role === 'user' && u.id !== userId);
        setAllUsers(others);
        setLoading(false);
      } else {
        setAllUsers([]);
        setLoading(false);
      }
    });

    // 4. Listen semua pesan (Notifikasi & Chat)
    const messagesRef = ref(db, 'messages');
    const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allMessages = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        
        // Notifikasi: receiverId = userId ATAU receiverId = 'all'
        const myNotifs = allMessages.filter(m => 
          m.receiverId === userId || m.receiverId === 'all'
        );
        setNotifications(myNotifs.sort((a, b) => b.timestamp - a.timestamp));

        // Chat History: jika ada user yang dipilih
        if (selectedUser) {
          const userChat = allMessages.filter(m => 
            (m.senderId === userId && m.receiverId === selectedUser.id) ||
            (m.senderId === selectedUser.id && m.receiverId === userId)
          );
          setChatHistory(userChat.sort((a, b) => a.timestamp - b.timestamp));
        }
      } else {
        setNotifications([]);
      }
    });

    // 5. Listen FCM Push
    const unsubMessage = listenForMessages((payload) => {
      const { notification } = payload;
      if (notification) {
        setNotifications(prev => [{
          id: 'push_' + Date.now(),
          senderId: 'push_system',
          receiverId: userId,
          content: notification.body,
          timestamp: Date.now(),
          isPush: true
        }, ...prev]);
      }
    });

    // Cleanup
    return () => {
      if (userId) {
        set(ref(userRef, 'isOnline'), false);
        set(ref(userRef, 'lastSeen'), Date.now());
      }
      unsubscribeUsers();
      unsubscribeMessages();
      unsubMessage();
    };
  }, [userId, selectedUser]);

  const handleLogout = () => router.push('/');

  const handleSendMessageToUser = async () => {
    if (!message.trim() || !selectedUser) return;
    const newMessage = {
      senderId: userId,
      receiverId: selectedUser.id,
      content: message,
      timestamp: Date.now(),
      type: 'direct'
    };
    const newRef = push(ref(db, 'messages'));
    await set(newRef, newMessage);
    setMessage('');
    alert('✅ Pesan terkirim ke ' + selectedUser.name);
  };

  const getStatusBadge = (online) => (
    <span style={{ 
      display: 'inline-block', 
      width: '10px', 
      height: '10px', 
      borderRadius: '50%', 
      background: online ? '#28a745' : '#dc3545',
      marginRight: '8px'
    }} />
  );

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>⏳ Memuat sesi user...</div>;
  if (!userProfile) return <div style={{ padding: '20px', textAlign: 'center' }}>User tidak ditemukan.</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>👤 Dashboard User</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <span>ID: <code>{userId}</code></span>
          <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Keluar
          </button>
        </div>
      </div>

      {myToken ? (
        <div style={{ padding: '15px', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '8px', marginBottom: '20px' }}>
          <strong>✅ Notifikasi Sudah Diaktifkan!</strong><br/>
          Token FCM: <code style={{ background: '#fff', padding: '5px', borderRadius: '4px', display: 'block', marginTop: '5px', wordBreak: 'break-all' }}>{myToken}</code>
        </div>
      ) : (
        <div style={{ padding: '15px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', marginBottom: '20px' }}>
          ⏳ Meminta izin notifikasi...
        </div>
      )}

              {/* === TAMPILAN TOKEN & STATUS === */}
      {myToken ? (
        <div style={{ 
          padding: '15px', 
          background: '#d4edda', 
          border: '1px solid #c3e6cb', 
          borderRadius: '8px', 
          marginBottom: '20px',
          position: 'relative'
        }}>
          <strong>✅ Notifikasi Aktif</strong>
          <p style={{ margin: '10px 0 5px 0', fontSize: '14px', color: '#155724' }}>
            Token Perangkat Kamu (FCM Token):
          </p>
          
          {/* Kotak Token yang bisa di-scroll */}
          <div style={{ 
            background: '#fff', 
            padding: '10px', 
            borderRadius: '4px', 
            border: '1px solid #28a745',
            wordBreak: 'break-all',
            fontSize: '12px',
            fontFamily: 'monospace',
            maxHeight: '80px',
            overflowY: 'auto',
            color: '#333'
          }}>
            {myToken}
          </div>

          {/* Tombol Copy Token */}
          <button 
            onClick={() => {
              navigator.clipboard.writeText(myToken);
              alert('✅ Token berhasil disalin!');
            }}
            style={{ 
              marginTop: '10px', 
              padding: '5px 10px', 
              background: '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📋 Copy Token
          </button>
        </div>
      ) : (
        <div style={{ 
          padding: '15px', 
          background: '#fff3cd', 
          border: '1px solid #ffc107', 
          borderRadius: '8px', 
          marginBottom: '20px'
        }}>
          ⏳ <strong>Menunggu Izin Notifikasi...</strong><br/>
          <small style={{ color: '#856404' }}>
            Silakan klik tombol "Allow" pada pop-up browser untuk mendapatkan Token.
          </small>
        </div>
      )}

      {/* === DAFTAR USER LAIN (UNTUK CHAT) === */}
      <div style={{ marginBottom: '30px' }}>
        <h3>👥 Daftar User Lain (Klik untuk Chat)</h3>
        {allUsers.length === 0 ? (
          <p style={{ color: '#888' }}>Belum ada user lain.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
            {allUsers.map(u => (
              <div 
                key={u.id} 
                onClick={() => setSelectedUser(u)}
                style={{ 
                  padding: '15px', 
                  border: '1px solid #ddd', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  background: selectedUser?.id === u.id ? '#e3f2fd' : '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                    <span style={{ marginRight: '5px' }}>{getStatusBadge(u.isOnline)}</span>
                    <strong>{u.name}</strong>
                  </div>
                  <small style={{ color: '#666' }}>ID: {u.id}</small>
                </div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '10px' }}>
                  {u.isOnline ? 'Online' : 'Offline'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === AREA CHAT DENGAN USER TERPILIH === */}
      {selectedUser && (
        <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3>💬 Chat dengan {selectedUser.name}</h3>
            <button onClick={() => setSelectedUser(null)} style={{ padding: '5px 10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Tutup
            </button>
          </div>
          
          <div style={{ height: '250px', overflowY: 'auto', border: '1px solid #eee', padding: '10px', marginBottom: '15px', background: '#fff', borderRadius: '4px' }}>
            {chatHistory.filter(m => 
              (m.senderId === userId && m.receiverId === selectedUser.id) ||
              (m.senderId === selectedUser.id && m.receiverId === userId)
            ).length === 0 ? (
              <p style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>Belum ada pesan.</p>
            ) : (
              chatHistory.filter(m => 
                (m.senderId === userId && m.receiverId === selectedUser.id) ||
                (m.senderId === selectedUser.id && m.receiverId === userId)
              ).map(m => (
                <div key={m.id} style={{ 
                  marginBottom: '10px', 
                  maxWidth: '80%',
                  alignSelf: m.senderId === userId ? 'flex-end' : 'flex-start',
                  padding: '10px',
                  borderRadius: '10px',
                  background: m.senderId === userId ? '#0070f3' : '#e9ecef',
                  color: m.senderId === userId ? 'white' : 'black',
                  wordBreak: 'break-word'
                }}>
                  <p style={{ margin: 0 }}>{m.content}</p>
                  <small style={{ fontSize: '10px', opacity: 0.7, display: 'block', textAlign: 'right', marginTop: '5px' }}>
                    {new Date(m.timestamp).toLocaleTimeString()}
                  </small>
                </div>
              ))
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ketik pesan..."
              style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessageToUser()}
            />
            <button 
              onClick={handleSendMessageToUser}
              style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Kirim
            </button>
          </div>
        </div>
      )}

      {/* === NOTIFIKASI DARI ADMIN & USER LAIN === */}
      <div>
        <h3>📬 Pesan Masuk ({notifications.length})</h3>
        {notifications.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888' }}>Belum ada pesan.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
            {notifications.map((n) => {
              let senderName = 'System';
              if (n.senderId === 'admin') senderName = 'Admin';
              else if (n.senderId.startsWith('user_')) {
                const u = allUsers.find(u => u.id === n.senderId);
                senderName = u ? u.name : n.senderId;
              }

              return (
                <div key={n.id} style={{ 
                  padding: '15px', 
                  border: '1px solid #ddd', 
                  borderRadius: '8px', 
                  background: n.isPush ? '#fff3cd' : '#f8f9fa'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <strong>{senderName}</strong>
                    <small style={{ color: '#666' }}>{new Date(n.timestamp).toLocaleTimeString()}</small>
                  </div>
                  <p style={{ margin: '0 0 5px 0' }}>{n.content || n.body}</p>
                  {n.isPush && <small style={{ color: '#888', display: 'flex', alignItems: 'center' }}>
                    🔔 Notifikasi Push
                  </small>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Server-Side Rendering untuk mendapatkan ID dari URL
export async function getServerSideProps({ params }) {
  return {
    props: {
      userId: params.id,
    },
  };
}
