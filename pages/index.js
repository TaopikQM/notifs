// pages/index.js
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <h1>Selamat Datang di Sistem Notifikasi</h1>
      <p>Silakan pilih peran Anda:</p>
      
      <div style={{ display: 'flex', gap: '20px' }}>
        <button 
          onClick={() => router.push('/user')}
          style={{ padding: '15px 30px', fontSize: '18px', cursor: 'pointer', background: '#0070f3', color: 'white', border: 'none', borderRadius: '8px' }}
        >
          Masuk sebagai User
        </button>
        
        <button 
          onClick={() => router.push('/admin')}
          style={{ padding: '15px 30px', fontSize: '18px', cursor: 'pointer', background: '#e60000', color: 'white', border: 'none', borderRadius: '8px' }}
        >
          Masuk sebagai Admin
        </button>
      </div>
    </div>
  );
}