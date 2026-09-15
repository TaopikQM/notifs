import { ref, push, set, database } from "../../lib/firebase";
import { getWIBTime, getChatPairKey } from "../../lib/firebase";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { sender, receiver, message } = req.body || {};

  if (!sender || !receiver || !message) {
    return res.status(400).json({ message: "Sender, receiver, dan message wajib diisi" });
  }

  if (!message.trim()) {
    return res.status(400).json({ message: "Pesan tidak boleh kosong" });
  }

  try {
    const wib = getWIBTime();
    const chatPairKey = getChatPairKey(sender, receiver);

    // Push pesan ke database
    const messagesRef = ref(database, `chat-messages/${chatPairKey}`);
    const newMessageRef = push(messagesRef);

    const messageData = {
      sender: sender.toLowerCase(),
      receiver: receiver.toLowerCase(),
      message: message.trim(),
      sentAt: wib.full,
      sentAtISO: wib.iso,
      timestamp: wib.timestamp,
    };

    await set(newMessageRef, messageData);

    console.log(`[API] Message sent from ${sender} to ${receiver}`);

    return res.status(200).json({
      success: true,
      message: "Pesan berhasil dikirim",
      data: messageData,
    });
  } catch (error) {
    console.error("[API] Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
}
