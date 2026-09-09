// pages/user.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, requestPermissionAndGetToken, listenForMessages } from '../lib/firebase';
import { ref, set, onValue, push, get } from 'firebase/database';

export default function UserPage() {
  const router = useRouter();
  const [myToken, setMyToken] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let savedId = localStorage.getItem('notif_user_id');
    if (!savedId) {
      savedId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('notif_user_id', savedId);
    }
    setUserId(savedId);

    const name = prompt("Masukkan nama Anda:") || "User_" + savedId.substring(5, 10);
    setUserName(name);

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

    // 1. Listen semua pesan (untuk notifikasi)
    const messagesRef = ref(db, 'messages');
    const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allMessages = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        // Filter pesan yang ditujukan ke user ini
        const myNotifs = allMessages.filter(m => 
          m.receiverId === savedId || 
          m.receiverId === 'all'
        );
        setNotifications(myNotifs.sort((a, b) => b.timestamp - a.timestamp));
        
        // Jika ada chat history dengan user yang dipilih, update chatHistory
        if (selectedUser) {
          const userChat = allMessages.filter(m => 
            (m.senderId === 'admin' && m.receiverId === savedId) ||
            (m.receiverId === 'admin' && m.senderId === savedId) ||
            (m.senderId === selectedUser.id && m.receiverId === savedId) ||
            (m.receiverId === selectedUser.id && m.senderId === savedId)
          );
          setChatHistory(userChat.sort((a, b) => a.timestamp - b.timestamp));
        }
      } else {
        setNotifications([]);
      }
    });

    // 2. Listen semua user (untuk fitur chat)
    const usersRef = ref(db, 'users');
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const userList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        const filteredUsers = userList.filter(u => u.role === 'user' && u.id !== savedId);
        setUsers(filteredUsers);
        setLoading(false);
      } else {
        setUsers([]);
        setLoading(false);
      }
    });

    // 3. Listen FCM Push
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

    return () => {
      if (userId) {
        set(ref(db, 'users/' + userId), { isOnline: false, lastSeen: Date.now() });
      }
      unsubscribeMessages();
      unsubscribeUsers();
      unsubMessage();
    };
  }, [selectedUser]);

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

  if (loading || !userId) return <div style={{ padding: '20px' }}>⏳ Menyiapkan sesi user...</div>;

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

      <div style={{ marginBottom: '20px' }}>
        <h3>Daftar User Lain</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {users.map(u => (
            <li 
              key={u.id} 
              onClick={() => setSelectedUser(u)}
              style={{ 
                padding: '10px', 
                marginBottom: '5px', 
                border: '1px solid #ddd', 
                borderRadius: '4px', 
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <span style={{ marginRight: '5px' }}>{getStatusBadge(u.isOnline)}</span>
                <strong>{u.name}</strong>
              </div>
              <small>{u.isOnline ? 'Online' : 'Offline'}</small>
            </li>
          ))}
        </ul>
      </div>

      {selectedUser && (
        <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '8px' }}>
          <h3>Chat dengan {selectedUser.name}</h3>
          <div style={{ height: '200px', overflowY: 'auto', border: '1px solid #eee', padding: '10px', marginBottom: '10px', background: '#f9f9f9' }}>
            {chatHistory.filter(m => 
              (m.senderId === userId && m.receiverId === selectedUser.id) ||
              (m.senderId === selectedUser.id && m.receiverId === userId)
            ).length === 0 ? (
              <p style={{ textAlign: 'center', color: '#888' }}>Belum ada pesan.</p>
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
                  color: m.senderId === userId ? 'white' : 'black'
                }}>
                  <p style={{ margin: 0, wordBreak: 'break-word' }}>{m.content}</p>
                  <small style={{ fontSize: '10px', opacity: 0.7, display: 'block', textAlign: 'right' }}>
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

      <div>
        <h3>Pesan Masuk ({notifications.length})</h3>
        {notifications.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888' }}>Belum ada pesan.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {notifications.map((n) => {
              let senderName = 'System';
              if (n.senderId === 'admin') senderName = 'Admin';
              else if (n.senderId.startsWith('user_')) {
                const u = users.find(u => u.id === n.senderId);
                senderName = u ? u.name : n.senderId;
              }

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
      </div>
    </div>
  );
}
