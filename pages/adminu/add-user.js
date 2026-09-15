"use client";
import { useState } from "react";
import { ref, get, database, } from "../../lib/firebase";

export default function AddUserPage() {
  const [userA, setUserA] = useState("");
  const [userB, setUserB] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [checkResult, setCheckResult] = useState(null);

  const checkUserExists = async (userId) => {
    const cleanId = String(userId).trim().toLowerCase();
    if (!cleanId) return { id: cleanId, exists: false };

    const snapshot = await get(ref(database, `users/${cleanId}`));
    return { id: cleanId, exists: snapshot.exists() };
  };

  const validateUsers = async () => {
    setError("");
    setSuccess("");
    setCheckResult(null);

    const cleanA = userA.trim().toLowerCase();
    const cleanB = userB.trim().toLowerCase();

    if (!cleanA || !cleanB) {
      setError("Mohon isi kedua nama pengguna.");
      return false;
    }

    if (cleanA === cleanB) {
      setError("Pengguna A dan B tidak boleh sama.");
      return false;
    }

    setChecking(true);

    try {
      const [resultA, resultB] = await Promise.all([
        checkUserExists(cleanA),
        checkUserExists(cleanB),
      ]);

      setCheckResult({ userA: resultA, userB: resultB });

      if (!resultA.exists) {
        setError(`Pengguna "${cleanA}" belum terdaftar di database.`);
        return false;
      }

      if (!resultB.exists) {
        setError(`Pengguna "${cleanB}" belum terdaftar di database.`);
        return false;
      }

      return true;
    } catch (err) {
      setError("Gagal memeriksa pengguna ke database.");
      console.error(err);
      return false;
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // const isValid = await validateUsers();
    // if (!isValid) return;

    // setLoading(true);
     // ✅ Validasi manual saja, jangan panggil validateUsers lagi
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
  
    // ✅ Cek apakah validasi sudah berhasil sebelumnya (checkResult)
    if (!checkResult || !checkResult.userA.exists || !checkResult.userB.exists) {
      setError("Silakan validasi pengguna terlebih dahulu.");
      return;
    }
  
    setLoading(true);

    try {
      const response = await fetch("/api/add-chat-pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userA: userA.trim(),
          userB: userB.trim(),
          createdBy: "admin",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Gagal menyimpan pasangan chat.");
      }

      setSuccess(`Pair "${data.key}" berhasil dibuat/updated. ${data.data.updatedAt}`);
      setUserA("");
      setUserB("");
      setCheckResult(null);
    } catch (err) {
      setError(err.message || "Terjadi kesalahan saat menyimpan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-xl">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur sm:p-8">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-300">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Admin Add Chat Pair</h1>
              <p className="mt-1 text-sm text-slate-400">
                Sekali tambah, dua arah aktif: <span className="text-indigo-300">userA ↔ userB</span>
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                User Pengirim (A)
              </label>
              <input
                value={userA}
                onChange={(e) => setUserA(e.target.value)}
                placeholder="contoh: user1"
                disabled={loading || checking}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                User Penerima (B)
              </label>
              <input
                value={userB}
                onChange={(e) => setUserB(e.target.value)}
                placeholder="contoh: user2"
                disabled={loading || checking}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={validateUsers}
                disabled={loading || checking}
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-60"
              >
                {checking ? "Memeriksa..." : "Validasi User"}
              </button>

              <button
                type="submit"
                disabled={loading || checking}
                className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
              >
                {loading ? "Menyimpan..." : "Simpan Pair"}
              </button>
            </div>
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
        </div>
      </div>
    </div>
  );
}
