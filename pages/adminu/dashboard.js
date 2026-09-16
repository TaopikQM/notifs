import React, { useState, useEffect } from "react";
import { ref, get, set, remove, database, onValue, push } from "../../lib/firebase";

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "asc" });
  
  const [expandedRow, setExpandedRow] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [isDeleting, setIsDeleting] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  
  // State untuk Lock Checkbox + PIN
  const [lockCheckbox, setLockCheckbox] = useState({ userA: false, userB: false });
  const [pinInputs, setPinInputs] = useState({ userA: "", userB: "" });

  useEffect(() => {
    const usersRef = ref(database, "chat-pairs");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const usersList = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setUsers(usersList);
        console.log(usersList);
      } else {
        setUsers([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- SORTING ---
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedUsers = [...users].sort((a, b) => {
    const valA = a[sortConfig.key] ?? "";
    const valB = b[sortConfig.key] ?? "";

    if (typeof valA === "string" && typeof valB === "string") {
      return sortConfig.direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    if (typeof valA === "number" && typeof valB === "number") {
      return sortConfig.direction === "asc" ? valA - valB : valB - valA;
    }
    return 0;
  });

  // --- UNIVERSAL SEARCH ---
  const filteredUsers = sortedUsers.filter((user) => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;

    if (user.id.toLowerCase().includes(term)) return true;

    const checkField = (obj) => {
      if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
        return String(obj).toLowerCase().includes(term);
      }
      if (Array.isArray(obj)) {
        return obj.some(item => checkField(item));
      }
      if (typeof obj === "object" && obj !== null) {
        return Object.values(obj).some(val => checkField(val));
      }
      return false;
    };

    return checkField(user);
  });

  // --- EXPAND / COLLAPSE ROW ---
  const toggleExpand = (id) => {
    if (expandedRow === id) {
      setExpandedRow(null);
      setLockCheckbox({ userA: false, userB: false });
      setPinInputs({ userA: "", userB: "" });
    } else {
      setExpandedRow(id);
      const user = users.find(u => u.id === id);
      if (user) {
        setLockCheckbox({
          userA: user.lockUserA || false,
          userB: user.lockUserB || false,
        });
      }
    }
  };

  // --- SAVE TO LOG ---
  const saveToLog = async (id, oldData, newData) => {
    try {
      const logRef = ref(database, "log_chat-pairs");
      const newLogRef = push(logRef);
      
      await set(newLogRef, {
        chatPairId: id,
        oldData: oldData,
        newData: newData,
        changedAt: new Date().toISOString(),
        changedBy: "admin",
      });
      
      console.log("✅ Log saved:", newLogRef.key);
    } catch (err) {
      console.error("Error saving log:", err);
    }
  };

  // --- EDIT FIELD ---
  const startEdit = (id, field, value) => {
    setEditingField({ id, field });
    setEditValue(value);
  };

  const saveEdit = async () => {
    if (!editingField) return;
    
    const { id, field } = editingField;
    const user = users.find(u => u.id === id);
    if (!user) return;

    try {
      const oldData = { ...user };
      const updatedUser = { ...user, [field]: editValue };
      
      // Update ke Firebase
      await set(ref(database, `chat-pairs/${id}`), updatedUser);
      
      // Simpan ke log
      await saveToLog(id, oldData, updatedUser);
      
      setEditingField(null);
      setEditValue("");
    } catch (err) {
      console.error("Error saving edit:", err);
      alert("Gagal menyimpan perubahan");
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  // --- HANDLE LOCK CHECKBOX & PIN ---
  const handleLockCheckboxChange = (userType) => {
    setLockCheckbox(prev => ({
      ...prev,
      [userType]: !prev[userType]
    }));
  };

  const handlePinInputChange = (userType, value) => {
    setPinInputs(prev => ({
      ...prev,
      [userType]: value.replace(/\D/g, "").slice(0, 6)
    }));
  };

  const saveLockSettings = async (id) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    // Validasi PIN jika checkbox aktif
    if (lockCheckbox.userA && !pinInputs.userA) {
      alert("Masukkan PIN untuk User A");
      return;
    }
    if (lockCheckbox.userB && !pinInputs.userB) {
      alert("Masukkan PIN untuk User B");
      return;
    }

    try {
      const oldData = { ...user };
      const updatedUser = {
        ...user,
        lockUserA: lockCheckbox.userA,
        lockUserB: lockCheckbox.userB,
        pinUserA: lockCheckbox.userA ? pinInputs.userA : null,
        pinUserB: lockCheckbox.userB ? pinInputs.userB : null,
      };

      // Update ke Firebase
      await set(ref(database, `chat-pairs/${id}`), updatedUser);

      // Simpan ke log
      await saveToLog(id, oldData, updatedUser);

      alert("✅ Lock settings berhasil disimpan!");
      setExpandedRow(null);
      setLockCheckbox({ userA: false, userB: false });
      setPinInputs({ userA: "", userB: "" });
    } catch (err) {
      console.error("Error saving lock:", err);
      alert("Gagal menyimpan lock settings");
    }
  };

  // --- DELETE ---
  const confirmDelete = (user) => {
    setDeleteTarget(user);
    setShowDeleteModal(true);
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(deleteTarget.id);

    try {
      // Simpan ke log sebelum hapus
      await saveToLog(deleteTarget.id, deleteTarget, null);

      await remove(ref(database, `chat-pairs/${deleteTarget.id}`));

      const userA = deleteTarget.userA;
      const userB = deleteTarget.userB;
      if (userA) await remove(ref(database, `user-chat-index/${userA}/${userB}`));
      if (userB) await remove(ref(database, `user-chat-index/${userB}/${userA}`));

      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (err) {
      console.error("Error deleting:", err);
      alert("Gagal menghapus pair.");
    } finally {
      setIsDeleting(null);
    }
  };

  // --- RENDER EDITABLE FIELD ---
  const renderEditableField = (id, field, value) => {
    if (editingField?.id === id && editingField?.field === field) {
      return (
        <div className="flex gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1 rounded-md border border-indigo-500 bg-slate-950 px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          <button
            onClick={saveEdit}
            className="rounded-md bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-500"
          >
            Save
          </button>
          <button
            onClick={cancelEdit}
            className="rounded-md bg-slate-600 px-2 py-1 text-xs text-white hover:bg-slate-500"
          >
            Cancel
          </button>
        </div>
      );
    }

    return (
      <span 
        onClick={() => startEdit(id, field, value)}
        className="cursor-pointer hover:bg-slate-800 rounded px-1 transition inline-block"
        title="Klik untuk edit"
      >
        {value !== null && value !== undefined ? String(value) : "-"}
      </span>
    );
  };

  // --- RENDER NESTED OBJECT ---
  const renderNestedObject = (obj, parentKey = "") => {
    if (typeof obj !== "object" || obj === null) return null;

    return (
      <div className="ml-6 mt-2 space-y-1">
        {Object.entries(obj).map(([key, value]) => {
          const fieldName = parentKey ? `${parentKey}.${key}` : key;
          if (typeof value === "object" && value !== null) {
            return (
              <div key={fieldName} className="border-l-2 border-slate-700 pl-3">
                <span className="font-medium text-slate-400">{key}:</span>
                {renderNestedObject(value, fieldName)}
              </div>
            );
          }
          return (
            <div key={fieldName} className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{key}:</span>
              <span className="text-slate-300">{String(value)}</span>
            </div>
          );
        })}
      </div>
    );
  };

    // --- HANDLE STATUS TOGGLE (Satu Tombol) ---
  const handleStatusToggle = async (id) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    // Toggle: active → inactive, inactive → active
    const newStatus = user.status === "active" ? "inactive" : "active";

    try {
      const oldData = { ...user };
      const updatedUser = { ...user, status: newStatus };

      // Update ke Firebase
      await set(ref(database, `chat-pairs/${id}`), updatedUser);

      // Simpan ke log
      await saveToLog(id, oldData, updatedUser);

      console.log(`✅ Status ${id} berhasil diubah menjadi ${newStatus}`);
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Gagal mengubah status");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
      <div className="mx-auto w-full max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">👥 Admin Dashboard</h1>
            <p className="mt-1 text-slate-400">Kelola chat pairs. Klik baris untuk detail & edit.</p>
          </div>
          <div className="relative w-full max-w-sm">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari semua data..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 pl-10 text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
            />
            <svg className="absolute left-3 top-3.5 h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-slate-800 bg-slate-950/50">
                <tr>
                  <th 
                    className="cursor-pointer px-6 py-4 text-sm font-semibold text-slate-300 hover:text-indigo-400"
                    onClick={() => handleSort("id")}
                  >
                    <div className="flex items-center gap-1">
                      ID User
                      {sortConfig.key === "id" && (
                        <span className="text-xs">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="cursor-pointer px-6 py-4 text-sm font-semibold text-slate-300 hover:text-indigo-400"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {sortConfig.key === "status" && (
                        <span className="text-xs">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="cursor-pointer px-6 py-4 text-sm font-semibold text-slate-300 hover:text-indigo-400"
                    onClick={() => handleSort("createdAtISO")}
                  >
                    <div className="flex items-center gap-1">
                      Dibuat (ISO)
                      {sortConfig.key === "createdAtISO" && (
                        <span className="text-xs">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                      {loading ? "Memuat data..." : "Tidak ada data chat pair."}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <React.Fragment key={user.id}>
                      {/* Main Row */}
                      <tr 
                        onClick={() => toggleExpand(user.id)}
                        className={`hover:bg-slate-800/50 transition cursor-pointer ${expandedRow === user.id ? 'bg-slate-800' : ''}`}
                      >
                        <td className="px-6 py-4 font-medium text-indigo-400">{user.id}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                            user.status === "active" 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}>
                            <span className="relative flex h-2 w-2">
                              {user.status === "active" ? (
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              ) : (
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                              )}
                            </span>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400">{user.createdAtISO}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); confirmDelete(user); }}
                            disabled={isDeleting === user.id}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            {isDeleting === user.id ? "..." : "Hapus"}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Detail Row */}
                      {expandedRow === user.id && (
                        <tr className="bg-slate-900/50">
                          <td colSpan="4" className="px-6 py-4">
                            <div className="space-y-4 p-4 border border-slate-800 rounded-lg">
                              <h3 className="text-sm font-semibold text-slate-300">📋 Detail Chat Pair</h3>
                              
                              {/* Grid Fields */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Left Column */}
                                <div className="space-y-3">
                                  <div>
                                    <span className="text-xs text-slate-500">User A:</span>
                                    <div>{renderEditableField(user.id, "userA", user.userA)}</div>
                                  </div>
                                  <div>
                                    <span className="text-xs text-slate-500">User B:</span>
                                    <div>{renderEditableField(user.id, "userB", user.userB)}</div>
                                  </div>
                                  <div>
                                    <span className="text-xs text-slate-500">Created By:</span>
                                    <div>{renderEditableField(user.id, "createdBy", user.createdBy)}</div>
                                  </div>
                                                                     <div>
                                    <span className="text-xs text-slate-500">Status:</span>
                                    <div className="mt-1">
                                      <button
                                        onClick={() => handleStatusToggle(user.id)}
                                        className={`px-6 py-2 rounded-lg text-sm font-semibold transition shadow-lg ${
                                          user.status === "active"
                                            ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/50"
                                            : "bg-red-600 text-white hover:bg-red-700 shadow-red-600/50"
                                        }`}
                                      >
                                        {user.status === "active" ? "✅ Active" : "❌ Inactive"}
                                      </button>
                                    </div>
                                  </div>
{ /* <div>
                                    <span className="text-xs text-slate-500">Status:</span>
                                    <div>{renderEditableField(user.id, "status", user.status)}</div>
                                  </div> */}
                                </div>

                                {/* Right Column */}
                                <div className="space-y-3">
                                  <div>
                                    <span className="text-xs text-slate-500">Created At:</span>
                                    <div>{renderEditableField(user.id, "createdAt", user.createdAt)}</div>
                                  </div>
                                  <div>
                                    <span className="text-xs text-slate-500">Updated At:</span>
                                    <div>{renderEditableField(user.id, "updatedAt", user.updatedAt)}</div>
                                  </div>
                                  <div>
                                    <span className="text-xs text-slate-500">Created At ISO:</span>
                                    <div>{renderEditableField(user.id, "createdAtISO", user.createdAtISO)}</div>
                                  </div>
                                  <div>
                                    <span className="text-xs text-slate-500">Timestamp:</span>
                                    <div>{renderEditableField(user.id, "createdAtTimestamp", user.createdAtTimestamp)}</div>
                                  </div>
                                </div>
                              </div>

                              {/* Directions */}
                              <div className="border-t border-slate-700 pt-4">
                                <span className="text-xs text-slate-500">Directions:</span>
                                {renderNestedObject(user.directions)}
                              </div>

                              {/* Lock Settings */}
                              <div className="border-t border-slate-700 pt-4">
                                <h4 className="text-sm font-semibold text-slate-300 mb-3">🔐 Lock Settings</h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Lock User A */}
                                  <div className="border border-slate-700 rounded-lg p-3">
                                    <label className="flex items-center gap-2 mb-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={lockCheckbox.userA}
                                        onChange={() => handleLockCheckboxChange("userA")}
                                        className="w-4 h-4 rounded border-slate-600 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                                      />
                                      <span className="text-sm text-slate-300">Lock User A ({user.userA})</span>
                                    </label>
                                    {lockCheckbox.userA && (
                                      <input
                                        type="password"
                                        value={pinInputs.userA}
                                        onChange={(e) => handlePinInputChange("userA", e.target.value)}
                                        placeholder="PIN 4-6 digit"
                                        maxLength="6"
                                        className="w-full rounded-md border border-amber-500 bg-slate-950 px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-amber-500"
                                      />
                                    )}
                                  </div>

                                  {/* Lock User B */}
                                  <div className="border border-slate-700 rounded-lg p-3">
                                    <label className="flex items-center gap-2 mb-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={lockCheckbox.userB}
                                        onChange={() => handleLockCheckboxChange("userB")}
                                        className="w-4 h-4 rounded border-slate-600 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                                      />
                                      <span className="text-sm text-slate-300">Lock User B ({user.userB})</span>
                                    </label>
                                    {lockCheckbox.userB && (
                                      <input
                                        type="password"
                                        value={pinInputs.userB}
                                        onChange={(e) => handlePinInputChange("userB", e.target.value)}
                                        placeholder="PIN 4-6 digit"
                                        maxLength="6"
                                        className="w-full rounded-md border border-amber-500 bg-slate-950 px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-amber-500"
                                      />
                                    )}
                                  </div>
                                </div>

                                <button
                                  onClick={() => saveLockSettings(user.id)}
                                  className="mt-3 w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 transition"
                                >
                                  💾 Simpan Lock Settings
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-800 bg-slate-950/50 px-6 py-3 text-xs text-slate-500">
            Menampilkan <span className="text-slate-300 font-medium">{filteredUsers.length}</span> chat pair
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">Hapus Chat Pair?</h3>
            </div>
            <p className="mb-6 text-sm text-slate-400">
              Yakin hapus <span className="font-semibold text-white">{deleteTarget?.id}</span>?
              <br />
              <span className="text-xs">Data lama akan disimpan ke log_chat-pairs.</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700"
              >
                Batal
              </button>
              <button
                onClick={performDelete}
                disabled={isDeleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {isDeleting ? "..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}










//ini ga bisa edit tapi dropdown
// import React from 'react'; // ✅ Tambahkan baris ini
// import { useState, useEffect } from "react";
// import { ref, get, set, remove, database, onValue } from "../../lib/firebase";

// export default function AdminDashboard() {
//   const [users, setUsers] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [searchTerm, setSearchTerm] = useState("");
//   const [sortConfig, setSortConfig] = useState({ key: "id", direction: "asc" });
  
//   // State untuk expand row dan edit
//   const [expandedRow, setExpandedRow] = useState(null); // ID baris yang sedang expand
//   const [editingField, setEditingField] = useState(null); // { id, field, value }
//   const [editValue, setEditValue] = useState("");
//   const [isDeleting, setIsDeleting] = useState(null);
//   const [showDeleteModal, setShowDeleteModal] = useState(false);
//   const [deleteTarget, setDeleteTarget] = useState(null);

//   // Load data chat-pairs dari Firebase (sesuai contoh data Anda)
//   useEffect(() => {
//     const usersRef = ref(database, "chat-pairs");
//     const unsubscribe = onValue(usersRef, (snapshot) => {
//       if (snapshot.exists()) {
//         const data = snapshot.val();
//         const usersList = Object.keys(data).map((key) => ({
//           id: key,
//           ...data[key],
//         }));
//         setUsers(usersList);
//       } else {
//         setUsers([]);
//       }
//       setLoading(false);
//     });

//     return () => unsubscribe();
//   }, []);

//   // --- SORTING ---
//   const handleSort = (key) => {
//     let direction = "asc";
//     if (sortConfig.key === key && sortConfig.direction === "asc") {
//       direction = "desc";
//     }
//     setSortConfig({ key, direction });
//   };

//   const sortedUsers = [...users].sort((a, b) => {
//     const valA = a[sortConfig.key] ?? "";
//     const valB = b[sortConfig.key] ?? "";

//     if (typeof valA === "string" && typeof valB === "string") {
//       return sortConfig.direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
//     }
//     if (typeof valA === "number" && typeof valB === "number") {
//       return sortConfig.direction === "asc" ? valA - valB : valB - valA;
//     }
//     return 0;
//   });

//   // --- UNIVERSAL SEARCH (Recursive) ---
//   const matchesSearch = (obj, term) => {
//     if (!obj || typeof term !== "string") return false;
//     const searchStr = String(obj).toLowerCase();
//     return searchStr.includes(term.toLowerCase());
//   };

//   const filteredUsers = sortedUsers.filter((user) => {
//     const term = searchTerm.toLowerCase();
//     if (!term) return true;

//     // Cek ID
//     if (user.id.toLowerCase().includes(term)) return true;

//     // Cek semua field secara rekursif
//     const checkField = (obj) => {
//       if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
//         return String(obj).toLowerCase().includes(term);
//       }
//       if (Array.isArray(obj)) {
//         return obj.some(item => checkField(item));
//       }
//       if (typeof obj === "object" && obj !== null) {
//         return Object.values(obj).some(val => checkField(val));
//       }
//       return false;
//     };

//     return checkField(user);
//   });

//   // --- EXPAND / COLLAPSE ROW ---
//   const toggleExpand = (id) => {
//     if (expandedRow === id) {
//       setExpandedRow(null);
//     } else {
//       setExpandedRow(id);
//     }
//   };

//   // --- EDIT FIELD ---
//   const startEdit = (id, field, value) => {
//     setEditingField({ id, field });
//     setEditValue(value);
//   };

//   const saveEdit = async () => {
//     if (!editingField) return;
    
//     const { id, field } = editingField;
//     const user = users.find(u => u.id === id);
//     if (!user) return;

//     try {
//       const updatedUser = { ...user, [field]: editValue };
      
//       // Update ke Firebase
//       await set(ref(database, `chat-pairs/${id}`), updatedUser);
      
//       // Refresh UI
//       setEditingField(null);
//       setEditValue("");
//     } catch (err) {
//       console.error("Error saving edit:", err);
//       alert("Gagal menyimpan perubahan");
//     }
//   };

//   const cancelEdit = () => {
//     setEditingField(null);
//     setEditValue("");
//   };

//   // --- DELETE ---
//   const confirmDelete = (user) => {
//     setDeleteTarget(user);
//     setShowDeleteModal(true);
//   };

//   const performDelete = async () => {
//     if (!deleteTarget) return;
//     setIsDeleting(deleteTarget.id);

//     try {
//       await remove(ref(database, `chat-pairs/${deleteTarget.id}`));
      
//       // Jika ada user-chat-index, hapus juga
//       const userA = deleteTarget.userA;
//       const userB = deleteTarget.userB;
//       if (userA) await remove(ref(database, `user-chat-index/${userA}/${userB}`));
//       if (userB) await remove(ref(database, `user-chat-index/${userB}/${userA}`));

//       setShowDeleteModal(false);
//       setDeleteTarget(null);
//     } catch (err) {
//       console.error("Error deleting:", err);
//       alert("Gagal menghapus pair.");
//     } finally {
//       setIsDeleting(null);
//     }
//   };

//   // --- RENDER FIELD (untuk edit langsung) ---
//   const renderEditableField = (id, field, value) => {
//     if (editingField?.id === id && editingField?.field === field) {
//       return (
//         <input
//           type="text"
//           value={editValue}
//           onChange={(e) => setEditValue(e.target.value)}
//           onBlur={saveEdit}
//           onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }}
//           className="w-full rounded-md border border-indigo-500 bg-slate-950 px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
//           autoFocus
//         />
//       );
//     }

//     return (
//       <span 
//         onClick={() => startEdit(id, field, value)}
//         className="cursor-pointer hover:bg-slate-800 rounded px-1 transition"
//         title="Klik untuk edit"
//       >
//         {value !== null && value !== undefined ? String(value) : "-"}
//       </span>
//     );
//   };

//   // --- RENDER NESTED OBJECT (directions) ---
//   const renderNestedObject = (obj, parentKey = "") => {
//     if (typeof obj !== "object" || obj === null) return null;

//     return (
//       <div className="ml-6 mt-2 space-y-1">
//         {Object.entries(obj).map(([key, value]) => {
//           const fieldName = parentKey ? `${parentKey}.${key}` : key;
//           if (typeof value === "object" && value !== null) {
//             return (
//               <div key={fieldName} className="border-l-2 border-slate-700 pl-3">
//                 <span className="font-medium text-slate-400">{key}:</span>
//                 {renderNestedObject(value, fieldName)}
//               </div>
//             );
//           }
//           return (
//             <div key={fieldName} className="flex items-center gap-2">
//               <span className="text-xs text-slate-500">{key}:</span>
//               {renderEditableField(expandedRow, fieldName, value)}
//             </div>
//           );
//         })}
//       </div>
//     );
//   };

//   return (
//     <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
//       <div className="mx-auto w-full max-w-7xl">
//         {/* Header */}
//         <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
//           <div>
//             <h1 className="text-3xl font-bold tracking-tight">👥 Admin Dashboard</h1>
//             <p className="mt-1 text-slate-400">Kelola chat pairs. Klik baris untuk lihat detail & edit.</p>
//           </div>
//           <div className="relative w-full max-w-sm">
//             <input
//               type="text"
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//               placeholder="Cari semua data (ID, userA, status, directions, dll)..."
//               className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 pl-10 text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
//             />
//             <svg className="absolute left-3 top-3.5 h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
//             </svg>
//           </div>
//         </div>

//         {/* Table */}
//         <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl overflow-hidden">
//           <div className="overflow-x-auto">
//             <table className="w-full text-left">
//               <thead className="border-b border-slate-800 bg-slate-950/50">
//                 <tr>
//                   <th 
//                     className="cursor-pointer px-6 py-4 text-sm font-semibold text-slate-300 hover:text-indigo-400"
//                     onClick={() => handleSort("id")}
//                   >
//                     <div className="flex items-center gap-1">
//                       ID User
//                       {sortConfig.key === "id" && (
//                         <span className="text-xs">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
//                       )}
//                     </div>
//                   </th>
//                   <th 
//                     className="cursor-pointer px-6 py-4 text-sm font-semibold text-slate-300 hover:text-indigo-400"
//                     onClick={() => handleSort("status")}
//                   >
//                     <div className="flex items-center gap-1">
//                       Status
//                       {sortConfig.key === "status" && (
//                         <span className="text-xs">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
//                       )}
//                     </div>
//                   </th>
//                   <th 
//                     className="cursor-pointer px-6 py-4 text-sm font-semibold text-slate-300 hover:text-indigo-400"
//                     onClick={() => handleSort("createdAtISO")}
//                   >
//                     <div className="flex items-center gap-1">
//                       Dibuat (ISO)
//                       {sortConfig.key === "createdAtISO" && (
//                         <span className="text-xs">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
//                       )}
//                     </div>
//                   </th>
//                   <th className="px-6 py-4 text-sm font-semibold text-slate-300">Aksi</th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-slate-800">
//                 {filteredUsers.length === 0 ? (
//                   <tr>
//                     <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
//                       {loading ? "Memuat data..." : "Tidak ada data chat pair."}
//                     </td>
//                   </tr>
//                 ) : (
//                   filteredUsers.map((user) => (
//                     <React.Fragment key={user.id}>
//                       {/* Main Row */}
//                       <tr 
//                         onClick={() => toggleExpand(user.id)}
//                         className={`hover:bg-slate-800/50 transition cursor-pointer ${expandedRow === user.id ? 'bg-slate-800' : ''}`}
//                       >
//                         <td className="px-6 py-4 font-medium text-indigo-400">{user.id}</td>
//                         <td className="px-6 py-4">
//                           <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
//                             user.status === "active" 
//                               ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
//                               : "bg-red-500/10 text-red-400 border border-red-500/20"
//                           }`}>
//                             <span className="relative flex h-2 w-2">
//                               {user.status === "active" ? (
//                                 <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
//                               ) : (
//                                 <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
//                               )}
//                             </span>
//                             {user.status}
//                           </span>
//                         </td>
//                         <td className="px-6 py-4 text-slate-400">{user.createdAtISO}</td>
//                         <td className="px-6 py-4">
//                           <button
//                             onClick={(e) => { e.stopPropagation(); confirmDelete(user); }}
//                             disabled={isDeleting === user.id}
//                             className="text-xs text-red-400 hover:text-red-300"
//                           >
//                             {isDeleting === user.id ? "..." : "Hapus"}
//                           </button>
//                         </td>
//                       </tr>

//                       {/* Expandable Detail Row */}
//                       {expandedRow === user.id && (
//                         <tr className="bg-slate-900/50">
//                           <td colSpan="4" className="px-6 py-4">
//                             <div className="space-y-4 p-4 border border-slate-800 rounded-lg">
//                               <h3 className="text-sm font-semibold text-slate-300">Detail Chat Pair</h3>
//                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                                 <div>
//                                   <div className="mb-2">
//                                     <span className="text-xs text-slate-500">User A:</span>
//                                     {renderEditableField(user.id, "userA", user.userA)}
//                                   </div>
//                                   <div className="mb-2">
//                                     <span className="text-xs text-slate-500">User B:</span>
//                                     {renderEditableField(user.id, "userB", user.userB)}
//                                   </div>
//                                   <div className="mb-2">
//                                     <span className="text-xs text-slate-500">Created By:</span>
//                                     {renderEditableField(user.id, "createdBy", user.createdBy)}
//                                   </div>
//                                   <div className="mb-2">
//                                     <span className="text-xs text-slate-500">Updated At:</span>
//                                     {renderEditableField(user.id, "updatedAt", user.updatedAt)}
//                                   </div>
//                                   <div className="mb-2">
//                                     <span className="text-xs text-slate-500">Lock User A:</span>
//                                     {renderEditableField(user.id, "lockUserA", user.lockUserA)}
//                                   </div>
//                                   <div className="mb-2">
//                                     <span className="text-xs text-slate-500">Lock User B:</span>
//                                     {renderEditableField(user.id, "lockUserB", user.lockUserB)}
//                                   </div>
//                                 </div>
//                                 <div>
//                                   <div className="mb-2">
//                                     <span className="text-xs text-slate-500">Created At:</span>
//                                     {renderEditableField(user.id, "createdAt", user.createdAt)}
//                                   </div>
//                                   <div className="mb-2">
//                                     <span className="text-xs text-slate-500">Created At Timestamp:</span>
//                                     {renderEditableField(user.id, "createdAtTimestamp", user.createdAtTimestamp)}
//                                   </div>
//                                   <div className="mb-2">
//                                     <span className="text-xs text-slate-500">Status:</span>
//                                     {renderEditableField(user.id, "status", user.status)}
//                                   </div>
//                                   <div className="mb-2">
//                                     <span className="text-xs text-slate-500">Directions:</span>
//                                     {renderNestedObject(user.directions)}
//                                   </div>
//                                 </div>
//                               </div>
//                             </div>
//                           </td>
//                         </tr>
//                       )}
//                     </React.Fragment>
//                   ))
//                 )}
//               </tbody>
//             </table>
//           </div>
//           <div className="border-t border-slate-800 bg-slate-950/50 px-6 py-3 text-xs text-slate-500">
//             Menampilkan <span className="text-slate-300 font-medium">{filteredUsers.length}</span> chat pair
//           </div>
//         </div>
//       </div>

//       {/* Delete Confirmation Modal */}
//       {showDeleteModal && (
//                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
//           <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
//             <div className="mb-4 flex items-center gap-3">
//               <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
//                 <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
//                 </svg>
//               </div>
//               <h3 className="text-lg font-bold text-white">Hapus Chat Pair?</h3>
//             </div>
//             <p className="mb-6 text-sm text-slate-400">
//               Apakah Anda yakin ingin menghapus chat pair <span className="font-semibold text-white">{deleteTarget?.id}</span>?
//               <br />
//               <span className="text-xs">Tindakan ini akan menghapus data chat dan referensi di user-chat-index.</span>
//             </p>
//             <div className="flex gap-3">
//               <button
//                 onClick={() => setShowDeleteModal(false)}
//                 disabled={isDeleting}
//                 className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition"
//               >
//                 Batal
//               </button>
//               <button
//                 onClick={performDelete}
//                 disabled={isDeleting}
//                 className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition disabled:opacity-50"
//               >
//                 {isDeleting ? "Menghapus..." : "Hapus Permanen"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }







// // ini tampilan berantakan dan ga bisa di edit.
// // import { useState, useEffect } from "react";
// // import { ref, get, set, remove, database, onValue } from "../../lib/firebase";

// // import Link from "next/link";

// // export default function AdminDashboard() {
// //   const [users, setUsers] = useState([]);
// //   const [loading, setLoading] = useState(true);
// //   const [searchTerm, setSearchTerm] = useState("");
// //   const [sortConfig, setSortConfig] = useState({ key: "createdAtISO", direction: "desc" });
  
// //   // State untuk edit langsung (direct edit)
// //   const [editingCell, setEditingCell] = useState(null); // { id, field, oldValue }
// //   const [editValue, setEditValue] = useState("");
// //   const [pinInput, setPinInput] = useState("");
// //   const [pinError, setPinError] = useState("");
// //   const [isDeleting, setIsDeleting] = useState(null);
// //   const [showDeleteModal, setShowDeleteModal] = useState(false);
// //   const [deleteTarget, setDeleteTarget] = useState(null);

// //   // Load semua data user dari Firebase
// //   useEffect(() => {
// //     // const usersRef = ref(database, "users");
// //     const usersRef = ref(database, "chat-pairs");
// //     const unsubscribe = onValue(usersRef, (snapshot) => {
// //       if (snapshot.exists()) {
// //         const data = snapshot.val();
// //         const usersList = Object.keys(data).map((key) => ({
// //           id: key,
// //           ...data[key],
// //         }));
// //         setUsers(usersList);
// //         console.log(usersList);
// //       } else {
// //         setUsers([]);
// //       }
// //       setLoading(false);
// //     });

// //     return () => unsubscribe();
// //   }, []);

// //   // Fungsi Format Tanggal WIB (jika diperlukan)
// //   const formatDateWIB = (dateString) => {
// //     if (!dateString) return "-";
// //     return dateString;
// //   };

// //   // --- SORTING LOGIC (Diperbaiki untuk undefined) ---
// //   const handleSort = (key) => {
// //     let direction = "asc";
// //     if (sortConfig.key === key && sortConfig.direction === "asc") {
// //       direction = "desc";
// //     }
// //     setSortConfig({ key, direction });
// //   };

// //   const sortedUsers = [...users].sort((a, b) => {
// //     // Ambil nilai dengan fallback agar tidak error undefined
// //     const valA = a[sortConfig.key] ?? "";
// //     const valB = b[sortConfig.key] ?? "";

// //     if (typeof valA === "string" && typeof valB === "string") {
// //       return sortConfig.direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
// //     }
    
// //     // Jika angka (timestamp)
// //     if (typeof valA === "number" && typeof valB === "number") {
// //       return sortConfig.direction === "asc" ? valA - valB : valB - valA;
// //     }

// //     return 0;
// //   });

// //   // --- UNIVERSAL SEARCH (Recursive) ---
// //   const matchesSearch = (obj, term) => {
// //     if (!obj || typeof term !== "string") return false;
// //     const searchStr = String(obj).toLowerCase();
// //     return searchStr.includes(term.toLowerCase());
// //   };

// //   const filteredUsers = sortedUsers.filter((user) => {
// //     const term = searchTerm.toLowerCase();
// //     if (!term) return true;

// //     // Cek ID dulu (wajib ada)
// //     if (user.id.toLowerCase().includes(term)) return true;

// //     // Cek semua field secara rekursif
// //     const checkField = (obj) => {
// //       if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
// //         return String(obj).toLowerCase().includes(term);
// //       }
// //       if (Array.isArray(obj)) {
// //         return obj.some(item => checkField(item));
// //       }
// //       if (typeof obj === "object" && obj !== null) {
// //         return Object.values(obj).some(val => checkField(val));
// //       }
// //       return false;
// //     };

// //     return checkField(user);
// //   });

// //   // --- EDIT DIRECTLY ---
// //   const startEdit = (user, field, value) => {
// //     // Tidak bisa edit ID
// //     if (field === "id") return;
    
// //     setEditingCell({ id: user.id, field });
// //     setEditValue(value);
// //   };

// //   const saveEdit = async () => {
// //     if (!editingCell) return;
    
// //     const { id, field } = editingCell;
// //     const user = users.find(u => u.id === id);
// //     if (!user) return;

// //     try {
// //       const updatedUser = { ...user, [field]: editValue };
      
// //       // Update ke Firebase
// //       await set(ref(database, `users/${id}`), updatedUser);
      
// //       // Jika edit lockSettings secara manual (opsional, biasanya dihandle via tombol Lock)
// //       // Di sini kita asumsikan edit field umum saja
      
// //       setEditingCell(null);
// //       setEditValue("");
// //     } catch (err) {
// //       console.error("Error saving edit:", err);
// //       alert("Gagal menyimpan perubahan");
// //     }
// //   };

// //   const cancelEdit = () => {
// //     setEditingCell(null);
// //     setEditValue("");
// //   };

// //   // --- TOGGLE LOCK (Fitur Khusus) ---
// //   const toggleLock = async (user) => {
// //     if (editingCell) return; // Jangan edit saat sedang edit field lain

// //     if (user.isLocked) {
// //       const pin = prompt("Masukkan PIN untuk mengaktifkan kembali chat (Unlock):");
// //       if (pin === user.pin) {
// //         await updateLockStatus(user.id, false, null);
// //       } else if (pin !== null) { // null = user cancel
// //         setPinError("PIN salah!");
// //       }
// //     } else {
// //       setEditingCell({ id: user.id, field: "lock" });
// //       setPinInput("");
// //       setPinError("");
// //     }
// //   };

// //   const saveLock = async () => {
// //     if (!pinInput || pinInput.length < 4 || pinInput.length > 6) {
// //       setPinError("PIN harus 4-6 digit.");
// //       return;
// //     }

// //     await updateLockStatus(editingCell.id, true, pinInput);
// //     setEditingCell(null);
// //     setPinInput("");
// //     setPinError("");
// //   };

// //   const updateLockStatus = async (userId, isLocked, pin) => {
// //     try {
// //       const user = users.find(u => u.id === userId);
// //       await set(ref(database, `users/${userId}`), {
// //         ...user,
// //         isLocked: isLocked,
// //         pin: isLocked ? pin : null,
// //         updatedAt: new Date().toISOString(),
// //       });

// //       // Update chat-pair jika ada
// //       const pairKey = user.chatPairKey;
// //       if (pairKey) {
// //         const pairRef = ref(database, `chat-pairs/${pairKey}`);
// //         const pairSnap = await get(pairRef);
// //         if (pairSnap.exists()) {
// //           const currentPair = pairSnap.val();
// //           const updatedLocks = { ...currentPair.lockSettings };
// //           updatedLocks[userId] = { isLocked, pin: isLocked ? pin : null };
// //           await set(pairRef, { ...currentPair, lockSettings: updatedLocks, updatedAt: new Date().toISOString() });
// //         }
// //       }
// //     } catch (err) {
// //       console.error("Error updating lock:", err);
// //       setPinError("Gagal update lock.");
// //     }
// //   };

// //   // --- DELETE ---
// //   const confirmDelete = (user) => {
// //     setDeleteTarget(user);
// //     setShowDeleteModal(true);
// //   };

// //   const performDelete = async () => {
// //     if (!deleteTarget) return;
// //     setIsDeleting(deleteTarget.id);

// //     try {
// //       await remove(ref(database, `users/${deleteTarget.id}`));
      
// //       // Logic hapus pair (sama seperti sebelumnya)
// //       const pairKey = deleteTarget.chatPairKey;
// //       if (pairKey) {
// //         const pairRef = ref(database, `chat-pairs/${pairKey}`);
// //         const pairSnap = await get(pairRef);
// //         if (pairSnap.exists()) {
// //           const currentPair = pairSnap.val();
// //           const partnerId = currentPair.userA === deleteTarget.id ? currentPair.userB : currentPair.userA;
// //           const partnerSnap = await get(ref(database, `users/${partnerId}`));
          
// //           if (!partnerSnap.exists()) {
// //             await remove(pairRef);
// //           } else {
// //             const updatedLocks = { ...currentPair.lockSettings };
// //             delete updatedLocks[deleteTarget.id];
// //             await set(pairRef, { ...currentPair, lockSettings: updatedLocks });
// //           }
// //           await remove(ref(database, `user-chat-index/${partnerId}/${deleteTarget.id}`));
// //         }
// //       }
// //       await remove(ref(database, `user-chat-index/${deleteTarget.id}`));
      
// //       setShowDeleteModal(false);
// //       setDeleteTarget(null);
// //     } catch (err) {
// //       console.error("Error deleting:", err);
// //       alert("Gagal menghapus user.");
// //     } finally {
// //       setIsDeleting(null);
// //     }
// //   };

// //   // --- RENDER FIELD ---
// //   const renderCell = (user, field, value) => {
// //     if (editingCell?.id === user.id && editingCell?.field === field) {
// //       if (field === "lock") {
// //         return (
// //           <div className="flex gap-2">
// //             <input
// //               type="password"
// //               value={pinInput}
// //               onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
// //               className="w-24 rounded-lg border border-amber-500 bg-slate-950 px-2 py-1 text-sm text-white focus:ring-2 focus:ring-amber-500"
// //               autoFocus
// //             />
// //             <button onClick={saveLock} className="text-xs bg-amber-600 text-white px-2 py-1 rounded hover:bg-amber-500">OK</button>
// //             <button onClick={cancelEdit} className="text-xs bg-slate-600 text-white px-2 py-1 rounded hover:bg-slate-500">X</button>
// //           </div>
// //         );
// //       }

// //       return (
// //         <input
// //           type="text"
// //           value={editValue}
// //           onChange={(e) => setEditValue(e.target.value)}
// //           onBlur={saveEdit}
// //           onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }}
// //           className="w-full rounded-md border border-indigo-500 bg-slate-950 px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
// //           autoFocus
// //         />
// //       );
// //     }

// //     return (
// //       <span 
// //         onClick={() => startEdit(user, field, value)}
// //         className="cursor-pointer hover:bg-slate-800 rounded px-1 transition"
// //         title="Klik untuk edit"
// //       >
// //         {value !== null && value !== undefined ? String(value) : "-"}
// //       </span>
// //     );
// //   };

// //   return (
// //     <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
// //       <div className="mx-auto w-full max-w-7xl">
// //         {/* Header */}
// //         <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
// //           <div>
// //             <h1 className="text-3xl font-bold tracking-tight">👥 Admin Dashboard</h1>
// //             <p className="mt-1 text-slate-400">Kelola semua data user. Klik kolom untuk edit (kecuali ID).</p>
// //           </div>
// //           <input
// //             type="text"
// //             value={searchTerm}
// //             onChange={(e) => setSearchTerm(e.target.value)}
// //             placeholder="Cari semua data (ID, nama, status, directions, dll)..."
// //             className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 pl-10 text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
// //           />
// //         </div>
// //          {/* Tombol di bawah card */}
// //         <div className="mt-4 mb-8 flex justify-center">
// //           <Link
// //             href="/adminu/add-user"
// //             className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
// //           >
// //             <svg
// //               xmlns="http://www.w3.org/2000/svg"
// //               viewBox="0 0 20 20"
// //               fill="currentColor"
// //               className="h-4 w-4"
// //               aria-hidden="true"
// //             >
// //               <path d="M10.707 2.293a1 1 0 0 0-1.414 0l-7 7A1 1 0 0 0 3 11h1v5a2 2 0 0 0 2 2h2v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4h2a2 2 0 0 0 2-2v-5h1a1 1 0 0 0 .707-1.707l-7-7Z" />
// //             </svg>
// //             Kembali ke add user
// //           </Link>
// //         </div>

// //         {/* Table */}
// //         <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl overflow-hidden">
// //           <div className="overflow-x-auto">
// //             <table className="w-full text-left">
// //               <thead className="border-b border-slate-800 bg-slate-950/50">
// //                 <tr>
// //                   <th className="px-6 py-4 text-sm font-semibold text-slate-300">User ID</th>
// //                   <th 
// //                     className="cursor-pointer px-6 py-4 text-sm font-semibold text-slate-300 hover:text-indigo-400"
// //                     onClick={() => handleSort("id")}
// //                   >
// //                     <div className="flex items-center gap-1">ID User <span className="text-xs">{sortConfig.key === "id" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}</span></div>
// //                   </th>
// //                   <th className="px-6 py-4 text-sm font-semibold text-slate-300">Nama / Email</th>
// //                   <th 
// //                     className="cursor-pointer px-6 py-4 text-sm font-semibold text-slate-300 hover:text-indigo-400"
// //                     onClick={() => handleSort("createdAtISO")}
// //                   >
// //                     <div className="flex items-center gap-1">Dibuat <span className="text-xs">{sortConfig.key === "createdAtISO" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}</span></div>
// //                   </th>
// //                   <th className="px-6 py-4 text-sm font-semibold text-slate-300">Status Lock</th>
// //                   <th className="px-6 py-4 text-sm font-semibold text-slate-300">Actions</th>
// //                 </tr>
// //               </thead>
// //               <tbody className="divide-y divide-slate-800">
// //                 {filteredUsers.length === 0 ? (
// //                   <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-500">{loading ? "Memuat..." : "Tidak ada data"}</td></tr>
// //                 ) : (
// //                   filteredUsers.map((user) => (
// //                     <tr key={user.id} className="hover:bg-slate-800/50 transition">
// //                       <td className="px-6 py-4 font-medium text-indigo-400">{user.id}</td>
// //                       <td className="px-6 py-4 bg-slate-900/30 text-xs text-slate-500">klik untuk edit</td>
// //                       <td className="px-6 py-4">
// //                         <div className="flex flex-col">
// //                           {renderCell(user, "name", user.name || user.id)}
// //                           {user.email && <span className="text-xs text-slate-500">{renderCell(user, "email", user.email)}</span>}
// //                         </div>
// //                       </td>
// //                       <td className="px-6 py-4">
// //                         <div className="flex flex-col">
// //                           {renderCell(user, "createdAt", user.createdAt)}
// //                           <span className="text-xs text-slate-500">{renderCell(user, "createdAtISO", user.createdAtISO)}</span>
// //                         </div>
// //                       </td>
// //                       <td className="px-6 py-4">
// //                         {renderCell(user, "isLocked", user.isLocked)}
// //                         {pinError && <p className="text-xs text-red-400 mt-1">{pinError}</p>}
// //                       </td>
// //                       <td className="px-6 py-4">
// //                         <button onClick={() => toggleLock(user)} disabled={!!editingCell} className="text-xs text-indigo-400 hover:text-indigo-300 mr-3">
// //                           {user.isLocked ? "Unlock" : "Lock"}
// //                         </button>
// //                         <button onClick={() => confirmDelete(user)} disabled={isDeleting === user.id} className="text-xs text-red-400 hover:text-red-300">
// //                           Hapus
// //                         </button>
// //                       </td>
// //                     </tr>
// //                   ))
// //                 )}
// //               </tbody>
// //             </table>
// //           </div>
// //           <div className="border-t border-slate-800 bg-slate-950/50 px-6 py-3 text-xs text-slate-500">
// //             Menampilkan {filteredUsers.length} user
// //           </div>
// //         </div>
// //       </div>

// //       {/* Delete Modal */}
// //       {showDeleteModal && (
// //         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
// //           <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
// //             <h3 className="text-lg font-bold text-white mb-4">Hapus User?</h3>
// //             <p className="text-slate-400 mb-6 text-sm">Yakin hapus <span className="font-semibold text-white">{deleteTarget?.id}</span>?</p>
// //             <div className="flex gap-3">
// //               <button onClick={() => setShowDeleteModal(false)} disabled={isDeleting} className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700">Batal</button>
// //               <button onClick={performDelete} disabled={isDeleting} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50">Hapus</button>
// //             </div>
// //           </div>
// //         </div>
// //       )}
// //     </div>
// //   );
// // }















// // // import { useState, useEffect } from "react";
// // // import { ref, get, set, remove, database, onValue } from "../../lib/firebase";

// // // export default function AdminDashboard() {
// // //   const [users, setUsers] = useState([]);
// // //   const [loading, setLoading] = useState(true);
// // //   const [searchTerm, setSearchTerm] = useState("");
// // //   const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });
// // //   const [editingId, setEditingId] = useState(null); // ID yang sedang diedit lock-nya
// // //   const [pinInput, setPinInput] = useState("");
// // //   const [pinError, setPinError] = useState("");
// // //   const [isDeleting, setIsDeleting] = useState(null);
// // //   const [showDeleteModal, setShowDeleteModal] = useState(false);
// // //   const [deleteTarget, setDeleteTarget] = useState(null);

// // //   // Load semua data user dari Firebase
// // //   useEffect(() => {
// // //     const usersRef = ref(database, "users");
// // //     const unsubscribe = onValue(usersRef, (snapshot) => {
// // //       if (snapshot.exists()) {
// // //         const data = snapshot.val();
// // //         const usersList = Object.keys(data).map((key) => ({
// // //           id: key,
// // //           ...data[key],
// // //         }));
// // //         setUsers(usersList);
// // //       } else {
// // //         setUsers([]);
// // //       }
// // //       setLoading(false);
// // //     });

// // //     return () => unsubscribe();
// // //   }, []);

// // //   // Fungsi Format Tanggal WIB
// // //   const formatDateWIB = (dateString) => {
// // //     if (!dateString) return "-";
// // //     return dateString; 
// // //   };

// // //   // Fungsi Sort Data
// // //   const handleSort = (key) => {
// // //     let direction = "asc";
// // //     if (sortConfig.key === key && sortConfig.direction === "asc") {
// // //       direction = "desc";
// // //     }
// // //     setSortConfig({ key, direction });
// // //   };

// // //   const sortedUsers = [...users].sort((a, b) => {
// // //     if (sortConfig.key === "createdAtISO") {
// // //       return sortConfig.direction === "asc" 
// // //         ? a.createdAtISO.localeCompare(b.createdAtISO)
// // //         : b.createdAtISO.localeCompare(a.createdAtISO);
// // //     }
// // //     if (sortConfig.key === "id") {
// // //       return sortConfig.direction === "asc"
// // //         ? a.id.localeCompare(b.id)
// // //         : b.id.localeCompare(a.id);
// // //     }
// // //     return 0;
// // //   });

// // //   // Filter berdasarkan Search
// // //   const filteredUsersaa = sortedUsers.filter((user) => {
// // //     const term = searchTerm.toLowerCase();
// // //     return (
// // //       user.id.toLowerCase().includes(term) ||
// // //       (user.name && user.name.toLowerCase().includes(term)) ||
// // //       (user.email && user.email.toLowerCase().includes(term))
// // //     );
// // //   });

// // //     // Helper: Cek apakah ada string di dalam objek (nested) yang cocok dengan search term
// // //   const matchesSearch = (obj, term) => {
// // //     if (!obj) return false;
    
// // //     // Jika obj adalah string/number/boolean, cek langsung
// // //     if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
// // //       return String(obj).toLowerCase().includes(term);
// // //     }

// // //     // Jika obj adalah array, cek setiap item
// // //     if (Array.isArray(obj)) {
// // //       return obj.some(item => matchesSearch(item, term));
// // //     }

// // //     // Jika obj adalah object, cek setiap value
// // //     if (typeof obj === "object") {
// // //       return Object.values(obj).some(value => matchesSearch(value, term));

// // //        // Skip field yang di-exclude
// // //         if (excludeKeys.includes(key.toLowerCase())) return false;
// // //         return matchesSearch(value, term, excludeKeys);
// // //     }

// // //     return false;
// // //   };

// // //   // Filter berdasarkan Search (Universal Search)
// // //   const filteredUsers = sortedUsers.filter((user) => {
// // //     const term = searchTerm.toLowerCase();
// // //     if (!term) return true; // Jika kosong, tampilkan semua

// // //     // Cari di ID user
// // //     if (user.id.toLowerCase().includes(term)) return true;

// // //     // Cari di SEMUA data user lainnya secara rekursif
// // //     // Ini akan mengecek name, email, createdAt, status, lockSettings, dll.
// // //     return matchesSearch(user, term);
// // //   });

  
// // //   // Toggle Lock (Edit)
// // //   const toggleLock = async (user) => {
// // //     if (editingId !== user.id) {
// // //       setEditingId(user.id);
// // //       setPinInput("");
// // //       setPinError("");
// // //       return;
// // //     }

// // //     // Jika user sudah ada PIN dan ingin di-unlock
// // //     if (user.isLocked) {
// // //       const pairKey = user.chatPairKey || ""; // Asumsi ada field chatPairKey
// // //       if (!pairKey) {
// // //         setPinError("Tidak ada pasangan chat untuk di-unlock.");
// // //         return;
// // //       }
      
// // //       // Prompt PIN untuk konfirmasi unlock
// // //       const pin = prompt("Masukkan PIN untuk mengaktifkan kembali chat:");
// // //       if (pin === user.pin) {
// // //         await updateLockStatus(user.id, false, null);
// // //       } else {
// // //         setPinError("PIN salah!");
// // //       }
// // //       setEditingId(null);
// // //       return;
// // //     }

// // //     // Jika ingin activate lock
// // //     if (!pinInput) {
// // //       setPinError("Masukkan PIN 4-6 digit untuk mengaktifkan lock.");
// // //       return;
// // //     }
// // //     if (pinInput.length < 4 || pinInput.length > 6) {
// // //       setPinError("PIN harus 4-6 digit.");
// // //       return;
// // //     }

// // //     await updateLockStatus(user.id, true, pinInput);
// // //     setEditingId(null);
// // //     setPinInput("");
// // //     setPinError("");
// // //   };

// // //   const updateLockStatus = async (userId, isLocked, pin) => {
// // //     try {
// // //       // 1. Update data user
// // //       await set(ref(database, `users/${userId}`), {
// // //         ...users.find((u) => u.id === userId),
// // //         isLocked: isLocked,
// // //         pin: isLocked ? pin : null,
// // //         updatedAt: new Date().toISOString(),
// // //       });

// // //       // 2. Update chat-pair jika ada
// // //       // (Logika ini akan dihandle di API atau real-time update Firebase)
// // //       // Untuk simplifikasi, kita asumsikan update user cukup, 
// // //       // karena chat-pair akan read lockSettings dari user data atau kita update juga di chat-pairs
      
// // //       const pairKey = users.find((u) => u.id === userId)?.chatPairKey;
// // //       if (pairKey) {
// // //         const pairRef = ref(database, `chat-pairs/${pairKey}`);
// // //         const pairSnap = await get(pairRef);
// // //         if (pairSnap.exists()) {
// // //           const currentPair = pairSnap.val();
// // //           const updatedLocks = { ...currentPair.lockSettings };
          
// // //           if (isLocked) {
// // //             updatedLocks[userId] = { isLocked: true, pin: pin };
// // //           } else {
// // //             updatedLocks[userId] = { isLocked: false, pin: null };
// // //           }

// // //           await set(pairRef, {
// // //             ...currentPair,
// // //             lockSettings: updatedLocks,
// // //             updatedAt: new Date().toISOString(),
// // //           });
// // //         }
// // //       }
      
// // //       // Data akan otomatis refresh karena onValue di useEffect
// // //     } catch (err) {
// // //       console.error("Error updating lock:", err);
// // //       setPinError("Gagal update lock.");
// // //     }
// // //   };

// // //   // Delete User
// // //   const confirmDelete = (user) => {
// // //     setDeleteTarget(user);
// // //     setShowDeleteModal(true);
// // //   };

// // //   const performDelete = async () => {
// // //     if (!deleteTarget) return;
// // //     setIsDeleting(deleteTarget.id);

// // //     try {
// // //       // 1. Hapus user
// // //       await remove(ref(database, `users/${deleteTarget.id}`));

// // //       // 2. Hapus dari chat-pair (jika ada)
// // //       const pairKey = deleteTarget.chatPairKey;
// // //       if (pairKey) {
// // //         const pairRef = ref(database, `chat-pairs/${pairKey}`);
// // //         const pairSnap = await get(pairRef);
// // //         if (pairSnap.exists()) {
// // //           const currentPair = pairSnap.val();
// // //           const partnerId = currentPair.userA === deleteTarget.id ? currentPair.userB : currentPair.userA;
          
// // //           // Cek apakah partner juga sudah dihapus atau belum
// // //           const partnerSnap = await get(ref(database, `users/${partnerId}`));
// // //           if (!partnerSnap.exists()) {
// // //             // Jika partner sudah dihapus, hapus juga pair-nya
// // //             await remove(pairRef);
// // //           } else {
// // //             // Jika partner masih ada, hapus referensi dari pair
// // //             const updatedLocks = { ...currentPair.lockSettings };
// // //             delete updatedLocks[deleteTarget.id];
// // //             await set(pairRef, {
// // //               ...currentPair,
// // //               lockSettings: updatedLocks,
// // //             });
// // //           }
          
// // //           // Hapus dari index
// // //           await remove(ref(database, `user-chat-index/${partnerId}/${deleteTarget.id}`));
// // //         }
// // //       }
      
// // //       // Hapus dari index user
// // //       await remove(ref(database, `user-chat-index/${deleteTarget.id}`));
      
// // //       setShowDeleteModal(false);
// // //       setDeleteTarget(null);
// // //     } catch (err) {
// // //       console.error("Error deleting:", err);
// // //       alert("Gagal menghapus user.");
// // //     } finally {
// // //       setIsDeleting(null);
// // //     }
// // //   };

// // //   // Helper: Cek apakah user sedang diedit
// // //   const isEditing = (id) => editingId === id;

// // //   return (
// // //     <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
// // //       <div className="mx-auto w-full max-w-7xl">
// // //         {/* Header */}
// // //         <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
// // //           <div>
// // //             <h1 className="text-3xl font-bold tracking-tight">👥 Admin User Dashboard</h1>
// // //             <p className="mt-1 text-slate-400">Kelola user, set lock, dan hapus data.</p>
// // //           </div>
          
// // //           {/* Search Bar */}
// // //           <div className="relative w-full max-w-sm">
// // //             <input
// // //               type="text"
// // //               value={searchTerm}
// // //               onChange={(e) => setSearchTerm(e.target.value)}
// // //               placeholder="Cari user, nama, email..."
// // //               className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 pl-10 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
// // //             />
// // //             <svg className="absolute left-3 top-3.5 h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
// // //               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
// // //             </svg>
// // //           </div>
// // //         </div>

// // //         {/* Table Container */}
// // //         <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl backdrop-blur">
// // //           <div className="overflow-x-auto">
// // //             <table className="w-full text-left">
// // //               <thead className="border-b border-slate-800 bg-slate-950/50">
// // //                 <tr>
// // //                   <th 
// // //                     className="cursor-pointer px-6 py-4 text-sm font-semibold text-slate-300 hover:text-indigo-400"
// // //                     onClick={() => handleSort("id")}
// // //                   >
// // //                     <div className="flex items-center gap-1">
// // //                       User ID
// // //                       {sortConfig.key === "id" && (
// // //                         <span className="text-xs">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
// // //                       )}
// // //                     </div>
// // //                   </th>
// // //                   <th className="px-6 py-4 text-sm font-semibold text-slate-300">Nama / Email</th>
// // //                   <th 
// // //                     className="cursor-pointer px-6 py-4 text-sm font-semibold text-slate-300 hover:text-indigo-400"
// // //                     onClick={() => handleSort("createdAt")}
// // //                   >
// // //                     <div className="flex items-center gap-1">
// // //                       Dibuat Pada
// // //                       {sortConfig.key === "createdAt" && (
// // //                         <span className="text-xs">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
// // //                       )}
// // //                     </div>
// // //                   </th>
// // //                   <th className="px-6 py-4 text-sm font-semibold text-slate-300">Status Lock</th>
// // //                   <th className="px-6 py-4 text-sm font-semibold text-slate-300">Aksi</th>
// // //                 </tr>
// // //               </thead>
// // //               <tbody className="divide-y divide-slate-800">
// // //                 {filteredUsers.length === 0 ? (
// // //                   <tr>
// // //                     <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
// // //                       {loading ? "Memuat data..." : "Tidak ada data user."}
// // //                     </td>
// // //                   </tr>
// // //                 ) : (
// // //                   filteredUsers.map((user) => (
// // //                     <tr key={user.id} className="hover:bg-slate-800/50 transition">
// // //                       {/* User ID Column */}
// // //                       <td className="px-6 py-4 font-medium text-indigo-400">{user.id}</td>

// // //                       {/* Nama/Email Column */}
// // //                       <td className="px-6 py-4">
// // //                         <div>
// // //                           <p className="text-slate-200">{user.name || user.id}</p>
// // //                           {user.email && <p className="text-xs text-slate-500">{user.email}</p>}
// // //                         </div>
// // //                       </td>

// // //                       {/* Created Date Column */}
// // //                       <td className="px-6 py-4 text-sm text-slate-400">
// // //                         {formatDateWIB(user.createdAt)}
// // //                       </td>

// // //                       {/* Lock Status Column */}
// // //                       <td className="px-6 py-4">
// // //                         {isEditing(user.id) ? (
// // //                           <div className="flex items-center gap-2">
// // //                             <input
// // //                               type="password"
// // //                               value={pinInput}
// // //                               onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
// // //                               placeholder="PIN 4-6 digit"
// // //                               maxLength="6"
// // //                               autoFocus
// // //                               className="w-24 rounded-lg border border-slate-600 bg-slate-950 px-3 py-1 text-sm text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
// // //                             />
// // //                             <button
// // //                               onClick={() => toggleLock(user)}
// // //                               disabled={!pinInput || pinInput.length < 4}
// // //                               className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
// // //                             >
// // //                               Set Lock
// // //                             </button>
// // //                             <button
// // //                               onClick={() => { setEditingId(null); setPinInput(""); setPinError(""); }}
// // //                               className="rounded-lg border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700"
// // //                             >
// // //                               Batal
// // //                             </button>
// // //                           </div>
// // //                         ) : (
// // //                           <div className="flex items-center gap-2">
// // //                             {user.isLocked ? (
// // //                               <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 border border-red-500/20">
// // //                                 <span className="relative flex h-2 w-2">
// // //                                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
// // //                                   <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
// // //                                 </span>
// // //                                 Terkunci
// // //                               </span>
// // //                             ) : (
// // //                               <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
// // //                                 <span className="relative flex h-2 w-2">
// // //                                   <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
// // //                                 </span>
// // //                                 Terbuka
// // //                               </span>
// // //                             )}
// // //                             <button
// // //                               onClick={() => toggleLock(user)}
// // //                               className="text-xs text-indigo-400 hover:text-indigo-300 underline"
// // //                             >
// // //                               {user.isLocked ? "Ubah PIN" : "Aktifkan Lock"}
// // //                             </button>
// // //                           </div>
// // //                         )}
// // //                         {pinError && (
// // //                           <p className="mt-1 text-xs text-red-400">{pinError}</p>
// // //                         )}
// // //                       </td>

// // //                       {/* Actions Column */}
// // //                       <td className="px-6 py-4">
// // //                         <div className="flex gap-2">
// // //                           <button
// // //                             onClick={() => toggleLock(user)}
// // //                             disabled={isEditing(user.id)}
// // //                             className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
// // //                             title="Edit Lock"
// // //                           >
// // //                             {isEditing(user.id) ? "Editing..." : "Edit"}
// // //                           </button>
// // //                           <button
// // //                             onClick={() => confirmDelete(user)}
// // //                             disabled={isDeleting === user.id}
// // //                             className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
// // //                           >
// // //                             {isDeleting === user.id ? "..." : "Hapus"}
// // //                           </button>
// // //                         </div>
// // //                       </td>
// // //                     </tr>
// // //                   ))
// // //                 )}
// // //               </tbody>
// // //             </table>
// // //           </div>
          
// // //           {/* Footer Info */}
// // //           <div className="border-t border-slate-800 bg-slate-950/50 px-6 py-3 text-xs text-slate-500">
// // //             Menampilkan <span className="text-slate-300 font-medium">{filteredUsers.length}</span> user
// // //           </div>
// // //         </div>
// // //       </div>

// // //       {/* Delete Confirmation Modal */}
// // //       {showDeleteModal && (
// // //         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
// // //           <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
// // //             <div className="mb-4 flex items-center gap-3">
// // //               <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
// // //                 <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
// // //                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
// // //                 </svg>
// // //               </div>
// // //               <h3 className="text-lg font-bold text-white">Hapus User?</h3>
// // //             </div>
// // //             <p className="mb-6 text-sm text-slate-400">
// // //               Apakah Anda yakin ingin menghapus user <span className="font-semibold text-white">{deleteTarget?.id}</span>?
// // //               <br />
// // //               <span className="text-xs">Tindakan ini akan menghapus chat pair terkait juga.</span>
// // //             </p>
// // //             <div className="flex gap-3">
// // //               <button
// // //                 onClick={() => setShowDeleteModal(false)}
// // //                 disabled={isDeleting}
// // //                 className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition"
// // //               >
// // //                 Batal
// // //               </button>
// // //               <button
// // //                 onClick={performDelete}
// // //                 disabled={isDeleting}
// // //                 className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition disabled:opacity-50"
// // //               >
// // //                 {isDeleting ? "Menghapus..." : "Hapus Permanen"}
// // //               </button>
// // //             </div>
// // //           </div>
// // //         </div>
// // //       )}
// // //     </div>
// // //   );
// // // }
