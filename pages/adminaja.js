



// pages/admin.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, listenForMessages } from '../lib/firebase';
import { ref, set, onValue, push, child } from 'firebase/database';

export default function AdminPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [targetType, setTargetType] = useState('all'); // 'all' atau 'specific'

  useEffect(() => {
    // Ambil daftar user yang sedang online (dari DB)
    const userRef = ref(db, 'users');
    onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const userList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        // Filter user (bukan admin)
        const usersList = userList.filter(u => u.role === 'user');
        setUsers(usersList);
      }
    });
  }, []);

  const handleLogout = () => {
    router.push('/');
  };

  const handleSend = async () => {
    if (!message) return alert('Isi pesan dulu!');

    const notifData = {
      title: 'Pesan dari Admin',
      body: message,
      sender: 'admin',
      timestamp: Date.now()
    };

    if (targetType === 'all') {
      // Kirim ke semua user
      notifData.target = 'all';
    } else {
      // Kirim ke user spesifik
      notifData.target = selectedUser;
    }

    // Simpan ke database (Realtime)
    const newNotifRef = push(ref(db, 'notifications'));
    await set(newNotifRef, notifData);

    setMessage('');
    alert('✅ Notifikasi terkirim!');
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Dashboard Admin</h2>
        <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#e60000', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Keluar
        </button>
      </div>

      <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>Kirim Notifikasi Baru</h3>
        
        {/* Pilihan Target */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Target:</label>
          <select 
            value={targetType} 
            onChange={(e) => setTargetType(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="all">Semua User</option>
            <option value="specific">User Spesifik</option>
          </select>
        </div>

        {/* Dropdown User Spesifik */}
        {targetType === 'specific' && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Pilih User:</label>
            <select 
              value={selectedUser} 
              onChange={(e) => setSelectedUser(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">-- Pilih User --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.id} (Token: {u.fcm_token ? 'Ada' : 'Tidak'})</option>
              ))}
            </select>
            {users.length === 0 && <p style={{ color: '#888', fontSize: '14px' }}>Belum ada user online.</p>}
          </div>
        )}

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tulis pesan notifikasi..."
          style={{ width: '100%', height: '100px', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '10px' }}
        />
        
        <button 
          onClick={handleSend}
          style={{ width: '100%', padding: '12px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
        >
          Kirim Notifikasi
        </button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>Daftar User Online ({users.length})</h3>
        {users.length === 0 ? <p>Belum ada user online.</p> : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {users.map(u => (
              <li key={u.id} style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                {u.id} <span style={{ color: 'green', fontSize: '12px' }}>● Online</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}