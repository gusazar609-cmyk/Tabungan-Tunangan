// db.js - Penyimpanan data Tabungan Tunangan
const DB = (() => {
  const NAME = 'tabungan-tunangan', VER = 1;
  const STORES = ['profile', 'transactions', 'budget', 'checklist', 'settings'];
  let db = null;

  function open() {
    return new Promise((res, rej) => {
      if (db) return res(db);
      const r = indexedDB.open(NAME, VER);
      r.onupgradeneeded = e => {
        const d = e.target.result;
        STORES.forEach(s => {
          if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
        });
      };
      r.onsuccess = () => { db = r.result; res(db); };
      r.onerror = () => rej(r.error);
    });
  }

  async function tx(store, mode, fn) {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      let out;
      const req = fn(t.objectStore(store));
      if (req) req.onsuccess = () => { out = req.result; };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }

  const get = (s, id) => tx(s, 'readonly', o => o.get(id));
  const all = s => tx(s, 'readonly', o => o.getAll());
  const put = (s, v) => tx(s, 'readwrite', o => o.put(v));
  const del = (s, id) => tx(s, 'readwrite', o => o.delete(id));
  const clear = s => tx(s, 'readwrite', o => o.clear());
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // ---------- Data awal ----------
  const BUDGET_NAMES = ['Cincin Tunangan', 'Seserahan', 'Dekorasi', 'Makanan dan Catering',
    'Busana Pasangan', 'Makeup', 'Fotografer', 'Sewa Tempat', 'Transportasi',
    'Biaya Keluarga', 'Dana Cadangan', 'Kebutuhan Lainnya'];
  const CHECK_NAMES = ['Menentukan tanggal tunangan', 'Menentukan anggaran', 'Membeli cincin',
    'Menyiapkan seserahan', 'Memilih pakaian', 'Menentukan tempat acara', 'Memesan catering',
    'Mengundang keluarga', 'Menyiapkan dokumentasi', 'Persiapan hari H'];

  async function init() {
    await open();
    if ((await all('budget')).length === 0) {
      for (let i = 0; i < BUDGET_NAMES.length; i++) {
        await put('budget', { id: 'b' + (i + 1), name: BUDGET_NAMES[i], planned: 0, actual: 0, status: 'Belum Bayar', note: '' });
      }
    }
    if ((await all('checklist')).length === 0) {
      for (let i = 0; i < CHECK_NAMES.length; i++) {
        await put('checklist', { id: 'c' + (i + 1), name: CHECK_NAMES[i], done: false });
      }
    }
    if (!(await get('settings', 'prefs'))) {
      await put('settings', { id: 'prefs', dark: false, remind: 'harian', remindOn: false });
    }
  }

  // ---------- Validasi ----------
  function validAmount(n) {
    n = Number(n);
    if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error('Nominal harus angka bulat.');
    if (n <= 0) throw new Error('Nominal harus lebih dari 0.');
    if (n > 1e12) throw new Error('Nominal terlalu besar.');
    return n;
  }
  function validDate(d) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(new Date(d).getTime())) throw new Error('Tanggal tidak valid.');
    return d;
  }
  const clean = (t, max = 200) => String(t || '').trim().slice(0, max);

  // ---------- Profil ----------
  const getProfile = () => get('profile', 'main');
  async function saveProfile(p) {
    const data = {
      id: 'main',
      groom: clean(p.groom, 50), bride: clean(p.bride, 50),
      photo: p.photo || '',
      startDate: validDate(p.startDate), eventDate: validDate(p.eventDate),
      target: validAmount(p.target),
      targetGroom: validAmount(p.targetGroom), targetBride: validAmount(p.targetBride)
    };
    if (!data.groom || !data.bride) throw new Error('Nama pasangan wajib diisi.');
    if (new Date(data.eventDate) <= new Date(data.startDate)) throw new Error('Tanggal tunangan harus setelah tanggal mulai.');
    await put('profile', data);
    return data;
  }

  // ---------- Transaksi ----------
  // type: 'in' (setoran) atau 'out' (pengeluaran); who: 'pria' / 'wanita'
  async function addTransaction(t) {
    const rec = {
      id: uid(),
      type: t.type === 'out' ? 'out' : 'in',
      who: ['pria', 'wanita'].includes(t.who) ? t.who : 'pria',
      amount: validAmount(t.amount),
      date: validDate(t.date),
      note: clean(t.note),
      category: clean(t.category || (t.type === 'out' ? 'Pengeluaran' : 'Tabungan'), 60),
      createdAt: Date.now()
    };
    // Cegah klik ganda: data identik dalam 5 detik terakhir
    const list = await all('transactions');
    const dup = list.some(x => x.type === rec.type && x.who === rec.who && x.amount === rec.amount &&
      x.date === rec.date && x.note === rec.note && x.category === rec.category &&
      Math.abs(rec.createdAt - x.createdAt) < 5000);
    if (dup) throw new Error('Transaksi yang sama baru saja disimpan. Dibatalkan agar tidak ganda.');
    await put('transactions', rec);
    return rec;
  }
  async function updateTransaction(id, t) {
    const old = await get('transactions', id);
    if (!old) throw new Error('Transaksi tidak ditemukan.');
    const rec = {
      ...old,
      who: ['pria', 'wanita'].includes(t.who) ? t.who : old.who,
      amount: validAmount(t.amount), date: validDate(t.date),
      note: clean(t.note), category: clean(t.category || old.category, 60)
    };
    await put('transactions', rec);
    return rec;
  }
  const deleteTransaction = id => del('transactions', id);
  async function listTransactions(f = {}) {
    let l = await all('transactions');
    if (f.from) l = l.filter(x => x.date >= f.from);
    if (f.to) l = l.filter(x => x.date <= f.to);
    if (f.category) l = l.filter(x => x.category === f.category);
    if (f.type) l = l.filter(x => x.type === f.type);
    return l.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }

  // Saldo otomatis
  async function summary() {
    const l = await all('transactions');
    const s = { totalIn: 0, totalOut: 0, balance: 0, pria: 0, wanita: 0 };
    l.forEach(x => {
      if (x.type === 'in') { s.totalIn += x.amount; s[x.who] += x.amount; }
      else s.totalOut += x.amount;
    });
    s.balance = s.totalIn - s.totalOut;
    return s;
  }

  // ---------- Anggaran dan checklist ----------
  async function saveBudget(id, b) {
    const old = await get('budget', id);
    if (!old) throw new Error('Kategori tidak ditemukan.');
    const planned = Number(b.planned || 0), actual = Number(b.actual || 0);
    if (!Number.isInteger(planned) || planned < 0 || !Number.isInteger(actual) || actual < 0)
      throw new Error('Nominal anggaran harus angka bulat, tidak negatif.');
    const status = ['Belum Bayar', 'DP', 'Lunas'].includes(b.status) ? b.status : old.status;
    await put('budget', { ...old, planned, actual, status, note: clean(b.note) });
  }
  const listBudget = () => all('budget').then(l => l.sort((a, b) => a.id.slice(1) - b.id.slice(1)));
  async function toggleCheck(id) {
    const c = await get('checklist', id);
    if (c) await put('checklist', { ...c, done: !c.done });
  }
  const listChecklist = () => all('checklist').then(l => l.sort((a, b) => a.id.slice(1) - b.id.slice(1)));

  // ---------- Pengaturan ----------
  const getPrefs = () => get('settings', 'prefs');
  async function setPrefs(p) { await put('settings', { ...(await getPrefs()), ...p, id: 'prefs' }); }

  // ---------- PIN (di-hash, tidak disimpan sebagai teks) ----------
  const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  async function hashPin(pin, salt) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
    return hex(bits);
  }
  async function setPin(pin) {
    if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN harus 4 sampai 6 angka.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    await put('settings', { id: 'pin', salt: hex(salt), hash: await hashPin(pin, salt) });
  }
  const hasPin = async () => !!(await get('settings', 'pin'));
  async function checkPin(pin) {
    const p = await get('settings', 'pin');
    if (!p) return true;
    const salt = new Uint8Array(p.salt.match(/../g).map(h => parseInt(h, 16)));
    return (await hashPin(String(pin), salt)) === p.hash;
  }
  const removePin = () => del('settings', 'pin');

  // ---------- Backup dan pulihkan (PIN tidak ikut) ----------
  async function exportAll() {
    return {
      app: 'tabungan-tunangan', version: 1, exportedAt: new Date().toISOString(),
      profile: await all('profile'), transactions: await all('transactions'),
      budget: await all('budget'), checklist: await all('checklist'),
      prefs: await getPrefs()
    };
  }
  async function importAll(data) {
    if (!data || data.app !== 'tabungan-tunangan') throw new Error('File backup tidak valid.');
    for (const s of ['profile', 'transactions', 'budget', 'checklist']) {
      if (!Array.isArray(data[s])) throw new Error('Isi file backup rusak.');
    }
    for (const s of ['profile', 'transactions', 'budget', 'checklist']) {
      await clear(s);
      for (const v of data[s]) await put(s, v);
    }
    if (data.prefs) await put('settings', { ...data.prefs, id: 'prefs' });
  }

  return { init, getProfile, saveProfile, addTransaction, updateTransaction, deleteTransaction,
    listTransactions, summary, saveBudget, listBudget, toggleCheck, listChecklist,
    getPrefs, setPrefs, setPin, hasPin, checkPin, removePin, exportAll, importAll };
})();
