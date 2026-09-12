// pages/api/send-notification.js
import { db } from '../../lib/firebase';
import { ref, push, set, get, onValue } from 'firebase/database';

export default async function handler(req, res) {
  // Hanya izinkan metode POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { title, body, targetType, targetIds } = req.body;

  // Validasi Input
  if (!title || !body) {
    return res.status(400).json({ message: 'Title dan Body wajib diisi' });
  }

  try {
    let receivers = [];

    // 1. Jika target adalah SEMUA USER
    if (targetType === 'all') {
      const usersRef = ref(db, 'users');
      const snapshot = await get(usersRef);
      const data = snapshot.val();
      
      if (data) {
        receivers = Object.keys(data).filter(key => data[key].role === 'user');
      }
    } 
    // 2. Jika target SPESIFIK (array ID user)
    else if (targetType === 'specific' && Array.isArray(targetIds)) {
      receivers = targetIds;
    }
    // 3. Jika target SINGLE USER
    else if (targetType === 'single' && targetIds) {
      receivers = [targetIds]; // anggap targetIds adalah string ID
    }

    if (receivers.length === 0) {
      return res.status(400).json({ message: 'Tidak ada penerima yang valid' });
    }

    // Simpan pesan ke Database (Realtime Database)
    const messageData = {
      title: title,
      content: body,
      senderId: 'api_system', // Penanda bahwa ini dikirim via API
      timestamp: Date.now(),
      type: targetType
    };

    // Looping simpan pesan ke setiap receiver
    const promises = receivers.map(receiverId => {
      const newRef = push(ref(db, 'messages'));
      return set(newRef, {
        ...messageData,
        receiverId: receiverId
      });
    });

    await Promise.all(promises);

    // Response sukses
    res.status(200).json({ 
      message: 'Notifikasi berhasil dikirim', 
      count: receivers.length 
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
