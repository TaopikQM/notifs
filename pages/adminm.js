// pages/admin.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { ref, onValue, push, set, get } from 'firebase/database';

export default function AdminPage() {
  const router = useRouter();
  const [newUserName, setNewUserName] = useState('');
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState('all'); // 'all' atau 'specific'
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Ambil semua user dari database
  useEffect(() => {
    const usersRef = ref(db, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      setLoading(false);
      if (data) {
        const userList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        // Filter hanya role 'user'
        const filteredUsers = userList.filter(u => u.role === 'user');
        setUsers(filteredUsers);
      } else {
        setUsers([]);
      }
    });
    return () => unsubscribe();
  }, []);

  //helper format nama device
  const formatDeviceU = (deviceName, browser) => {
    if (!deviceName) return <span style={{color: '#999'}}>-</span>;
    return (
      <div>
        <strong>{deviceName}</strong>
        <div style={{ fontSize: '11px', color: '#666' }}>🌐 {browser || 'Unknown Browser'}</div>
      </div>
    );
  };

// Helper untuk format daftar device
const formatDevicesList = (devicesArray) => {
  // Jika data belum ada, tampilkan tanda strip
  if (!devicesArray || !Array.isArray(devicesArray) || devicesArray.length === 0) {
    return <span style={{ color: '#999', fontStyle: 'italic' }}>Belum ada device</span>;
  }

  // Urutkan device dari yang terbaru (lastSeen)
  const sortedDevices = [...devicesArray].sort((a, b) => b.lastSeen - a.lastSeen);

  // Buat daftar item HTML
  const deviceItems = sortedDevices.map((device, index) => (
    <div key={index} style={{ 
      marginBottom: '4px', 
      paddingBottom: '4px', 
      borderBottom: index < sortedDevices.length - 1 ? '1px dashed #eee' : 'none'
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ 
          display: 'inline-block', 
          width: '8px', 
          height: '8px', 
          borderRadius: '50%', 
          background: device.lastSeen > (Date.now() - 300000) ? '#28a745' : '#dc3545', // Hijau jika < 5 menit lalu, Merah jika lama
          marginRight: '6px'
        }} title={device.lastSeen > (Date.now() - 300000) ? 'Online Baru Saja' : 'Offline'}></span>
        <strong style={{ fontSize: '13px' }}>{device.name}</strong>
      </div>
      <div style={{ fontSize: '11px', color: '#666', marginLeft: '14px' }}>
        🌐 {device.browser} • {new Date(device.lastSeen).toLocaleTimeString()}
      </div>
    </div>
  ));

  return <div style={{ lineHeight: '1.4' }}>{deviceItems}</div>;
};

// Di pages/admin.js, tambahkan fungsi ini

const formatFcmTokensList = (tokensArray) => {
  // Jika data belum ada, tampilkan tanda strip
  if (!tokensArray || !Array.isArray(tokensArray) || tokensArray.length === 0) {
    return <span style={{ color: '#999', fontStyle: 'italic' }}>Belum ada token</span>;
  }

  return (
    <div style={{ lineHeight: '1.6' }}>
      {tokensArray.map((token, index) => (
        <div 
          key={index} 
          style={{ 
            marginBottom: '8px',
            paddingBottom: '8px',
            borderBottom: index < tokensArray.length - 1 ? '1px dashed #eee' : 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '5px'
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ 
              fontSize: '11px', 
              fontFamily: 'monospace',
              background: '#f0f0f0',
              padding: '5px',
              borderRadius: '3px',
              wordBreak: 'break-all',
              color: '#333'
            }}>
              {token.substring(0, 30)}...
            </div>
            <small style={{ color: '#888', display: 'block', marginTop: '2px' }}>
              #{index + 1}
            </small>
          </div>
          <button
            onClick={() => copyToClipboard(token)}
            style={{
              padding: '3px 8px',
              fontSize: '10px',
              background: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginTop: '2px'
            }}
            title="Copy full token"
          >
            Copy
          </button>
        </div>
      ))}
      <div style={{ 
        marginTop: '8px', 
        padding: '5px 8px', 
        background: '#e3f2fd', 
        borderRadius: '3px',
        fontSize: '12px',
        fontWeight: 'bold',
        color: '#0070f3'
      }}>
        Total: {tokensArray.length} token
      </div>
    </div>
  );
};

  const handleLogout = () => router.push('/');

  // 2. Tambah User Baru
  const handleAddUser = async () => {
    if (!newUserName.trim()) return alert('Nama tidak boleh kosong!');
    
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
    alert(`✅ User "${newUserName}" berhasil ditambahkan!\nID User: ${userId}\n\nBerikan link ini ke user: http://localhost:3000/user/${userId}`);
  };

  // Di pages/admin.js
  const handleSendMessage = async () => {
    if (!message.trim()) return alert('Pesan tidak boleh kosong!');
  
    const payload = {
      title: 'Notifikasi Admin',
      body: message,
      targetType: targetType === 'all' ? 'all' : 'specific',
      targetIds: targetType === 'specific' ? selectedUserIds : []
    };
  
    try {
      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
  
      const data = await res.json();
      if (res.ok) {
         // alert(`✅ ${data.message}\nDB: ${data.dbCount} | Push: ${data.pushCount}`);
       alert(
        `✅ ${data.message}\n\n` +
        `👥 Penerima: ${data.receivers} user\n` +
        `📱 Token: ${data.tokensTotal} device\n` +
        `✅ Berhasil: ${data.pushSuccess} push\n` +
        `❌ Gagal: ${data.pushFailed} push`
      );
        setMessage('');
        setSelectedUserIds([]);
      } else {
        alert(`❌ Gagal: ${data.message}`);
      }
    } catch (error) {
      alert('Error koneksi server');
    }
  };
  
  // 3. Kirim Notifikasi
  const handleSendMessageU = async () => {
    if (!message.trim()) return alert('Pesan tidak boleh kosong!');
    
    const newMessage = {
      senderId: 'admin',
      content: message,
      timestamp: Date.now(),
      type: targetType === 'all' ? 'broadcast' : 'direct'
    };

    if (targetType === 'all') {
      // Kirim ke semua user (receiverId = 'all')
      newMessage.receiverId = 'all';
      const newRef = push(ref(db, 'messages'));
      await set(newRef, newMessage);
    } else {
      // Kirim ke user spesifik
      for (const uid of selectedUserIds) {
        const msgData = { ...newMessage, receiverId: uid };
        const newRef = push(ref(db, 'messages'));
        await set(newRef, msgData);
      }
    }

    setMessage('');
    alert('✅ Pesan terkirim!');
  };

  // Toggle pilih user
  const toggleUser = (userId) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert(`✅ ID disalin: ${text}`);
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2>👨‍💼 Dashboard Admin</h2>
        <button onClick={handleLogout} className="btn btn-danger" style={{ padding: '8px 16px' }}>
          Keluar
        </button>
      </div>

      {/* === BAGIAN 1: INPUT USER BARU === */}
      <div className="card" style={{ marginBottom: '40px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' }}>
        <h3>➕ Tambah User Baru</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            placeholder="Nama User (misal: Budi)"
            className="input"
            style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <button 
            onClick={handleAddUser}
            className="btn btn-success">
            Tambah User
          </button>
        </div>
      </div>

      {/* === BAGIAN 2: TABEL DATA USER === */}
      <div style={{ marginBottom: '40px' }}>
        <h3>📋 Data User Terdaftar ({users.length})</h3>
        {users.length === 0 ? (
          <p style={{ color: '#888' }}>Belum ada user. Tambah user terlebih dahulu.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Status</th>
                  <th style={{ textAlign: 'left' }}>Nama</th>
                  <th style={{ textAlign: 'left' }}>ID User</th>
                  <th style={{ textAlign: 'left' }}>Device</th>
                  <th style={{ textAlign: 'left' }}>fcm tokens</th>
                  <th style={{ textAlign: 'left' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td >
                      <StatusBadge online={u.isOnline} /> {u.isOnline ? 'Online' : 'Offline'}
                    </td>
                    <td >{u.name}</td>
                    <td style={{ fontFamily: 'monospace' }} >{u.id}</td>
                    <td style={{ 
                      padding: '10px', 
                      border: '1px solid #ddd',
                      verticalAlign: 'top' // Agar text sejajar atas jika banyak device
                    }}>
                      {formatDevicesList(u.devices)}
                    </td>
                           <td style={{ 
              padding: '10px', 
              border: '1px solid #ddd',
              verticalAlign: 'top',
              maxWidth: '250px'
            }}>
              {formatFcmTokensList(u.fcm_tokens)}
            </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => copyToClipboard(u.id)}
                        className="btn btn-primary"
                        style={{ padding: '5px 10px', fontSize: '12px' }}
                      >
                        Copy ID
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* === BAGIAN 3: INPUT NOTIFIKASI === */}
      <div className="card">
        <h3>📢 Kirim Notifikasi Baru</h3>
        
        {/* Input Pesan */}
        <div style={{ marginBottom: '20px' }}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tulis pesan notifikasi..."
            rows={4}
            className="input"
            style={{ width: '100%', marginBottom: '10px' }}
          />
        </div>

        {/* Pilihan Target */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>Target Pengiriman:</label>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input 
                type="radio" 
                name="target" 
                value="all" 
                checked={targetType === 'all'} 
                onChange={() => setTargetType('all')}
                style={{ marginRight: '8px' }}
              />
              Semua User (Broadcast)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input 
                type="radio" 
                name="target" 
                value="specific" 
                checked={targetType === 'specific'} 
                onChange={() => setTargetType('specific')}
                style={{ marginRight: '8px' }}
              />
              User Spesifik
            </label>
          </div>

          {targetType === 'specific' && (
            <div className="input" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px' }} className="muted">Pilih user yang akan menerima pesan:</p>
              {users.map(u => (
                <label key={u.id} style={{ display: 'block', marginBottom: '5px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedUserIds.includes(u.id)} 
                    onChange={() => toggleUser(u.id)}
                    style={{ marginRight: '8px' }}
                  />
                  {u.name} ({u.id})
                </label>
              ))}
              {selectedUserIds.length === 0 && <p style={{ color: '#888', fontSize: '12px' }}>Belum ada user dipilih.</p>}
            </div>
          )}
        </div>

        <button 
          onClick={handleSendMessage}
          disabled={!message.trim() || (targetType === 'specific' && selectedUserIds.length === 0)}
           className={`btn ${message.trim() && (targetType === 'all' || selectedUserIds.length > 0) ? 'btn-success' : ''}`}
          style={{ width: '100%', padding: '12px', fontSize: '16px', fontWeight: 'bold' }}
        >
          {targetType === 'all' ? '📢 Kirim ke Semua User' : '📤 Kirim ke User Terpilih'}
        </button>
      </div>
    </div>
  );
}













// <td >
//                       {formatDevice(u.device_name, u.browser)}
//                     </td>
//  return (
//     <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
//       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
//         <h2>👨‍💼 Dashboard Admin</h2>
//         <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#e60000', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
//           Keluar
//         </button>
//       </div>

//       {/* === BAGIAN 1: INPUT USER BARU === */}
//       <div style={{ marginBottom: '40px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' }}>
//         <h3>➕ Tambah User Baru</h3>
//         <div style={{ display: 'flex', gap: '10px' }}>
//           <input 
//             type="text" 
//             value={newUserName}
//             onChange={(e) => setNewUserName(e.target.value)}
//             placeholder="Nama User (misal: Budi)"
//             style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
//           />
//           <button 
//             onClick={handleAddUser}
//             style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
//           >
//             Tambah User
//           </button>
//         </div>
//       </div>

//       {/* === BAGIAN 2: TABEL DATA USER === */}
//       <div style={{ marginBottom: '40px' }}>
//         <h3>📋 Data User Terdaftar ({users.length})</h3>
//         {users.length === 0 ? (
//           <p style={{ color: '#888' }}>Belum ada user. Tambah user terlebih dahulu.</p>
//         ) : (
//           <div style={{ overflowX: 'auto' }}>
//             <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', border: '1px solid #ddd' }}>
//               <thead>
//                 <tr style={{ background: '#f1f1f1' }}>
//                   <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Status</th>
//                   <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Nama</th>
//                   <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>ID User</th>
//                   <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Device</th>
//                   <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>Aksi</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {users.map(u => (
//                   <tr key={u.id}>
//                     <td style={{ padding: '10px', border: '1px solid #ddd' }}>
//                       <StatusBadge online={u.isOnline} /> {u.isOnline ? 'Online' : 'Offline'}
//                     </td>
//                     <td style={{ padding: '10px', border: '1px solid #ddd' }}>{u.name}</td>
//                     <td style={{ padding: '10px', border: '1px solid #ddd', fontFamily: 'monospace' }}>{u.id}</td>
//                     <td style={{ padding: '10px', border: '1px solid #ddd' }}>
//                       {formatDevice(u.device_name, u.browser)}
//                     </td>
//                     <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>
//                       <button 
//                         onClick={() => copyToClipboard(u.id)}
//                         style={{ padding: '5px 10px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
//                       >
//                         Copy ID
//                       </button>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </div>

//       {/* === BAGIAN 3: INPUT NOTIFIKASI === */}
//       <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', background: '#f0f8ff' }}>
//         <h3>📢 Kirim Notifikasi Baru</h3>
        
//         {/* Input Pesan */}
//         <div style={{ marginBottom: '20px' }}>
//           <textarea
//             value={message}
//             onChange={(e) => setMessage(e.target.value)}
//             placeholder="Tulis pesan notifikasi..."
//             rows={4}
//             style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '10px' }}
//           />
//         </div>

//         {/* Pilihan Target */}
//         <div style={{ marginBottom: '20px' }}>
//           <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>Target Pengiriman:</label>
//           <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
//             <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
//               <input 
//                 type="radio" 
//                 name="target" 
//                 value="all" 
//                 checked={targetType === 'all'} 
//                 onChange={() => setTargetType('all')}
//                 style={{ marginRight: '8px' }}
//               />
//               Semua User (Broadcast)
//             </label>
//             <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
//               <input 
//                 type="radio" 
//                 name="target" 
//                 value="specific" 
//                 checked={targetType === 'specific'} 
//                 onChange={() => setTargetType('specific')}
//                 style={{ marginRight: '8px' }}
//               />
//               User Spesifik
//             </label>
//           </div>

//           {targetType === 'specific' && (
//             <div style={{ border: '1px solid #ccc', padding: '10px', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
//               <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>Pilih user yang akan menerima pesan:</p>
//               {users.map(u => (
//                 <label key={u.id} style={{ display: 'block', marginBottom: '5px', cursor: 'pointer' }}>
//                   <input 
//                     type="checkbox" 
//                     checked={selectedUserIds.includes(u.id)} 
//                     onChange={() => toggleUser(u.id)}
//                     style={{ marginRight: '8px' }}
//                   />
//                   {u.name} ({u.id})
//                 </label>
//               ))}
//               {selectedUserIds.length === 0 && <p style={{ color: '#888', fontSize: '12px' }}>Belum ada user dipilih.</p>}
//             </div>
//           )}
//         </div>

//         <button 
//           onClick={handleSendMessage}
//           disabled={!message.trim() || (targetType === 'specific' && selectedUserIds.length === 0)}
//           style={{ 
//             width: '100%', 
//             padding: '12px', 
//             background: message.trim() && (targetType === 'all' || selectedUserIds.length > 0) ? '#28a745' : '#ccc',
//             color: message.trim() && (targetType === 'all' || selectedUserIds.length > 0) ? 'white' : 'gray',
//             border: 'none', 
//             borderRadius: '4px', 
//             cursor: message.trim() && (targetType === 'all' || selectedUserIds.length > 0) ? 'pointer' : 'not-allowed',
//             fontSize: '16px',
//             fontWeight: 'bold'
//           }}
//         >
//           {targetType === 'all' ? '📢 Kirim ke Semua User' : '📤 Kirim ke User Terpilih'}
//         </button>
//       </div>
//     </div>
//   );
// }
