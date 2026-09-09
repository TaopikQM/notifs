// pages/admin.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { ref, onValue, push, set, get, child } from 'firebase/database';

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [newUserName, setNewUserName] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [loading, setLoading] = useState(true);

  // 1. Ambil semua user
  useEffect(() => {
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      setLoading(false);
      if (data) {
        const userList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        const filteredUsers = userList.filter(u => u.role === 'user');
        setUsers(filteredUsers);
      } else {
        setUsers([]);
      }
    });
  }, []);

  // 2. Jika user dipilih, ambil riwayat chat
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
        const relevantChat = allMessages.filter(m => 
          (m.senderId === 'admin' && m.receiverId === selectedUser.id) ||
          (m.senderId === selectedUser.id && m.receiverId === 'admin')
        );
        setChatHistory(relevantChat.sort((a, b) => a.timestamp - b.timestamp));
      } else {
        setChatHistory([]);
      }
    });
    return () => unsubscribe();
  }, [selectedUser]);

  const handleLogout = () => router.push('/');

  const handleAddUser = async () => {
    if (!newUserName.trim()) return;
    const userId = 'user_' + Math.random().toString(36).substr(2, 9);
    const userRef = ref(db, 'users/' + userId);
    await set(userRef, {
      id: userId,
      name: newUserName,
      role: 'user',
      isOnline: false,
      fcm_token: ''
    });
    setNewUserName('');
    setShowAddUser(false);
    alert('✅ User berhasil ditambahkan: ' + newUserName);
  };

  const handleSendMessageToAll = async () => {
    if (!message.trim()) return;
    const notifData = {
      title: 'Pesan dari Admin',
      body: message,
      senderId: 'admin',
      receiverId: 'all',
      content: message,
      timestamp: Date.now(),
      type: 'broadcast'
    };
    const newRef = push(ref(db, 'messages'));
    await set(newRef, notifData);
    setMessage('');
    alert('✅ Notifikasi terkirim ke SEMUA user!');
  };

  const handleSendMessageToUser = async () => {
    if (!message.trim() || !selectedUser) return;
    const newMessage = {
      senderId: 'admin',
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
        /* === Tampilan Utama: Daftar User & Broadcast === */
        <div>
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setShowAddUser(!showAddUser)}
              style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {showAddUser ? 'Batal' : 'Tambah User Baru'}
            </button>
            
            <button 
              onClick={handleSendMessageToAll}
              style={{ padding: '10px 20px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Kirim Broadcast ke Semua User
            </button>
          </div>

          {showAddUser && (
            <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '8px' }}>
              <h3>Tambah User Baru</h3>
              <input 
                type="text" 
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Nama User"
                style={{ width: '70%', padding: '8px', marginRight: '10px' }}
              />
              <button onClick={handleAddUser} style={{ padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Tambah
              </button>
            </div>
          )}

          <h3>Daftar User ({users.length})</h3>
          {users.length === 0 ? (
            <p>Belum ada user. Tambah user terlebih dahulu.</p>
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
                >
                  <div>
                    <StatusBadge online={u.isOnline} />
                    <strong>{u.name}</strong>
                    <div style={{ fontSize: '12px', color: '#666' }}>ID: {u.id}</div>
                  </div>
                  <small>{u.isOnline ? 'Online' : 'Offline'}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        /* === Tampilan Chat dengan User Spesifik === */
        <div>
          <button 
            onClick={() => setSelectedUser(null)} 
            style={{ marginBottom: '15px', padding: '8px 12px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px', background: '#f9f9f9' }}
          >
            ← Kembali ke Daftar User
          </button>

          <div style={{ marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
            <h3>Chat dengan: {selectedUser.name}</h3>
            <p style={{ margin: 0 }}>
              Status: <StatusBadge online={selectedUser.isOnline} /> 
              <strong>{selectedUser.isOnline ? 'Online' : 'Offline'}</strong>
            </p>
          </div>

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
    </div>
  );
}
