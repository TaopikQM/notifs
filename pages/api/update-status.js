import { ref, set, database } from "../../lib/firebase";
import { getWIBTime } from "../../lib/firebase";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { userId, status } = req.body || {};

  if (!userId) {
    return res.status(400).json({ message: "userId wajib diisi" });
  }

  try {
    const wib = getWIBTime();
    const userRef = ref(database, `users/${userId.toLowerCase()}`);

    // Update status online/offline dan last seen
    await set(ref(database, `user-status/${userId.toLowerCase()}`), {
      status: status, // "online" atau "offline"
      lastSeen: wib.full,
      lastSeenISO: wib.iso,
      lastSeenTimestamp: wib.timestamp,
    });

    console.log(`[API] Status updated: ${userId} is ${status}`);

    return res.status(200).json({
      success: true,
      message: "Status updated",
      data: {
        userId: userId.toLowerCase(),
        status: status,
        lastSeen: wib.full,
      },
    });
  } catch (error) {
    console.error("[API] Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
}
