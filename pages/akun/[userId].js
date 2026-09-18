import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { ref, get, set, push, onValue, off, update, database } from "../../lib/firebase";
import { getChatPairKey, formatLastSeen,  setUserOnline,
  setUserOffline,
  getUserPresence, 
  startHeartbeat, } from "../../lib/firebase";

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

   const chatContainerRef = useRef(null); // Ref untuk container scroll

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









  //habis lock
  // --- PERBAIKAN 1: Auto Scroll ke Bawah ---
  // const scrollToBottom = (force = false) => {
  //   if (messagesEndRef.current) {
  //     if (force) {
  //       messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  //     } else {
  //       // Hanya scroll otomatis jika user sedang berada di posisi paling bawah
  //       // agar tidak mengganggu user yang sedang membaca riwayat
  //       const container = chatContainerRef.current;
  //       if (container) {
  //         const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
  //         if (isNearBottom) {
  //           messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  //         }
  //       } else {
  //          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  //       }
  //     }
  //   }
  // };

  // useEffect(() => {
  //   // Scroll otomatis saat pesan baru masuk atau chat pertama kali dimuat
  //   scrollToBottom();
  // }, [messages, userId, otherUser]); // Tambahkan userId/otherUser untuk trigger saat chat awal

  // --- PERBAIKAN 2: Toggle Tombol Melayang (Floating Arrow) ---
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // const handleScroll = () => {
  //   const container = chatContainerRef.current;
  //   if (container) {
  //     // Jika scroll lebih dari 200px dari atas, tampilkan tombol
  //     if (container.scrollTop > 200) {
  //       setShowScrollBtn(true);
  //     } else {
  //       setShowScrollBtn(false);
  //     }
  //   }
  // };

  // const scrollToBottomManual = () => {
  //   scrollToBottom(true);
  //   setShowScrollBtn(false);
  // };

  // // Event listener scroll
  // useEffect(() => {
  //   const container = chatContainerRef.current;
  //   if (container) {
  //     container.addEventListener('scroll', handleScroll);
  //     return () => container.removeEventListener('scroll', handleScroll);
  //   }
  // }, []);


  

   // --- PERBAIKAN: Auto Scroll ke Bawah saat Chat Dibuka ---
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Track apakah ini load pertama

  const scrollToBottom = (behavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: behavior });
    }
  };

  useEffect(() => {
    if (!userId || !otherUser) return;

    // Saat data chat mulai dimuat, set flag false agar tahu kapan loading selesai
    setIsInitialLoad(true);
  }, [userId, otherUser]);

  useEffect(() => {
    // Jika ada pesan baru atau saat load pertama kali selesai
    if (messages.length > 0 && isInitialLoad) {
      
      // Gunakan setTimeout kecil untuk memastikan DOM sudah siap
      const timer = setTimeout(() => {
        scrollToBottom("auto"); // Langsung jump ke bawah tanpa animasi smooth saat awal
        
        // Setelah selesai scroll, matikan mode initial load
        setIsInitialLoad(false); 
      }, 100);

      return () => clearTimeout(timer);
    }
    
    // Untuk pesan baru setelah chat terbuka, gunakan smooth scroll jika user sedang di bawah
    if (messages.length > 0 && !isInitialLoad) {
       const container = chatContainerRef.current;
       if (container) {
         const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
         if (isNearBottom) {
           scrollToBottom("smooth");
         }
       }
    }

  }, [messages, isInitialLoad]);

  // Tambahkan ini juga untuk memastikan saat component mount (pertama kali buka tab), posisi di bawah
  useEffect(() => {
     const timer = setTimeout(() => {
        scrollToBottom("auto");
     }, 500); // Delay sedikit lebih lama untuk kasus network lambat
     return () => clearTimeout(timer);
  }, []);
  
  // // Auto scroll ke bawah
  // const scrollToBottom = () => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  // };

  // useEffect(() => {
  //   scrollToBottom();
  // }, [messages]);

  // Set user online + heartbeat + visibility listener
  // useEffect(() => {
  //   if (!userId) return;

  //   const initPresence = async () => {
  //     await setUserOnline(userId);
  //     const presence = await getUserPresence(userId);
  //     setCurrentUserPresence(presence);

  //     // Start heartbeat setiap 30 detik
  //     heartbeatRef.current = startHeartbeat(userId, 30000);

  //     // Handle visibility change (tab minimize/hidden)
  //     const handleVisibilityChange = () => {
  //       if (document.hidden) {
  //         console.log("[Visibility] Tab hidden - user offline");
  //         setUserOffline(userId);
  //         if (heartbeatRef.current) {
  //           clearInterval(heartbeatRef.current);
  //           heartbeatRef.current = null;
  //         }
  //       } else {
  //         console.log("[Visibility] Tab visible - user online");
  //         setUserOnline(userId);
  //         if (!heartbeatRef.current) {
  //           heartbeatRef.current = startHeartbeat(userId, 30000);
  //         }
  //       }
  //     };
  //     // Handle beforeunload (close tab/refresh)
  //     const handleBeforeUnload = () => {
  //       console.log("[BeforeUnload] Setting offline");
  //       setUserOffline(userId);
  //       if (heartbeatRef.current) {
  //         clearInterval(heartbeatRef.current);
  //       }
  //     };
  //     // Add event listeners
  //     document.addEventListener("visibilitychange", handleVisibilityChange);
  //     window.addEventListener("beforeunload", handleBeforeUnload);
  //     // Cleanup
  //     return () => {
  //       document.removeEventListener("visibilitychange", handleVisibilityChange);
  //       window.removeEventListener("beforeunload", handleBeforeUnload);
  //       setUserOffline(userId);
  //       if (heartbeatRef.current) {
  //         clearInterval(heartbeatRef.current);
  //       }
  //     };
  //   };
  //   initPresence();
  // }, [userId]);

  // // Set user online saat masuk halaman
  // useEffect(() => {
  //   if (!userId) return;

  //   const initPresence = async () => {
  //     await setUserOnline(userId);
  //     const presence = await getUserPresence(userId);
  //     setCurrentUserPresence(presence);
  //   };

  //   initPresence();
  //   // Cleanup: Set offline saat keluar
  //   return () => {
  //     if (userId) {
  //       setUserOffline(userId);
  //     }
  //   };
  // }, [userId]);

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
    if (!userId || !chatPairData) return;

    // 2. Cek apakah user TERKUNCI berdasarkan data Firebase
    const locked = isCurrentUserLocked(chatPairData, userId);
    
    // 3. Jika terkunci ATAU masih blocked lokal → JANGAN kirim API
    if (locked || isBlocked) {
      console.log("🔒 Terkunci - API update-status DILEWATI");
      return;
    }

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
  }, [userId , chatPairData, isBlocked]);

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
                {renderStatusIndicatorlg(otherUserPresence)}
              </div>
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

        {/* Tombol Melayang (Floating Arrow) */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottomManual}
          className="absolute bottom-24 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-transform hover:scale-110 active:scale-95 focus:outline-none"
          aria-label="Scroll ke bawah"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </button>
      )}

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
