import { useState, useEffect } from "react";
import { ref, get, set, remove, database, onValue } from "../../lib/firebase";

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });
  const [editingId, setEditingId] = useState(null); // ID yang sedang diedit lock-nya
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [isDeleting, setIsDeleting] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Load semua data user dari Firebase
  useEffect(() => {
    const usersRef = ref(database, "users");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const usersList = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setUsers(usersList);
      } else {
        setUsers([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fungsi Format Tanggal WIB
  const formatDateWIB = (dateString) => {
    if (!dateString) return "-";
    return dateString; 
  };

  // Fungsi Sort Data
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedUsers = [...users].sort((a, b) => {
    if (sortConfig.key === "createdAt") {
      return sortConfig.direction === "asc" 
        ? a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt);
    }
    if (sortConfig.key === "id") {
      return sortConfig.direction === "asc"
        ? a.id.localeCompare(b.id)
        : b.id.localeCompare(a.id);
    }
    return 0;
  });

  // Filter berdasarkan Search
  const filteredUsers = sortedUsers.filter((user) => {
    const term = searchTerm.toLowerCase();
    return (
      user.id.toLowerCase().includes(term) ||
      (user.name && user.name.toLowerCase().includes(term)) ||
      (user.email && user.email.toLowerCase().includes(term))
    );
  });

  // Toggle Lock (Edit)
  const toggleLock = async (user) => {
    if (editingId !== user.id) {
      setEditingId(user.id);
      setPinInput("");
      setPinError("");
      return;
    }

    // Jika user sudah ada PIN dan ingin di-unlock
    if (user.isLocked) {
      const pairKey = user.chatPairKey || ""; // Asumsi ada field chatPairKey
      if (!pairKey) {
        setPinError("Tidak ada pasangan chat untuk di-unlock.");
        return;
      }
      
      // Prompt PIN untuk konfirmasi unlock
      const pin = prompt("Masukkan PIN untuk mengaktifkan kembali chat:");
      if (pin === user.pin) {
        await updateLockStatus(user.id, false, null);
      } else {
        setPinError("PIN salah!");
      }
      setEditingId(null);
      return;
    }

    // Jika ingin activate lock
    if (!pinInput) {
      setPinError("Masukkan PIN 4-6 digit untuk mengaktifkan lock.");
      return;
    }
    if (pinInput.length < 4 || pinInput.length > 6) {
      setPinError("PIN harus 4-6 digit.");
      return;
    }

    await updateLockStatus(user.id, true, pinInput);
    setEditingId(null);
    setPinInput("");
    setPinError("");
  };

  const updateLockStatus = async (userId, isLocked, pin) => {
    try {
      // 1. Update data user
      await set(ref(database, `users/${userId}`), {
        ...users.find((u) => u.id === userId),
        isLocked: isLocked,
        pin: isLocked ? pin : null,
        updatedAt: new Date().toISOString(),
      });

      // 2. Update chat-pair jika ada
      // (Logika ini akan dihandle di API atau real-time update Firebase)
      // Untuk simplifikasi, kita asumsikan update user cukup, 
      // karena chat-pair akan read lockSettings dari user data atau kita update juga di chat-pairs
      
      const pairKey = users.find((u) => u.id === userId)?.chatPairKey;
      if (pairKey) {
        const pairRef = ref(database, `chat-pairs/${pairKey}`);
        const pairSnap = await get(pairRef);
        if (pairSnap.exists()) {
          const currentPair = pairSnap.val();
          const updatedLocks = { ...currentPair.lockSettings };
          
          if (isLocked) {
            updatedLocks[userId] = { isLocked: true, pin: pin };
          } else {
            updatedLocks[userId] = { isLocked: false, pin: null };
          }

          await set(pairRef, {
            ...currentPair,
            lockSettings: updatedLocks,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      
      // Data akan otomatis refresh karena onValue di useEffect
    } catch (err) {
      console.error("Error updating lock:", err);
      setPinError("Gagal update lock.");
    }
  };

  // Delete User
  const confirmDelete = (user) => {
    setDeleteTarget(user);
    setShowDeleteModal(true);
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(deleteTarget.id);

    try {
      // 1. Hapus user
      await remove(ref(database, `users/${deleteTarget.id}`));

      // 2. Hapus dari chat-pair (jika ada)
      const pairKey = deleteTarget.chatPairKey;
      if (pairKey) {
        const pairRef = ref(database, `chat-pairs/${pairKey}`);
        const pairSnap = await get(pairRef);
        if (pairSnap.exists()) {
          const currentPair = pairSnap.val();
          const partnerId = currentPair.userA === deleteTarget.id ? currentPair.userB : currentPair.userA;
          
          // Cek apakah partner juga sudah dihapus atau belum
          const partnerSnap = await get(ref(database, `users/${partnerId}`));
          if (!partnerSnap.exists()) {
            // Jika partner sudah dihapus, hapus juga pair-nya
            await remove(pairRef);
          } else {
            // Jika partner masih ada, hapus referensi dari pair
            const updatedLocks = { ...currentPair.lockSettings };
            delete updatedLocks[deleteTarget.id];
            await set(pairRef, {
              ...currentPair,
              lockSettings: updatedLocks,
            });
          }
          
          // Hapus dari index
          await remove(ref(database, `user-chat-index/${partnerId}/${deleteTarget.id}`));
        }
      }
      
      // Hapus dari index user
      await remove(ref(database, `user-chat-index/${deleteTarget.id}`));
      
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (err) {
      console.error("Error deleting:", err);
      alert("Gagal menghapus user.");
    } finally {
      setIsDeleting(null);
    }
  };

  // Helper: Cek apakah user sedang diedit
  const isEditing = (id) => editingId === id;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
      <div className="mx-auto w-full max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">👥 Admin User Dashboard</h1>
            <p className="mt-1 text-slate-400">Kelola user, set lock, dan hapus data.</p>
          </div>
          
          {/* Search Bar */}
          <div className="relative w-full max-w-sm">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari user, nama, email..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 pl-10 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
            />
            <svg className="absolute left-3 top-3.5 h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Table Container */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl backdrop-blur">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-slate-800 bg-slate-950/50">
                <tr>
                  <th 
                    className="cursor-pointer px-6 py-4 text-sm font-semibold text-slate-300 hover:text-indigo-400"
                    onClick={() => handleSort("id")}
                  >
                    <div className="flex items-center gap-1">
                      User ID
                      {sortConfig.key === "id" && (
                        <span className="text-xs">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Nama / Email</th>
                  <th 
                    className="cursor-pointer px-6 py-4 text-sm font-semibold text-slate-300 hover:text-indigo-400"
                    onClick={() => handleSort("createdAt")}
                  >
                    <div className="flex items-center gap-1">
                      Dibuat Pada
                      {sortConfig.key === "createdAt" && (
                        <span className="text-xs">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Status Lock</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                      {loading ? "Memuat data..." : "Tidak ada data user."}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-800/50 transition">
                      {/* User ID Column */}
                      <td className="px-6 py-4 font-medium text-indigo-400">{user.id}</td>

                      {/* Nama/Email Column */}
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-slate-200">{user.name || user.id}</p>
                          {user.email && <p className="text-xs text-slate-500">{user.email}</p>}
                        </div>
                      </td>

                      {/* Created Date Column */}
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {formatDateWIB(user.createdAt)}
                      </td>

                      {/* Lock Status Column */}
                      <td className="px-6 py-4">
                        {isEditing(user.id) ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="password"
                              value={pinInput}
                              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                              placeholder="PIN 4-6 digit"
                              maxLength="6"
                              autoFocus
                              className="w-24 rounded-lg border border-slate-600 bg-slate-950 px-3 py-1 text-sm text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                            />
                            <button
                              onClick={() => toggleLock(user)}
                              disabled={!pinInput || pinInput.length < 4}
                              className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                            >
                              Set Lock
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setPinInput(""); setPinError(""); }}
                              className="rounded-lg border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {user.isLocked ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 border border-red-500/20">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                                Terkunci
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                                <span className="relative flex h-2 w-2">
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                Terbuka
                              </span>
                            )}
                            <button
                              onClick={() => toggleLock(user)}
                              className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                            >
                              {user.isLocked ? "Ubah PIN" : "Aktifkan Lock"}
                            </button>
                          </div>
                        )}
                        {pinError && (
                          <p className="mt-1 text-xs text-red-400">{pinError}</p>
                        )}
                      </td>

                      {/* Actions Column */}
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => toggleLock(user)}
                            disabled={isEditing(user.id)}
                            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                            title="Edit Lock"
                          >
                            {isEditing(user.id) ? "Editing..." : "Edit"}
                          </button>
                          <button
                            onClick={() => confirmDelete(user)}
                            disabled={isDeleting === user.id}
                            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                          >
                            {isDeleting === user.id ? "..." : "Hapus"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Footer Info */}
          <div className="border-t border-slate-800 bg-slate-950/50 px-6 py-3 text-xs text-slate-500">
            Menampilkan <span className="text-slate-300 font-medium">{filteredUsers.length}</span> user
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">Hapus User?</h3>
            </div>
            <p className="mb-6 text-sm text-slate-400">
              Apakah Anda yakin ingin menghapus user <span className="font-semibold text-white">{deleteTarget?.id}</span>?
              <br />
              <span className="text-xs">Tindakan ini akan menghapus chat pair terkait juga.</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Batal
              </button>
              <button
                onClick={performDelete}
                disabled={isDeleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition disabled:opacity-50"
              >
                {isDeleting ? "Menghapus..." : "Hapus Permanen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
