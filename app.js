// app.js - Logika Tabungan Tunangan (Tahap 4)
const $ = s => document.querySelector(s);
const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const QUOTES = ['Menabung bersama adalah langkah kecil menuju hari bahagia.', 'Setiap rupiah adalah doa untuk masa depan kalian.', 'Cinta yang direncanakan tumbuh lebih kuat.', 'Sedikit demi sedikit, hari bahagia makin dekat.', 'Kompak menabung, kompak melangkah.', 'Kesabaran hari ini, kebahagiaan di hari H.', 'Satu tujuan, satu tabungan.'];
let P = null, page = 'home', photoData = '', busy = false;

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800); }
const daysLeft = () => Math.max(0, Math.ceil((new Date(P.eventDate + 'T00:00') - new Date(today() + 'T00:00')) / 864e5));
const digits = id => $(id).value.replace(/\D/g, '');

// ---------- Mulai ----------
async function boot() {
  try {
    await DB.init();
    const prefs = await DB.getPrefs();
    if (prefs.dark) document.body.classList.add('dark');
    P = await DB.getProfile();
    if (await DB.hasPin()) return lockScreen();
    if (!P) return setupScreen();
    start();
  } catch (e) { $('#app').innerHTML = '<div class="wrap card">Gagal membuka penyimpanan: ' + esc(e.message) + '</div>'; }
}
function start() { $('#nav').hidden = false; render(); }

// ---------- Layar PIN ----------
function lockScreen() {
  $('#nav').hidden = true;
  $('#app').innerHTML = `<div class="wrap center"><h1 style="margin-top:80px">💍 Tabungan Tunangan</h1><p class="mut">Masukkan PIN untuk membuka</p>
  <div class="card"><input id="pin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN" style="text-align:center;font-size:24px">
  <button class="btn" onclick="unlock()">Buka</button></div></div>`;
}
async function unlock() {
  if (await DB.checkPin($('#pin').value)) { P = await DB.getProfile(); P ? start() : setupScreen(); }
  else { toast('PIN salah'); $('#pin').value = ''; }
}

// ---------- Setup awal ----------
function setupScreen() {
  $('#nav').hidden = true;
  $('#app').innerHTML = `<div class="wrap"><div class="card hero"><h1>💍 Tabungan Tunangan</h1><p class="tag">Satu Tujuan, Satu Tabungan, Menuju Hari Bahagia.</p></div>
  <div class="card"><h3>Data Pasangan</h3>
  <label>Nama calon pria</label><input id="s-g" maxlength="50">
  <label>Nama calon wanita</label><input id="s-b" maxlength="50">
  <label>Foto pasangan (opsional)</label><input id="s-ph" type="file" accept="image/*" onchange="pickPhoto(this)">
  <label>Tanggal mulai menabung</label><input id="s-st" type="date" value="${today()}">
  <label>Tanggal target tunangan</label><input id="s-ev" type="date">
  <label>Target total tabungan (Rp)</label><input id="s-t" inputmode="numeric" placeholder="20000000">
  <label>Target pria (Rp)</label><input id="s-tg" inputmode="numeric">
  <label>Target wanita (Rp)</label><input id="s-tb" inputmode="numeric">
  <label>Buat PIN (4-6 angka)</label><input id="s-pin" type="password" inputmode="numeric" maxlength="6">
  <button class="btn" id="s-ok" onclick="saveSetup()">Mulai Menabung</button></div></div>`;
}
function pickPhoto(inp) {
  const f = inp.files[0]; if (!f) return;
  const img = new Image(), r = new FileReader();
  r.onload = () => { img.src = r.result; };
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = c.height = 200;
    const x = c.getContext('2d'), m = Math.min(img.width, img.height);
    x.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, 200, 200);
    photoData = c.toDataURL('image/jpeg', .8);
  };
  r.readAsDataURL(f);
}
async function saveSetup() {
  if (busy) return; busy = true; $('#s-ok').disabled = true;
  try {
    const pin = $('#s-pin').value;
    if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN harus 4 sampai 6 angka.');
    P = await DB.saveProfile({ groom: $('#s-g').value, bride: $('#s-b').value, photo: photoData,
      startDate: $('#s-st').value, eventDate: $('#s-ev').value, target: digits('#s-t'),
      targetGroom: digits('#s-tg'), targetBride: digits('#s-tb') });
    await DB.setPin(pin);
    toast('Selamat datang! 💕'); start();
  } catch (e) { toast(e.message); }
  finally { busy = false; const b = $('#s-ok'); if (b) b.disabled = false; }
}

// ---------- Navigasi ----------
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => { page = b.dataset.p; render(); });
async function render() {
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.p === page));
  try {
    if (page === 'home') await home();
    else if (page === 'save') await savePage();
    else {
      const t = { budget: ['Anggaran', 'Tahap 5'], check: ['Checklist', 'Tahap 5'], profile: ['Profil', 'Tahap 7'] }[page];
      $('#app').innerHTML = `<div class="wrap"><div class="card center"><h2>${t[0]}</h2><p class="mut">Halaman ini dikerjakan di ${t[1]}.</p></div></div>`;
    }
  } catch (e) { toast(e.message); }
}

// ---------- Beranda ----------
function chart(list) {
  const asc = [...list].reverse(); let run = 0;
  const pts = asc.map(x => (run += x.type === 'in' ? x.amount : -x.amount));
  if (pts.length < 2) return '<p class="mut center">Grafik muncul setelah ada 2 transaksi.</p>';
  const max = Math.max(...pts, 1), min = Math.min(...pts, 0);
  const xy = pts.map((v, i) => (10 + i * 280 / (pts.length - 1)).toFixed(1) + ',' + (110 - (v - min) / ((max - min) || 1) * 100).toFixed(1));
  return `<svg viewBox="0 0 300 120"><polyline points="${xy.join(' ')}" fill="none" stroke="#C9A24B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
async function home() {
  const s = await DB.summary(), l = await DB.listTransactions();
  const pct = Math.max(0, Math.min(100, Math.floor(s.balance / P.target * 100)));
  const q = QUOTES[Math.floor(Date.now() / 864e5) % QUOTES.length];
  $('#app').innerHTML = `<div class="wrap">
  <div class="card hero">${P.photo ? `<img src="${P.photo}">` : '<div style="font-size:50px">💑</div>'}
  <h2>${esc(P.groom)} &amp; ${esc(P.bride)}</h2><p class="tag">Satu Tujuan, Satu Tabungan, Menuju Hari Bahagia.</p></div>
  <div class="card center"><p class="mut">Total tabungan terkumpul</p><div class="big">${rp(s.balance)}</div>
  <div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
  <div class="row"><div><p class="mut">Target</p><b>${rp(P.target)}</b></div><div><p class="mut">Sisa</p><b>${rp(Math.max(0, P.target - s.balance))}</b></div></div></div>
  <div class="card center"><p class="mut">Tunangan: ${new Date(P.eventDate + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  <div class="big">${daysLeft()} hari</div><p class="mut">lagi menuju hari bahagia 💍</p></div>
  <div class="card"><h3>Perkembangan Tabungan</h3>${chart(l)}</div>
  <div class="card center"><p class="serif">“${q}”</p></div></div>
  <button class="fab" onclick="txForm()">+</button>`;
}

// ---------- Tabungan ----------
async function savePage() {
  const s = await DB.summary(), l = await DB.listTransactions({ type: 'in' });
  const rem = Math.max(0, P.target - s.balance), d = daysLeft();
  const daily = d ? Math.ceil(rem / d) : rem, weekly = d ? Math.ceil(rem / (d / 7)) : rem, monthly = d ? Math.ceil(rem / (d / 30)) : rem;
  const rg = Math.max(0, P.targetGroom - s.pria), rb = Math.max(0, P.targetBride - s.wanita);
  const mg = d ? Math.ceil(rg / (d / 30)) : rg, mb = d ? Math.ceil(rb / (d / 30)) : rb;
  const pc = (v, t) => Math.min(100, Math.floor(v / (t || 1) * 100));
  $('#app').innerHTML = `<div class="wrap"><div class="row">
  <div class="card"><p class="mut">👨 ${esc(P.groom)}</p><b>${rp(s.pria)}</b><div class="bar"><i style="width:${pc(s.pria, P.targetGroom)}%"></i></div><p class="mut">Target ${rp(P.targetGroom)}</p></div>
  <div class="card"><p class="mut">👩 ${esc(P.bride)}</p><b>${rp(s.wanita)}</b><div class="bar"><i style="width:${pc(s.wanita, P.targetBride)}%"></i></div><p class="mut">Target ${rp(P.targetBride)}</p></div></div>
  <div class="card calc"><h3>Kalkulator Target</h3>
  <div><span>Sisa hari</span><b>${d} hari</b></div>
  <div><span>Sisa dana</span><b>${rp(rem)}</b></div>
  <div><span>Per hari</span><b>${rp(daily)}</b></div>
  <div><span>Per minggu</span><b>${rp(weekly)}</b></div>
  <div><span>Per bulan</span><b>${rp(monthly)}</b></div>
  <div><span>Per bulan ${esc(P.groom)}</span><b>${rp(mg)}</b></div>
  <div><span>Per bulan ${esc(P.bride)}</span><b>${rp(mb)}</b></div>
  ${d === 0 ? '<p class="mut">Tanggal tunangan sudah tiba atau lewat.</p>' : ''}</div>
  <div class="card"><h3>Riwayat Setoran</h3>${l.length ? l.map(x => `<div class="tx"><div><b>${rp(x.amount)}</b><br><span class="mut">${x.who === 'pria' ? '👨' : '👩'} ${x.date}${x.note ? ' · ' + esc(x.note) : ''}</span></div>
  <div class="acts"><button onclick="txForm('${x.id}')">✏️</button><button onclick="delTx('${x.id}')">🗑️</button></div></div>`).join('') : '<p class="mut center">Belum ada setoran, yuk mulai menabung 💕</p>'}</div></div>
  <button class="fab" onclick="txForm()">+</button>`;
}

// ---------- Form setoran ----------
async function txForm(id) {
  const t = id ? (await DB.listTransactions()).find(x => x.id === id) : null;
  $('#modal').innerHTML = `<div class="sheet"><h3>${t ? 'Edit' : 'Tambah'} Tabungan</h3>
  <label>Penyetor</label><select id="f-who"><option value="pria" ${t && t.who === 'pria' ? 'selected' : ''}>👨 ${esc(P.groom)}</option><option value="wanita" ${t && t.who === 'wanita' ? 'selected' : ''}>👩 ${esc(P.bride)}</option></select>
  <label>Nominal (Rp)</label><input id="f-amt" inputmode="numeric" value="${t ? t.amount : ''}" placeholder="500000">
  <label>Tanggal</label><input id="f-date" type="date" value="${t ? t.date : today()}">
  <label>Keterangan</label><input id="f-note" maxlength="200" value="${t ? esc(t.note) : ''}">
  <button class="btn" id="sv" onclick="saveTx('${id || ''}')">Simpan</button>
  <button class="btn alt" onclick="closeModal()">Batal</button></div>`;
  $('#modal').classList.add('show');
}
const closeModal = () => $('#modal').classList.remove('show');
async function saveTx(id) {
  if (busy) return; busy = true; const b = $('#sv'); b.disabled = true;
  try {
    const d = { type: 'in', who: $('#f-who').value, amount: digits('#f-amt'), date: $('#f-date').value, note: $('#f-note').value };
    id ? await DB.updateTransaction(id, d) : await DB.addTransaction(d);
    closeModal(); toast('Tersimpan ✅'); await render();
  } catch (e) { toast(e.message); }
  finally { busy = false; b.disabled = false; }
}
async function delTx(id) {
  if (!confirm('Hapus setoran ini? Tindakan tidak bisa dibatalkan.')) return;
  await DB.deleteTransaction(id); toast('Dihapus'); render();
}

boot();
