import { useState } from "react";
import { ref, get, database } from "../../lib/firebase";

import Link from "next/link";

export default function AddUserPage() {
  const [userA, setUserA] = useState("");
  const [userB, setUserB] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [checkResult, setCheckResult] = useState(null);

   // Lock state
  const [lockUserA, setLockUserA] = useState(false);
  const [lockUserB, setLockUserB] = useState(false);
  
  // PIN state
   const [pinUserA, setPinUserA] = useState("");
  const [pinUserB, setPinUserB] = useState("");
   const [pinA, setPinA] = useState("");
  const [pinB, setPinB] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinForUser, setPinForUser] = useState("");
  const [tempPinA, setTempPinA] = useState("");
  const [tempPinB, setTempPinB] = useState("");

  const checkUserExists = async (userId) => {
    const cleanId = String(userId).trim().toLowerCase();
    if (!cleanId) {
      console.log(`[DEBUG] User ID kosong: ${userId}`);
      return { id: cleanId, exists: false };
    }

    try {
      const userRef = ref(database, `users/${cleanId}`);
      console.log(`[DEBUG] Checking user: ${cleanId}, path: users/${cleanId}`);
      
      const snapshot = await get(userRef);
      console.log(`[DEBUG] Result for ${cleanId}:`, snapshot.exists() ? "FOUND" : "NOT FOUND");
      
      return { id: cleanId, exists: snapshot.exists() };
    } catch (err) {
      console.error("[DEBUG] Error checking user:", err);
      return { id: cleanId, exists: false };
    }
  };

  const validateUsers = async () => {
    setError("");
    setSuccess("");
    setCheckResult(null);

    const cleanA = userA.trim().toLowerCase();
    const cleanB = userB.trim().toLowerCase();

    console.log(`[DEBUG] Validating: A=${cleanA}, B=${cleanB}`);

    if (!cleanA || !cleanB) {
      setError("Mohon isi kedua nama pengguna.");
      return;
    }

    if (cleanA === cleanB) {
      setError("Pengguna A dan B tidak boleh sama.");
      return;
    }

    setChecking(true);

    try {
      const [resultA, resultB] = await Promise.all([
        checkUserExists(cleanA),
        checkUserExists(cleanB),
      ]);

      console.log("[DEBUG] Result A:", resultA);
      console.log("[DEBUG] Result B:", resultB);

      setCheckResult({ userA: resultA, userB: resultB });

      if (!resultA.exists) {
        setError(`Pengguna "${cleanA}" belum terdaftar di database.\n\n⚠️ Pastikan data user sudah ada di Firebase Realtime Database (collection: users/${cleanA})`);
        return;
      }

      if (!resultB.exists) {
        setError(`Pengguna "${cleanB}" belum terdaftar di database.\n\n⚠️ Pastikan data user sudah ada di Firebase Realtime Database (collection: users/${cleanB})`);
        return;
      }

      setError("");
      setSuccess(`✅ Validasi berhasil! User A: ${cleanA}, User B: ${cleanB}`);
    } catch (err) {
      console.error("[DEBUG] Validation error:", err);
      setError("Gagal memeriksa pengguna ke database.\n\n⚠️ Cek console browser untuk detail error.");
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cleanA = userA.trim().toLowerCase();
    const cleanB = userB.trim().toLowerCase();

    if (!cleanA || !cleanB) {
      setError("Mohon isi kedua nama pengguna.");
      return;
    }

    if (cleanA === cleanB) {
      setError("Pengguna A dan B tidak boleh sama.");
      return;
    }

    // Collect PINs if locked
    const pinData = {};
    if (lockUserA) {
      if (!pinUserA) {
        setError("PIN untuk User A wajib diisi.");
        return;
      }
      pinData[cleanA] = pinUserA;
    }
    if (lockUserB) {
      if (!pinUserB) {
        setError("PIN untuk User B wajib diisi.");
        return;
      }
      pinData[cleanB] = pinUserB;
    }

    // if (checkResult || checkResult.userA.exists || checkResult.userB.exists) {
    //   setError("Silakan validasi pengguna terlebih dahulu.");
    //   return;
    // }

    setLoading(true);

    try {
      console.log("[DEBUG] Submitting to API...");
      const response = await fetch("/api/add-chat-pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userA: cleanA,
          userB: cleanB,
          createdBy: "admin",
          lockUserA,
          lockUserB,
          pinData,
        }),
      });

      const data = await response.json();
      console.log("[DEBUG] API Response:", data);

      if (!response.ok) {
        throw new Error(data.message || "Gagal menyimpan pasangan chat.");
      }

      setSuccess(`✅ Pair "${data.key}" berhasil dibuat. ${data.data.updatedAt}`);
      setUserA("");
      setUserB("");
      setLockUserA(false);
      setLockUserB(false);
      setPinA("");
      setPinB("");
      setPinUserA("");
      setPinUserB("");
      setCheckResult(null);
    } catch (err) {
      console.error("[DEBUG] Submit error:", err);
      setError(err.message || "Terjadi kesalahan saat menyimpan.");
    } finally {
      setLoading(false);
    }
  };

  const handleLockToggle = (user, checked) => {
    if (checked) {
      setShowPinModal(true);
      setPinForUser(user);
      if (user === "userA") {
        setTempPinA(pinA);
      } else {
        setTempPinB(pinB);
      }
    } else {
      if (user === "userA") {
        setLockUserA(false);
        setPinA("");
      } else {
        setLockUserB(false);
        setPinB("");
      }
    }
  };

  const confirmPin = () => {
    if (pinForUser === "userA") {
      setPinA(tempPinA);
      setLockUserA(true);
    } else {
      setPinB(tempPinB);
      setLockUserB(true);
    }
    setShowPinModal(false);
  };

  const cancelPin = () => {
    if (pinForUser === "userA") {
      setLockUserA(false);
    } else {
      setLockUserB(false);
    }
    setShowPinModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-300">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Admin Add Chat Pair</h1>
              <p className="mt-1 text-sm text-slate-400">
                Sekali tambah, dua arah aktif: <span className="text-indigo-300">userA ↔ userB</span>
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 whitespace-pre-line">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              {success}
            </div>
          )}

          {checkResult && (
            <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-sm">
              <p className="mb-2 font-semibold text-slate-200">Hasil Validasi</p>
              <div className="space-y-1">
                <p>
                  <span className="text-slate-400">User A:</span>{" "}
                  <span className={checkResult.userA.exists ? "text-emerald-300" : "text-red-300"}>
                    {checkResult.userA.id} {checkResult.userA.exists ? "✓ tersedia" : "✗ tidak ada"}
                  </span>
                </p>
                <p>
                  <span className="text-slate-400">User B:</span>{" "}
                  <span className={checkResult.userB.exists ? "text-emerald-300" : "text-red-300"}>
                    {checkResult.userB.id} {checkResult.userB.exists ? "✓ tersedia" : "✗ tidak ada"}
                  </span>
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* User A Section */}
            <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="mb-3 font-semibold text-indigo-300">👤 User Pengirim (A)</h3>
              
              <div className="mb-3">
                <label className="block text-sm font-medium text-slate-300">
                  Nama User
                </label>
                <input
                  value={userA}
                  onChange={(e) => setUserA(e.target.value)}
                  placeholder="contoh: user1"
                  disabled={loading || checking}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
                />
              </div>

              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="lockA"
                  checked={lockUserA}
                  onChange={(e) => setLockUserA(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                />
                <label htmlFor="lockA" className="text-sm font-medium text-slate-300 cursor-pointer">
                  🔒 Aktifkan PIN Lock untuk User A
                </label>
              </div>

              {lockUserA && (
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Set PIN (4-6 digit)
                  </label>
                  <input
                    type="password"
                    value={pinUserA}
                    onChange={(e) => setPinUserA(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Masukkan PIN 4-6 digit"
                    maxLength="6"
                    disabled={loading || checking}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 disabled:opacity-60"
                  />
                  <p className="mt-1 text-xs text-slate-400">PIN: {pinUserA || "---"}</p>
                </div>
              )}
            </div>

            {/* User B Section */}
            <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="mb-3 font-semibold text-emerald-300">👤 User Penerima (B)</h3>
              
              <div className="mb-3">
                <label className="block text-sm font-medium text-slate-300">
                  Nama User
                </label>
                <input
                  value={userB}
                  onChange={(e) => setUserB(e.target.value)}
                  placeholder="contoh: user2"
                  disabled={loading || checking}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-60"
                />
              </div>

              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="lockB"
                  checked={lockUserB}
                  onChange={(e) => setLockUserB(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                />
                <label htmlFor="lockB" className="text-sm font-medium text-slate-300 cursor-pointer">
                  🔒 Aktifkan PIN Lock untuk User B
                </label>
              </div>

              {lockUserB && (
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Set PIN (4-6 digit)
                  </label>
                  <input
                    type="password"
                    value={pinUserB}
                    onChange={(e) => setPinUserB(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Masukkan PIN 4-6 digit"
                    maxLength="6"
                    disabled={loading || checking}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 disabled:opacity-60"
                  />
                  <p className="mt-1 text-xs text-slate-400">PIN: {pinUserB || "---"}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={validateUsers}
                disabled={loading || checking}
                className="flex-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-60"
              >
                {checking ? "Memeriksa..." : "✓ Validasi User"}
              </button>

              <button
                type="submit"
                disabled={loading || checking}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
              >
                {loading ? "Menyimpan..." : "💾 Simpan Pair"}
              </button>
            </div>
{/*
            <div>
              <label className="block text-sm font-medium text-slate-300">
                 <input
                  type="checkbox"
                  checked={lockUserA}
                  onChange={(e) => handleLockToggle("userA", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                />
                 <span className="flex items-center gap-2">
                  User Pengirim (A)
                  {lockUserA && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Terkunci
                    </span>
                  )}
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  value={userA}
                  onChange={(e) => setUserA(e.target.value)}
                  placeholder="contoh: user12"
                  disabled={loading || checking}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
                />
                {lockUserA && (
                    <button
                      type="button"
                      onClick={() => {
                        setLockUserA(false);
                        setPinA("");
                      }}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                    >
                      UnLock
                    </button>
                  )}
              </div>
            </div>
*/}
            {/* PIN Input A */}
{/*   {lockUserA && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.5 13.5l-2.243-2.243A6 6 0 016.5 5.743 6 6 0 0110.5 5.743 6 6 0 0115 7z" />
                    </svg>
                    PIN untuk User A ({userA || "user12"})
                  </span>
                </label>
                <input
                  type="password"
                  value={pinA}
                  onChange={(e) => setPinA(e.target.value)}
                  placeholder="Masukkan PIN (4-6 digit)"
                  maxLength={6}
                  className="w-full rounded-xl border border-emerald-700 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300">
                <input
                  type="checkbox"
                  checked={lockUserB}
                  onChange={(e) => handleLockToggle("userB", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="flex items-center gap-2">
                  User Penerima (B)
                  {lockUserB && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Terkunci
                    </span>
                  )}
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  value={userB}
                  onChange={(e) => setUserB(e.target.value)}
                  placeholder="contoh: user2"
                  disabled={loading || checking}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
                />
                {lockUserB && (
                    <button
                      type="button"
                      onClick={() => {
                        setLockUserB(false);
                        setPinB("");
                      }}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                    >
                      UnLock
                    </button>
                  )}
                </div>
            </div>
*/}
            {/* PIN Input B */}
{/*       {lockUserB && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.5 13.5l-2.243-2.243A6 6 0 016.5 5.743 6 6 0 0110.5 5.743 6 6 0 0115 7z" />
                    </svg>
                    PIN untuk User B ({userB || "user2"})
                  </span>
                </label>
                <input
                  type="password"
                  value={pinB}
                  onChange={(e) => setPinB(e.target.value)}
                  placeholder="Masukkan PIN (4-6 digit)"
                  maxLength={6}
                  className="w-full rounded-xl border border-emerald-700 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={validateUsers}
                disabled={loading || checking}
                className="flex-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-60"
              >
                {checking ? "Memeriksa..." : "Validasi User"}
              </button>

              <button
                type="submit"
                disabled={loading || checking}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
              >
                {loading ? "Menyimpan..." : "Simpan Pair"}
              </button>
            </div>*/}
          </form>

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-400">
            <p className="font-semibold text-slate-300">Format Data Tersimpan</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>userA / userB</li>
              <li>createdAt WIB (hari, tanggal, jam, menit, detik)</li>
              <li>createdBy: admin</li>
              <li>status: active</li>
              <li>directions dua arah otomatis</li>
            </ul>
          </div>
           {/* Tombol di bawah card */}
            <div className="mt-4 flex justify-end">
              <Link
                href="/adminu/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M10.707 2.293a1 1 0 0 0-1.414 0l-7 7A1 1 0 0 0 3 11h1v5a2 2 0 0 0 2 2h2v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4h2a2 2 0 0 0 2-2v-5h1a1 1 0 0 0 .707-1.707l-7-7Z" />
                </svg>
                Kembali ke Dashboard
              </Link>
            </div>
        </div>
      </div>
    </div>
  );
}
// "use client";
// import { useState } from "react";
// import { ref, get, database } from "../../lib/firebase";

// export default function AddUserPage() {
//   const [userA, setUserA] = useState("");
//   const [userB, setUserB] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [checking, setChecking] = useState(false);
//   const [error, setError] = useState("");
//   const [success, setSuccess] = useState("");
//   const [checkResult, setCheckResult] = useState(null);

//   const checkUserExists = async (userId) => {
//     const cleanId = String(userId).trim().toLowerCase();
//     if (!cleanId) return { id: cleanId, exists: false };

//      try {
//       const snapshot = await get(ref(database, `users/${cleanId}`));
//       return { id: cleanId, exists: snapshot.exists() };
//     } catch (err) {
//       console.error("Error checking user:", err);
//       return { id: cleanId, exists: false };
//     }

//     // const snapshot = await get(ref(database, `users/${cleanId}`));
//     // return { id: cleanId, exists: snapshot.exists() };
//   };

//   const validateUsers = async () => {
//     setError("");
//     setSuccess("");
//     setCheckResult(null);

//     const cleanA = userA.trim().toLowerCase();
//     const cleanB = userB.trim().toLowerCase();

//     if (!cleanA || !cleanB) {
//       setError("Mohon isi kedua nama pengguna.");
//       return;
//     }

//     if (cleanA === cleanB) {
//       setError("Pengguna A dan B tidak boleh sama.");
//       return;
//     }

//     setChecking(true);

//     try {
//       const [resultA, resultB] = await Promise.all([
//         checkUserExists(cleanA),
//         checkUserExists(cleanB),
//       ]);

//       setCheckResult({ userA: resultA, userB: resultB });

//       if (!resultA.exists) {
//         setError(`Pengguna "${cleanA}" belum terdaftar di database.`);
//         return;
//       }

//       if (!resultB.exists) {
//         setError(`Pengguna "${cleanB}" belum terdaftar di database.`);
//         return;
//       }

//     } catch (err) {
//       setError("Gagal memeriksa pengguna ke database.");
//       console.error(err);
//     } finally {
//       setChecking(false);
//     }
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError("");
//     setSuccess("");

//     // const isValid = await validateUsers();
//     // if (!isValid) return;

//     // setLoading(true);
//      // ✅ Validasi manual saja, jangan panggil validateUsers lagi
//     const cleanA = userA.trim().toLowerCase();
//     const cleanB = userB.trim().toLowerCase();
  
//     if (!cleanA || !cleanB) {
//       setError("Mohon isi kedua nama pengguna.");
//       return;
//     }
  
//     if (cleanA === cleanB) {
//       setError("Pengguna A dan B tidak boleh sama.");
//       return;
//     }
  
//     // ✅ Cek apakah validasi sudah berhasil sebelumnya (checkResult)
//     if (!checkResult || !checkResult.userA.exists || !checkResult.userB.exists) {
//       setError("Silakan validasi pengguna terlebih dahulu.");
//       return;
//     }
  
//     setLoading(true);

//     try {
//       const response = await fetch("/api/add-chat-pair", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           userA: userA.trim(),
//           userB: userB.trim(),
//           createdBy: "admin",
//         }),
//       });

//       const data = await response.json();

//       if (!response.ok) {
//         throw new Error(data.message || "Gagal menyimpan pasangan chat.");
//       }

//       setSuccess(`Pair "${data.key}" berhasil dibuat/updated. ${data.data.updatedAt}`);
//       setUserA("");
//       setUserB("");
//       setCheckResult(null);
//     } catch (err) {
//       setError(err.message || "Terjadi kesalahan saat menyimpan.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-10 sm:px-6">
//       <div className="mx-auto w-full max-w-xl">
//         <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur sm:p-8">
//           <div className="mb-6 flex items-center gap-4">
//             <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-300">
//               <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
//                 <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
//               </svg>
//             </div>
//             <div>
//               <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Admin Add Chat Pair</h1>
//               <p className="mt-1 text-sm text-slate-400">
//                 Sekali tambah, dua arah aktif: <span className="text-indigo-300">userA ↔ userB</span>
//               </p>
//             </div>
//           </div>

//           {error && (
//             <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
//               {error}
//             </div>
//           )}

//           {success && (
//             <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
//               {success}
//             </div>
//           )}

//           {checkResult && (
//             <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-sm">
//               <p className="mb-2 font-semibold text-slate-200">Hasil Validasi</p>
//               <div className="space-y-1">
//                 <p>
//                   <span className="text-slate-400">User A:</span>{" "}
//                   <span className={checkResult.userA.exists ? "text-emerald-300" : "text-red-300"}>
//                     {checkResult.userA.id} {checkResult.userA.exists ? "✓ tersedia" : "✗ tidak ada"}
//                   </span>
//                 </p>
//                 <p>
//                   <span className="text-slate-400">User B:</span>{" "}
//                   <span className={checkResult.userB.exists ? "text-emerald-300" : "text-red-300"}>
//                     {checkResult.userB.id} {checkResult.userB.exists ? "✓ tersedia" : "✗ tidak ada"}
//                   </span>
//                 </p>
//               </div>
//             </div>
//           )}

//           <form onSubmit={handleSubmit} className="space-y-5">
//             <div>
//               <label className="mb-2 block text-sm font-medium text-slate-300">
//                 User Pengirim (A)
//               </label>
//               <input
//                 value={userA}
//                 onChange={(e) => setUserA(e.target.value)}
//                 placeholder="contoh: user1"
//                 disabled={loading || checking}
//                 className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
//               />
//             </div>

//             <div>
//               <label className="mb-2 block text-sm font-medium text-slate-300">
//                 User Penerima (B)
//               </label>
//               <input
//                 value={userB}
//                 onChange={(e) => setUserB(e.target.value)}
//                 placeholder="contoh: user2"
//                 disabled={loading || checking}
//                 className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
//               />
//             </div>

//             <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
//               <button
//                 type="button"
//                 onClick={validateUsers}
//                 disabled={loading || checking}
//                 className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-60"
//               >
//                 {checking ? "Memeriksa..." : "Validasi User"}
//               </button>

//               <button
//                 type="submit"
//                 disabled={loading || checking}
//                 className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
//               >
//                 {loading ? "Menyimpan..." : "Simpan Pair"}
//               </button>
//             </div>
//           </form>

//           <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-400">
//             <p className="font-semibold text-slate-300">Format Data Tersimpan</p>
//             <ul className="mt-2 space-y-1 list-disc list-inside">
//               <li>userA / userB</li>
//               <li>createdAt WIB (hari, tanggal, jam, menit, detik)</li>
//               <li>createdBy: admin</li>
//               <li>status: active</li>
//               <li>directions dua arah otomatis</li>
//             </ul>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
