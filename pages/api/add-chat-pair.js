import { ref, get, push, update, set, database} from "../../lib/firebase";
import { getWIBTime } from "../../lib/firebase";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Metode tidak diizinkan" });
  }

  const { userA, userB, createdBy = "admin" } = req.body || {};

  if (!userA || !userB) {
    return res.status(400).json({ message: "User A dan User B wajib diisi" });
  }

  const cleanA = String(userA).trim().toLowerCase();
  const cleanB = String(userB).trim().toLowerCase();

  if (!cleanA || !cleanB) {
    return res.status(400).json({ message: "Nama pengguna tidak boleh kosong" });
  }

  if (cleanA === cleanB) {
    return res.status(400).json({ message: "Pengirim dan penerima tidak boleh sama" });
  }

  try {
    // Cek user pengirim
    const userARef = ref(database, `users/${cleanA}`);
    const userBSnapshot = await get(ref(database, `users/${cleanB}`));
    const userASnapshot = await get(userARef);

    // if (!userASnapshot.exists()) {
    //   return res.status(404).json({ message: `Pengguna "${cleanA}" tidak ditemukan` });
    // }

    // if (!userBSnapshot.exists()) {
    //   return res.status(404).json({ message: `Pengguna "${cleanB}" tidak ditemukan` });
    // }

    const wib = getWIBTime();

    const chatPairsRef = ref(database, "chat-pairs");
    const chatPairKey = [cleanA, cleanB].sort().join("_");

    // Buat/update satu pair utama
    const pairRef = ref(database, `chat-pairs/${chatPairKey}`);
    const existingPair = await get(pairRef);

    const pairData = {
      userA: cleanA,
      userB: cleanB,
      createdAt: existingPair.exists()
        ? existingPair.val().createdAt
        : wib.full,
      createdAtISO: existingPair.exists()
        ? existingPair.val().createdAtISO
        : wib.iso,
      createdAtTimestamp: existingPair.exists()
        ? existingPair.val().createdAtTimestamp
        : wib.timestamp,
      createdBy: existingPair.exists()
        ? existingPair.val().createdBy
        : createdBy,
      updatedAt: wib.full,
      status: "active",
      directions: {
        [`${cleanA}_to_${cleanB}`]: {
          sender: cleanA,
          receiver: cleanB,
          status: "active",
          updatedAt: wib.full,
        },
        [`${cleanB}_to_${cleanA}`]: {
          sender: cleanB,
          receiver: cleanA,
          status: "active",
          updatedAt: wib.full,
        },
      },
    };

    await set(pairRef, pairData);

    // Simpan juga ke indeks per-user agar mudah dibaca halaman /user1
    await update(ref(database, "user-chat-index"), {
      [`${cleanA}/${cleanB}`]: chatPairKey,
      [`${cleanB}/${cleanA}`]: chatPairKey,
    });

    return res.status(200).json({
      success: true,
      message: "Pasangan chat berhasil disimpan",
      key: chatPairKey,
      data: pairData,
    });
  } catch (error) {
    console.error("Error add chat pair:", error);
    return res.status(500).json({
      message: "Terjadi kesalahan server",
      error: error.message,
    });
  }
}
