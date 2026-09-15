import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { ref, onValue, off, database } from "../lib/firebase";
import { getChatPairKey } from "../lib/firebase";

export default function ChatPage() {
  const router = useRouter();
  const { userId } = router.query;
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState(null);
  const [sending, setSending] = useState(false);
  const [otherUserStatus, setOtherUserStatus] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto scroll ke bawah
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Set status online saat halaman dibuka
  useEffect(() => {
    if (!userId) return;

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
  }, [userId]);
  
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

  if (!userId) {
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
            <p className="text-sm text-slate-400">Chat dengan: {otherUser}</p>
             {otherUserStatus && (
                <>
                  <span className="text-slate-600">•</span>
                  {otherUserStatus.status === "online" ? (
                    <span className="flex items-center gap-1 text-green-400">
                      <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
                      Online
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      {formatLastSeen(otherUserStatus.lastSeenTimestamp)}
                    </span>
                  )}
                </>
              )}
          </div>
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600">
              {userId.charAt(0).toUpperCase()}
            </div>
               {/* Online indicator di avatar */}
              {otherUserStatus?.status === "online" && (
                <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-900 bg-green-400"></div>
              )}
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
                <p className="mt-1 text-xs opacity-70">{msg.sentAt}</p>
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
