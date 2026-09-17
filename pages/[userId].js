import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { ref, get, set, push, onValue, off, update, database } from "../lib/firebase";
import { getChatPairKey, formatLastSeen,  setUserOnline,
  setUserOffline,
  getUserPresence, 
  startHeartbeat, } from "../lib/firebase";

export default function ChatPage() {
  const router = useRouter();
  const { userId } = router.query;
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState(null);
  const [sending, setSending] = useState(false);
  const [otherUserPresence, setOtherUserPresence] = useState(null);
  const [currentUserPresence, setCurrentUserPresence] = useState(null);
  
  const [showPinModal, setShowPinModal] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState("");

  const [attemptCount, setAttemptCount] = useState(0);
  const [maxAttempts] = useState(4);
  const [isBlocked, setIsBlocked] = useState(false); // Akses diblokir
  const [lockoutTime, setLockoutTime] = useState(null); // Waktu blokir dimulai
  const [countdown, setCountdown] = useState(0); // Countdown dalam detik
 
  const [chatPairData, setChatPairData] = useState(null);
  const [otherUserStatus, setOtherUserStatus] = useState(null);//ini gagal offline
  const messagesEndRef = useRef(null);
  const heartbeatRef = useRef(null);

 

  const LOCKOUT_KEY = "pin_lockout_time";
  const LOCKOUT_DURATION = 60; // 1 menit dalam detik
  
  const saveLockoutTime = () => {
    const now = Date.now();
    localStorage.setItem(LOCKOUT_KEY, now.toString());
  };
  
  const getLockoutTime = () => {
    const saved = localStorage.getItem(LOCKOUT_KEY);
    return saved ? parseInt(saved) : null;
  };
  
  const getRemainingLockoutTime = () => {
    const lockoutTime = getLockoutTime();
    if (!lockoutTime) return 0;
  
    const now = Date.now();
    const elapsed = Math.floor((now - lockoutTime) / 1000);
    const remaining = LOCKOUT_DURATION - elapsed;
  
    return remaining > 0 ? remaining : 0;
  };
  
  const clearLockout = () => {
    localStorage.removeItem(LOCKOUT_KEY);
  };  

  // Cek apakah masih dalam periode lockout saat halaman dibuka
useEffect(() => {
  if (!userId || !otherUser) return;

  const remaining = getRemainingLockoutTime();
  
  if (remaining > 0) {
    // Masih dalam lockout
    setIsBlocked(true);
    setCountdown(remaining);
  } else {
    // Lockout selesai
    setIsBlocked(false);
    setCountdown(0);
    clearLockout();
  }
}, [userId, otherUser]);

  // Countdown timer saat akses diblokir
// useEffect(() => {
//   if (!isBlocked || countdown <= 0) return;

//   const interval = setInterval(() => {
//     const remaining = getRemainingLockoutTime();

//     if (remaining <= 0) {
//       // Lockout selesai
//       setIsBlocked(false);
//       setCountdown(0);
//       setPinError("");
//       setAttemptCount(0);
//       clearLockout();
//       clearInterval(interval);
//     } else {
//       setCountdown(remaining);
//     }
//   }, 1000);

//   return () => clearInterval(interval);
// }, [isBlocked, countdown]);

  // Countdown timer saat akses diblokir
useEffect(() => {
  if (!isBlocked) return; // Hanya jalan saat isBlocked = true

  const interval = setInterval(() => {
    const remaining = getRemainingLockoutTime();

    if (remaining <= 0) {
      // Lockout selesai
      setIsBlocked(false);
      setCountdown(0);
      setPinError("");
      setAttemptCount(0);
      clearLockout();
      clearInterval(interval);
    } else {
      setCountdown(remaining);
    }
  }, 1000); // Update setiap 1 detik

  return () => clearInterval(interval);
}, [isBlocked]); // ✓ PERBAIKAN: Tambahkan isBlocked sebagai dependency
  
  
  // Auto scroll ke bawah
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Set user online + heartbeat + visibility listener
  useEffect(() => {
    if (!userId) return;

    const initPresence = async () => {
      await setUserOnline(userId);
      const presence = await getUserPresence(userId);
      setCurrentUserPresence(presence);

      // Start heartbeat setiap 30 detik
      heartbeatRef.current = startHeartbeat(userId, 30000);

      // Handle visibility change (tab minimize/hidden)
      const handleVisibilityChange = () => {
        if (document.hidden) {
          console.log("[Visibility] Tab hidden - user offline");
          setUserOffline(userId);
          if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
          }
        } else {
          console.log("[Visibility] Tab visible - user online");
          setUserOnline(userId);
          if (!heartbeatRef.current) {
            heartbeatRef.current = startHeartbeat(userId, 30000);
          }
        }
      };

      // Handle beforeunload (close tab/refresh)
      const handleBeforeUnload = () => {
        console.log("[BeforeUnload] Setting offline");
        setUserOffline(userId);
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }
      };

      // Add event listeners
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("beforeunload", handleBeforeUnload);

      // Cleanup
      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("beforeunload", handleBeforeUnload);
        setUserOffline(userId);
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }
      };
    };

    initPresence();
  }, [userId]);

// Set user online saat masuk halaman
  useEffect(() => {
    if (!userId) return;

    const initPresence = async () => {
      await setUserOnline(userId);
      const presence = await getUserPresence(userId);
      setCurrentUserPresence(presence);
    };

    initPresence();

    // Cleanup: Set offline saat keluar
    return () => {
      if (userId) {
        setUserOffline(userId);
      }
    };
  }, [userId]);

   // Listen presence partner secara real-time
  useEffect(() => {
    if (!otherUser) return;

    const presenceRef = ref(database, `user-presence/${otherUser}`);
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      if (snapshot.exists()) {
        setOtherUserPresence(snapshot.val());
      } else {
        setOtherUserPresence(null);
      }
    });

    return () => off(presenceRef, "value", unsubscribe);
  }, [otherUser]);
  
  // Set status online saat halaman dibuka
  useEffect(() => {
    if (!userId || isLocked) return;

    const setStatusOnline = async () => {
      try {
        await fetch("/api/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userId,
            status: "online",
          }),
        });
      } catch (err) {
        console.error("Error setting online status:", err);
      }
    };

    setStatusOnline();

    // Set status offline saat halaman ditutup
    const handleBeforeUnload = async () => {
      try {
        await fetch("/api/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userId,
            status: "offline",
          }),
        });
      } catch (err) {
        console.error("Error setting offline status:", err);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      handleBeforeUnload(); // Set offline saat unmount
    };
  }, [userId, isLocked]);

// // 1. Cek apakah user ini yang harus memasukkan PIN
//   const isUserLocked = (pairData, currentUserId) => {
//     if (!pairData) return false;
    
//     if (pairData.userA === currentUserId) {
//       return pairData.lockUserA === true;
//     }
//     if (pairData.userB === currentUserId) {
//       return pairData.lockUserB === true;
//     }
//     return false;
//   };

//   // 2. Ambil PIN yang benar berdasarkan user yang login
//   const getExpectedPin = (pairData, currentUserId) => {
//     if (!pairData) return null;
    
//     if (pairData.userA === currentUserId) {
//       return pairData.pinUserA || pairData.pins?.userA || null;
//     }
//     if (pairData.userB === currentUserId) {
//       return pairData.pinUserB || pairData.pins?.userB || null;
//     }
//     return null;
//   };
  
//  // 3. Cari Partner & Cek Lock Logic (Satu-satunya efek yang aktif)
//   useEffect(() => {
//     if (!userId) return;

//     const findPartner = async () => {
//       try {
//         const indexRef = ref(database, `user-chat-index/${userId}`);
//         const unsubscribe = onValue(indexRef, async (snapshot) => {
//           if (snapshot.exists()) {
//             const chatPairs = snapshot.val();
//             const partnerKey = Object.keys(chatPairs)[0];
//             const partner = Object.values(chatPairs)[0];
            
//             // Ambil data lengkap chat pair
//             const pairSnapshot = await get(ref(database, `chat-pairs/${partnerKey}`));
            
//             if (pairSnapshot.exists()) {
//               const pairData = pairSnapshot.val();
//               setChatPairData(pairData);

//               // Cek apakah user ini harus memasukkan PIN
//               const locked = isUserLocked(pairData, userId);
              
//               if (locked) {
//                 // Jika terkunci, tampilkan modal PIN
//                 setShowPinModal(true);
//                 setPinError("");
//                 setIsChatUnlocked(false);
//                 setOtherUser(null); // Jangan set partner dulu sampai PIN benar
//               } else {
//                 // Jika tidak terkunci, langsung masuk chat
//                 setShowPinModal(false);
//                 setOtherUser(partner);
//                 setIsChatUnlocked(true);
//                 getUserPresence(partner).then(setOtherUserPresence);
//               }
//             } else {
//               setOtherUser(null);
//             }
//           } else {
//             setOtherUser(null);
//           }
//           setLoading(false);
//         });

//         return () => unsubscribe();
//       } catch (err) {
//         console.error("Error finding partner:", err);
//         setLoading(false);
//       }
//     };

//     findPartner();
//   }, [userId]);

//   // 4. Listen Partner Presence (Hanya jalan jika chat sudah terbuka)
//   useEffect(() => {
//     if (!otherUser || !isChatUnlocked) return;

//     const presenceRef = ref(database, `user-presence/${otherUser}`);
//     const unsubscribe = onValue(presenceRef, (snapshot) => {
//       if (snapshot.exists()) {
//         setOtherUserPresence(snapshot.val());
//       } else {
//         setOtherUserPresence(null);
//       }
//     });

//     return () => off(presenceRef, "value", unsubscribe);
//   }, [otherUser, isChatUnlocked]);

//   // 5. Listen Pesan (Hanya jalan jika chat sudah terbuka)
//   useEffect(() => {
//     if (!userId || !otherUser || !isChatUnlocked) return;

//     const chatPairKey = getChatPairKey(userId, otherUser);
//     const messagesRef = ref(database, `chat-messages/${chatPairKey}`);

//     const unsubscribe = onValue(messagesRef, (snapshot) => {
//       if (snapshot.exists()) {
//         const data = snapshot.val();
//         const msgArray = Object.entries(data).map(([key, value]) => ({
//           id: key,
//           ...value,
//         }));
//         setMessages(msgArray.sort((a, b) => a.timestamp - b.timestamp));
//       }
//     });

//     return () => off(messagesRef, "value", unsubscribe);
//   }, [userId, otherUser, isChatUnlocked]);

//   // --- Event Handlers ---

//   const handlePinSubmit = (e) => {
//     e.preventDefault();
//     verifyPin();
//   };

//   const verifyPin = () => {
//     if (!userId || !chatPairData) return;

//     const expectedPin = getExpectedPin(chatPairData, userId);

//     if (!expectedPin) {
//       setPinError("PIN tidak ditemukan untuk user ini");
//       return;
//     }

//     if (!pinInput) {
//       setPinError("PIN wajib diisi");
//       return;
//     }

//     if (String(pinInput) !== String(expectedPin)) {
//       setPinError("PIN salah");
//       return;
//     }

//     // PIN Benar
//     setShowPinModal(false);
//     setPinInput("");
//     setPinError("");
//     setIsChatUnlocked(true);

//     // Tentukan partner berdasarkan siapa yang login
//     const partner = (chatPairData.userA === userId) 
//       ? chatPairData.userB 
//       : chatPairData.userA;

//     setOtherUser(partner);
//     getUserPresence(partner).then(setOtherUserPresence);
//   };
   // Cari partner dan cek lock
  // useEffect(() => {
  //   if (!userId) return;

  //   const findPartner = async () => {
  //     try {
  //       const indexRef = ref(database, `user-chat-index/${userId}`);
  //       onValue(indexRef, async (snapshot) => {
  //         if (snapshot.exists()) {
  //           const chatPairs = snapshot.val();
  //           const partnerKey = Object.keys(chatPairs)[0];
  //           const partner = Object.values(chatPairs)[0];
            
  //           // Get chat pair data
  //           const pairSnapshot = await get(ref(database, `chat-pairs/${partnerKey}`));
  //           if (pairSnapshot.exists()) {
  //             const pairData = pairSnapshot.val();
  //             setChatPairData(pairData);

  //             // Cek apakah user dilock
  //             const isLocked = pairData.lockUserA && pairData.pinUserA === userId;
  //             const isLockedB = pairData.lockUserB && pairData.pinUserB === userId;

  //             if (isLocked || isLockedB) {
  //               setShowPinModal(true);
  //               setPinError("");
  //             } else {
  //               setOtherUser(partner);
  //               getUserPresence(partner).then(setOtherUserPresence);
  //             }
  //           }
  //         } else {
  //           setOtherUser(null);
  //           setOtherUserPresence(null);
  //         }
  //         setLoading(false);
  //       });
  //     } catch (err) {
  //       console.error("Error finding partner:", err);
  //       setLoading(false);
  //     }
  //   };

  //   findPartner();
  // }, [userId]);

  // // Verify PIN
  // const verifyPin = async () => {
  //   if (!userId || !chatPairData) return;

  //   const isLockedA = chatPairData.lockUserA && chatPairData.pinUserA === userId;
  //   const isLockedB = chatPairData.lockUserB && chatPairData.pinUserB === userId;

  //   if (!isLockedA && !isLockedB) {
  //     setShowPinModal(false);
  //     return;
  //   }

  //   if (!pinInput) {
  //     setPinError("PIN wajib diisi");
  //     return;
  //   }

  //   if (pinInput.length < 4 || pinInput.length > 6) {
  //     setPinError("PIN harus 4-6 digit");
  //     return;
  //   }

  //   const correctPin = isLockedA ? chatPairData.pinUserA : chatPairData.pinUserB;

  //   if (pinInput === correctPin) {
  //     setShowPinModal(false);
  //     setPinInput("");
  //     // Get partner again
  //     if (chatPairData.userA === userId) {
  //       setOtherUser(chatPairData.userB);
  //       getUserPresence(chatPairData.userB).then(setOtherUserPresence);
  //     } else {
  //       setOtherUser(chatPairData.userA);
  //       getUserPresence(chatPairData.userA).then(setOtherUserPresence);
  //     }
  //   } else {
  //     setPinError("PIN salah");
  //   }
  // };
  
  // Cari partner chat user
  useEffect(() => {
    if (!userId) return;

    const findPartner = async () => {
      try {
        const indexRef = ref(database, `user-chat-index/${userId}`);
        onValue(indexRef, (snapshot) => {
          if (snapshot.exists()) {
            const chatPairs = snapshot.val();
            const partner = Object.keys(chatPairs)[0]; // Ambil partner pertama
            setOtherUser(partner);
          } else {
            setOtherUser(null);
          }
          setLoading(false);
        });
      } catch (err) {
        console.error("Error finding partner:", err);
        setLoading(false);
      }
    };

    findPartner();
  }, [userId]);

  // Fetch chat pair data untuk cek lock & pin
useEffect(() => {
  if (!userId || !otherUser) return;

  const chatPairKey = getChatPairKey(userId, otherUser);
  const chatPairRef = ref(database, `chat-pairs/${chatPairKey}`);

  const unsubscribe = onValue(chatPairRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      setChatPairData(data);

      // Cek apakah user saat ini terkunci
      const locked = isCurrentUserLocked(data, userId);
      setIsLocked(locked);
      
      // Jika tidak terkunci, langsung verifikasi
      if (!locked) {
        setPinVerified(true);
      }
    }
  });

  return () => off(chatPairRef, "value", unsubscribe);
}, [userId, otherUser]);

  // Real-time listen pesan
  useEffect(() => {
    if (!userId || !otherUser) return;

    const chatPairKey = getChatPairKey(userId, otherUser);
    const messagesRef = ref(database, `chat-messages/${chatPairKey}`);

    const unsubscribe = onValue(messagesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const msgArray = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value,
        }));
        setMessages(msgArray.sort((a, b) => a.timestamp - b.timestamp));
      }
    });

    return () => off(messagesRef, "value", unsubscribe);
  }, [userId, otherUser]);

  // Tandai semua pesan dari partner sebagai sudah dibaca
  useEffect(() => {
    if (!userId || !otherUser || messages.length === 0) return;
  
    const chatPairKey = getChatPairKey(userId, otherUser);
  
    const unread = messages.filter(
      (m) => m.sender !== userId && !m.isRead
    );
  
    if (unread.length === 0) return;
  
    const updates = {};
    unread.forEach((m) => {
      updates[`chat-messages/${chatPairKey}/${m.id}/isRead`] = true;
    });
  
    update(ref(database), updates).catch((err) =>
      console.error("Gagal update read status:", err)
    );
  }, [messages, userId, otherUser]);

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!messageInput.trim() || !userId || !otherUser) return;

    setSending(true);

    try {
      const response = await fetch("/api/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: userId,
          receiver: otherUser,
          message: messageInput.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Gagal mengirim pesan");
      }

      setMessageInput("");
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Gagal mengirim pesan: " + err.message);
    } finally {
      setSending(false);
    }
  };


    const isCurrentUserLocked = (data, currentUserId) => {
      if (currentUserId === data.userA) {
        return data.lockUserA === true;
      } else if (currentUserId === data.userB) {
        return data.lockUserB === true;
      }
      return false;
    };
    
    const getCurrentUserPin = (data, currentUserId) => {
      if (currentUserId === data.userA) {
        return data.pinUserA || null;
      } else if (currentUserId === data.userB) {
        return data.pinUserB || null;
      }
      return null;
    };
    
    const handlePinSubmitU = (e) => {
      e.preventDefault();
      
      if (!chatPairData) return;
    
      const correctPin = getCurrentUserPin(chatPairData, userId);
    
      if (pinInput === correctPin) {
        setPinVerified(true);
        setPinError("");
        setPinInput("");
      } else {
        setPinError("PIN salah!");
        setPinInput("");
      }
    };
    useEffect(() => {
      return () => {
        setAttemptCount(0);
        setIsBlocked(false);
        setLockoutTime(null);
        // setCountdown(60);
        
          setCountdown(LOCKOUT_DURATION);
        setPinInput("");
        setPinError("");
      };
    }, []);

  
    const handlePinSubmit = (e) => {
      e.preventDefault();
    
      if (!chatPairData || isBlocked) return;
    
      const correctPin = getCurrentUserPin(chatPairData, userId);
      const newAttemptCount = attemptCount + 1;
      const remainingAttempts = maxAttempts - newAttemptCount;
    
      if (pinInput === correctPin) {
        // ✓ PIN BENAR
        setPinVerified(true);
        setPinError("");
        setPinInput("");
        setAttemptCount(0);
        // setLockoutTime(null);
        
        setCountdown(0);
        clearLockout();
      } else {
        // ✗ PIN SALAH
        setAttemptCount(newAttemptCount);
    
        if (remainingAttempts > 0) {
          // Masih ada kesempatan
          setPinError(
            `❌ PIN salah! Sisa ${remainingAttempts} kesempatan lagi.`
          );
        } else {
          // Kesempatan habis - mulai lockout 1 menit
          setIsBlocked(true);
          // setLockoutTime();
          saveLockoutTime();
          setCountdown(LOCKOUT_DURATION);
          setPinError(
            `❌ Kesempatan habis! Akses diblokir selama 1 menit.`
          );
        }
    
        setPinInput("");
      }
    };
  
   const renderStatusIndicator = (presence) => {
    if (!presence) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <span className="h-2 w-2 rounded-full bg-slate-500"></span>
          Offline
        </span>
      );
    }

    if (presence.status === "online") {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Online
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-400">
           
        <span className="h-2 w-2 rounded-full bg-red-500"></span>
        Terakhir online: {presence.lastSeen}
      </span>
    );
  };

const renderStatusIndicatorlg = (presence) => {
    if (!presence) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <span className="h-2 w-2 rounded-full bg-slate-500"></span>
         
        </span>
      );
    }

    if (presence.status === "online") {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
         
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-400">
           
        <span className="h-2 w-2 rounded-full bg-red-500"></span>
       
      </span>
    );
  };

  // if (!userId) {
  //   return (
  //     <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
  //       <p>Loading...</p>
  //     </div>
  //   );
  // }

if (!userId || !chatPairData) {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
      <p>Loading...</p>
    </div>
  );
}

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <p>Mencari chat partner...</p>
      </div>
    );
  }

  
// // ✅ Lock Screen Harus Paling Awal Setelah Loading
//   if (showPinModal && chatPairData) {
//     return (
//       <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
//         <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
//           <div className="mb-6 text-center">
//             <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-600/20">
//               <svg className="h-8 w-8 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
//                 <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.002c.659 0 1.35.252 2.344.656V5.5l-2.344-.496zm0 0V5.5L9.656 5.004C10.65 4.6 11.341 4.002 12 4.002z"/>
//               </svg>
//             </div>
//             <h1 className="text-2xl font-bold text-white">🔐 Chat Terkunci</h1>
//             <p className="mt-2 text-slate-400">
//               Masukkan PIN untuk membuka chat
//             </p>
//           </div>

//           <form onSubmit={handlePinSubmit} className="space-y-4">
//             <div>
//               <label className="mb-2 block text-center text-sm font-medium text-slate-300">
//                 Masukkan PIN
//               </label>
//               <input
//                 type="password"
//                 value={pinInput}
//                 onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
//                 placeholder="••••"
//                 maxLength="6"
//                 autoFocus
//                 className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-4 text-center text-2xl font-bold tracking-widest text-white outline-none transition placeholder:text-slate-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
//               />
//             </div>

//             {pinError && (
//               <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-sm text-red-200">
//                 {pinError}
//               </div>
//             )}

//             <button
//               type="submit"
//               disabled={!pinInput}
//               className="w-full rounded-xl bg-amber-600 px-4 py-3 font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
//             >
//               Buka Chat
//             </button>
//           </form>

//           <div className="mt-6 text-center">
//             <p className="text-xs text-slate-500">
//               Lupa PIN? Hubungi administrator.
//             </p>
//           </div>
//         </div>
//       </div>
//     );
//   }


// Tambahkan ini sebelum return JSX utama
if (isLocked && !pinVerified) {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="w-96 rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl">
        <h2 className="mb-2 text-2xl font-bold text-white">Chat Terkunci</h2>
        <p className="mb-6 text-slate-400">Masukkan PIN untuk akses chat</p>

         {/* Indikator Kesempatan */}
        <div className="mb-6 rounded-lg bg-slate-800/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-300">
              Kesempatan:{" "}
              <span className="font-bold text-indigo-400">
                {maxAttempts - attemptCount}
              </span>{" "}
              / {maxAttempts}
            </span>
          </div>

          {/* Progress Bar Kesempatan */}
          <div className="flex gap-1">
            {Array.from({ length: maxAttempts }).map((_, i) => (
              <div
                key={i}
                className={`h-3 flex-1 rounded-full transition-all ${
                  i < attemptCount ? "bg-red-500" : "bg-slate-600"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Countdown Timer (Jika Diblokir) */}
        {isBlocked && countdown > 0 &&(
          <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-center">
            <p className="mb-2 text-sm text-red-400">⏱️ Akses Diblokir</p>
            <p className="text-4xl font-bold text-red-500">{countdown}s</p>
            <p className="mt-2 text-xs text-red-400">
              Coba lagi dalam {countdown} detik
            </p>
          </div>
        )}

        <form onSubmit={handlePinSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Masukkan PIN..."
              maxLength="6"
             disabled={isBlocked}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2 text-center text-2xl tracking-widest text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {pinError && (
              <p
                className={`mt-2 text-sm ${
                  isBlocked ? "text-red-400" : "text-orange-400"
                }`}
              >
                {pinError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!pinInput.trim() || isBlocked}
            className={`w-full rounded-lg py-2 font-semibold text-white transition ${
              isBlocked
                ? "cursor-not-allowed bg-slate-600 opacity-50"
                : "bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60"
            }`}
            >
             {isBlocked ? `Tunggu ${countdown}s` : "Verifikasi"}
          </button>
        </form>

         {/* Info */}
        <div className="mt-4 space-y-2 text-xs text-slate-500">
          <p>💡 PIN terdiri dari angka</p>
          <p>⚠️ 4 kesempatan gagal = blokir 1 menit</p>
          <p>📞 Hubungi admin jika perlu bantuan</p>
        </div>
      </div>
    </div>
  );
}
if (!otherUser) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-950 text-white">
        <p className="mb-4 text-xl">Tidak ada chat partner untuk user: {userId}</p>
        <a href="/admin/add-user" className="text-blue-400 underline">
          Buat pair chat baru
        </a>
      </div>
    );
  }

// // Chat utama
//   if (!isChatUnlocked) {
//      return (
//       <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
//         <p>Membuka chat...</p>
//       </div>
//     );
//   }

  // // --- Main Chat Screen ---
  // if (!otherUser || !isChatUnlocked) {
  //   return (
  //     <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
  //       <p>Membuka chat...</p>
  //     </div>
  //   );
  // }


  // // PIN Lock Screen
  // if (isLocked) {
  //   return (
  //     <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
  //       <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
  //         <div className="mb-6 text-center">
  //           <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-600/20">
  //             <svg className="h-8 w-8 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
  //               <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.002c.659 0 1.35.252 2.344.656V5.5l-2.344-.496zm0 0V5.5L9.656 5.004C10.65 4.6 11.341 4.002 12 4.002z"/>
  //             </svg>
  //           </div>
  //           <h1 className="text-2xl font-bold text-white">🔐 Chat Terkunci</h1>
  //            <p className="mt-2 text-slate-400">Masukkan PIN untuk membuka chat dengan {otherUser}</p>
  //         </div>

  //         <form onSubmit={handlePinSubmit} className="space-y-4">
  //           <div>
  //             <label className="mb-2 block text-center text-sm font-medium text-slate-300">
  //               Masukkan PIN (4-6 digit)
  //             </label>
  //             <input
  //               type="password"
  //               value={pinInput}
  //               onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
  //               placeholder="••••••"
  //               maxLength="6"
  //               autoFocus
  //               className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-4 text-center text-2xl font-bold tracking-widest text-white outline-none transition placeholder:text-slate-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
  //             />
  //           </div>

  //           {pinError && (
  //             <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-sm text-red-200">
  //               {pinError}
  //             </div>
  //           )}

  //           <button
  //             type="submit"
  //             disabled={!pinInput || pinInput.length < 4}
  //             className="w-full rounded-xl bg-amber-600 px-4 py-3 font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
  //           >
  //             Buka Chat
  //           </button>
  //         </form>

  //         <div className="mt-6 text-center">
  //           <p className="text-xs text-slate-500">
  //             Lupa PIN? Hubungi administrator.
  //           </p>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }
// {otherUserStatus && (
//                       <>
//                         <span className="text-slate-600">•</span>
//                         {otherUserStatus.status === "online" ? (
//                           <span className="flex items-center gap-1 text-green-400">
//                             <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
//                             Online
//                           </span>
//                         ) : (
//                           <span className="text-slate-500">
//                             {formatLastSeen(otherUserStatus.lastSeenTimestamp)}
//                           </span>
//                         )}
//                       </>
//                     )}

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{userId}</h1>
            <div className="mt-1">
              {renderStatusIndicator(otherUserPresence)}
              {/* <p className="text-xs text-slate-400">
                {currentUserPresence?.status === "online" ? "Online" : "Offline"}
              </p>*/}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <p className="text-sm text-slate-400">Chat dengan: {otherUser}</p>
                    
            </div>
                  
          </div>
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600">
              {userId.charAt(0).toUpperCase()}
            </div>
             <div className="absolute -bottom-1 -right-1">
                {/* {currentUserPresence?.status === "online" && (
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                )}*/}
{renderStatusIndicatorlg(otherUserPresence)}

                
                {/*{currentUserPresence?.status === "online" ? (
  <span className="relative flex h-3 w-3">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
  </span>
) : (
  <span className="relative flex h-3 w-3">
   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                  
    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
  </span>
)}
Tambahan kondisi untuk OFFLINE  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                   
                {currentUserPresence?.status !== "online" && (
                  <span className="relative flex h-3 w-3">
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                )}*/}
              </div>
               {/* Online indicator di avatar */}
{/*{otherUserStatus?.status === "online" && (
                <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-900 bg-green-400"></div>
              )}*/}
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-400">
            <p>Mulai percakapan dengan {otherUser}</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === userId ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs rounded-lg px-4 py-2 ${
                  msg.sender === userId
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-100"
                }`}
              >
                <p className="break-words">{msg.message}</p>
               
                  <p className="mt-1 text-xs opacity-70">
                    {new Date(msg.timestamp).toLocaleString('id-ID', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false
                    }).replace(/\//g, '-')} {msg.sender === userId &&
                      (msg.isRead ? (
                        <span className="text-[10px] text-emerald-300">✓✓</span>
                      ) : (
                        <span className="text-[10px] text-slate-300">✓</span>
                    ))}
                  </p>
                   
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="border-t border-slate-800 bg-slate-900/80 px-4 py-4 backdrop-blur">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Tulis pesan..."
            disabled={sending}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2 outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !messageInput.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {sending ? "..." : "Kirim"}
          </button>
        </form>
      </div>
    </div>
  );
}




// import { useState, useEffect, useRef } from "react";
// import { useRouter } from "next/router";
// import { ref, get, push, onValue, set, database } from "../lib/firebase";
// import { getWIBTime } from "../lib/firebase";

// export default function ChatPage() {
//   const router = useRouter();
//   const { username } = router.query;

//   const [currentUser, setCurrentUser] = useState("");
//   const [chatWith, setChatWith] = useState("");
//   const [messages, setMessages] = useState([]);
//   const [newMessage, setNewMessage] = useState("");
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");
//   const [sending, setSending] = useState(false);
//   const messagesEndRef = useRef(null);

//   // Scroll ke bawah saat ada pesan baru
//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   };

//   useEffect(() => {
//     scrollToBottom();
//   }, [messages]);

//   // Load chat data
//   useEffect(() => {
//     if (!username) return;

//     const loadChatData = async () => {
//       try {
//         const cleanUser = String(username).trim().toLowerCase();

//         // Cek apakah user ada
//         const userSnapshot = await get(ref(database, `users/${cleanUser}`));
//         if (!userSnapshot.exists()) {
//           setError(`User "${cleanUser}" tidak ditemukan`);
//           setLoading(false);
//           return;
//         }

//         setCurrentUser(cleanUser);

//         // Cari chat pair user ini
//         const chatPairsSnapshot = await get(ref(database, "chat-pairs"));
//         const allPairs = chatPairsSnapshot.val() || {};

//         // Cari pair yang mengandung user ini
//         let foundChatWith = null;
//         let foundPairKey = null;

//         for (const [pairKey, pairData] of Object.entries(allPairs)) {
//           if (pairData.userA === cleanUser || pairData.userB === cleanUser) {
//             foundChatWith = pairData.userA === cleanUser ? pairData.userB : pairData.userA;
//             foundPairKey = pairKey;
//             break;
//           }
//         }

//         if (!foundChatWith) {
//           setError(`Tidak ada chat pair untuk user "${cleanUser}"`);
//           setLoading(false);
//           return;
//         }

//         setChatWith(foundChatWith);

//         // Load messages real-time
//         const messagesRef = ref(database, `messages/${foundPairKey}`);
//         const unsubscribe = onValue(messagesRef, (snapshot) => {
//           const data = snapshot.val();
//           if (data) {
//             const messageList = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
//             setMessages(messageList);
//           } else {
//             setMessages([]);
//           }
//           setLoading(false);
//         });

//         return () => unsubscribe();
//       } catch (err) {
//         console.error("Error loading chat:", err);
//         setError("Gagal memuat data chat");
//         setLoading(false);
//       }
//     };

//     loadChatData();
//   }, [username]);

//   const sendMessage = async (e) => {
//     e.preventDefault();
//     if (!newMessage.trim() || !currentUser || !chatWith) return;

//     setSending(true);

//     try {
//       const wib = getWIBTime();
//       const chatPairKey = [currentUser, chatWith].sort().join("_");

//       const messageData = {
//         sender: currentUser,
//         receiver: chatWith,
//         text: newMessage.trim(),
//         timestamp: wib.timestamp,
//         timeWIB: wib.full,
//         createdAtISO: wib.iso,
//       };

//       const messagesRef = ref(database, `messages/${chatPairKey}`);
//       await push(messagesRef, messageData);

//       setNewMessage("");
//     } catch (err) {
//       console.error("Error sending message:", err);
//       setError("Gagal mengirim pesan");
//     } finally {
//       setSending(false);
//     }
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-slate-950 flex items-center justify-center">
//         <div className="text-center">
//           <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
//           <p className="mt-4 text-slate-400">Memuat chat...</p>
//         </div>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
//         <div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
//           <svg className="mx-auto h-12 w-12 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
//           </svg>
//           <h2 className="text-xl font-bold text-red-300 mb-2">Error</h2>
//           <p className="text-red-200 text-sm">{error}</p>
//           <button
//             onClick={() => window.location.reload()}
//             className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
//           >
//             Coba Lagi
//           </button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-slate-950 flex flex-col">
//       {/* Header */}
//       <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
//         <div className="mx-auto max-w-4xl px-4 py-4">
//           <div className="flex items-center gap-3">
//             <button
//               onClick={() => router.back()}
//               className="rounded-lg p-2 hover:bg-slate-800 transition"
//             >
//               <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
//               </svg>
//             </button>
//             <div className="flex-1">
//               <h1 className="text-lg font-bold text-white">{chatWith}</h1>
//               <p className="text-xs text-slate-400">Chat dengan {currentUser}</p>
//             </div>
//             <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-300 font-bold">
//               {chatWith.charAt(0).toUpperCase()}
//             </div>
//           </div>
//         </div>
//       </header>

//       {/* Messages */}
//       <div className="flex-1 overflow-y-auto px-4 py-6">
//         <div className="mx-auto max-w-4xl space-y-4">
//           {messages.length === 0 ? (
//             <div className="text-center py-12">
//               <svg className="mx-auto h-16 w-16 text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
//               </svg>
//               <p className="text-slate-500">Belum ada pesan. Mulai chat!</p>
//             </div>
//           ) : (
//             messages.map((msg, idx) => {
//               const isOwn = msg.sender === currentUser;
//               return (
//                 <div key={idx} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
//                   <div
//                     className={`max-w-[80%] rounded-2xl px-4 py-3 ${
//                       isOwn
//                         ? "bg-indigo-600 text-white rounded-br-sm"
//                         : "bg-slate-800 text-slate-100 rounded-bl-sm"
//                     }`}
//                   >
//                     <p className="break-words">{msg.text}</p>
//                     <p className={`mt-1 text-xs ${isOwn ? "text-indigo-200" : "text-slate-400"}`}>
//                       {msg.timeWIB}
//                     </p>
//                   </div>
//                 </div>
//               );
//             })
//           )}
//           <div ref={messagesEndRef} />
//         </div>
//       </div>

//       {/* Input */}
//       <div className="border-t border-slate-800 bg-slate-900/80 backdrop-blur sticky bottom-0">
//         <div className="mx-auto max-w-4xl px-4 py-4">
//           <form onSubmit={sendMessage} className="flex gap-3">
//             <input
//               value={newMessage}
//               onChange={(e) => setNewMessage(e.target.value)}
//               placeholder="Ketik pesan..."
//               disabled={sending}
//               className="flex-1 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
//             />
//             <button
//               type="submit"
//               disabled={!newMessage.trim() || sending}
//               className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
//             >
//               {sending ? (
//                 <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
//                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
//                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
//                 </svg>
//               ) : (
//                 <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
//                 </svg>
//               )}
//             </button>
//           </form>
//         </div>
//       </div>
//     </div>
//   );
// }
