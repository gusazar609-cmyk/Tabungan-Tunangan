// extra2.js - Riwayat Keuangan, Laporan, Ekspor PDF (Tahap 6)
const _render2 = render;
let F = { from: '', to: '', category: '' };
const go = p => { page = p; render(); };

render = async function () {
  if (!['profile', 'hist', 'report'].includes(page)) return _render2();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.p === 'profile'));
  try {
    if (page === 'profile') await profileMenu();
    else if (page === 'hist') await histPage();
    else await reportPage();
  } catch (e) { toast(e.message); }
};

// cetak: hanya #printArea yang tampil saat print
const st = document.createElement('style');
st.textContent = `#printArea{display:none}
@media print{body>*:not(#printArea){display:none!important}
body{background:#fff!important;padding:0!important}
#printArea{display:block;color:#000;font-family:Georgia,serif;padding:10px}
#printArea table{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0}
#printArea td,#printArea th{border:1px solid #999;padding:4px;text-align:left}}`;
document.head.appendChild(st);

// ---------- Profil (menu sementara) ----------
async function profileMenu() {
  $('#app').innerHTML = `<div class="wrap">
  <div class="card hero">${P.photo ? `<img src="${P.photo}">` : '<div style="font-size:50px">💑</div>'}
  <h2>${esc(P.groom)} &amp; ${esc(P.bride)}</h2><p class="tag">Tunangan: ${P.eventDate}</p></div>
  <div class="card">
    <button class="btn" style="margin-top:0" onclick="go('hist')">📒 Riwayat Keuangan</button>
    <button class="btn" onclick="go('report')">📊 Laporan</button></div>
  <p class="mut center">Pengaturan, PIN, backup, dan mode gelap hadir di Tahap 7.</p></div>`;
}

// ---------- Riwayat Keuangan ----------
async function histPage() {
  const every = await DB.listTransactions();
  const cats = [...new Set(every.map(x => x.category))].sort();
  const l = await DB.listTransactions(F);
  const tin = l.filter(x => x.type === 'in').reduce((a, x) => a + x.amount, 0);
  const tout = l.filter(x => x.type === 'out').reduce((a, x) => a + x.amount, 0);
  $('#app').innerHTML = `<div class="wrap">
  <button class="btn alt" style="margin:0 0 8px" onclick="go('profile')">← Profil</button>
  <div class="card"><h3>Filter</h3>
    <div class="row"><div><label>Dari</label><input id="h-f" type="date" value="${F.from}"></div>
    <div><label>Sampai</label><input id="h-t" type="date" value="${F.to}"></div></div>
    <label>Kategori</label><select id="h-c"><option value="">Semua kategori</option>
    ${cats.map(c => `<option ${c === F.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
    <button class="btn alt" onclick="resetFilter()">Hapus filter</button></div>
  <div class="card center"><div class="row">
    <div><p class="mut">Pemasukan</p><b>${rp(tin)}</b></div>
    <div><p class="mut">Pengeluaran</p><b style="color:#c0504d">${rp(tout)}</b></div>
    <div><p class="mut">Saldo akhir</p><b>${rp(tin - tout)}</b></div></div>
    <p class="mut" style="margin-top:6px">Sesuai filter di atas</p></div>
  <div class="row"><button class="btn" style="margin-top:0" onclick="txForm()">+ Setoran</button>
  <button class="btn" style="margin-top:0;background:#c0504d" onclick="expForm()">+ Pengeluaran</button></div>
  <div class="card" style="margin-top:14px"><h3>Transaksi</h3>
  ${l.length ? l.map(x => `<div class="tx"><div>
    <b style="color:${x.type === 'in' ? '#4a9a5c' : '#c0504d'}">${x.type === 'in' ? '+' : '-'} ${rp(x.amount)}</b><br>
    <span class="mut">${x.date} · ${esc(x.category)}${x.note ? ' · ' + esc(x.note) : ''}</span></div>
    <div class="acts"><button onclick="${x.type === 'in' ? 'txForm' : 'expForm'}('${x.id}')">✏️</button>
    <button onclick="delTx('${x.id}')">🗑️</button></div></div>`).join('')
    : '<p class="mut center">Tidak ada transaksi.</p>'}</div></div>`;
  ['#h-f', '#h-t', '#h-c'].forEach(id => $(id).onchange = applyFilter);
}
function applyFilter() { F = { from: $('#h-f').value, to: $('#h-t').value, category: $('#h-c').value }; render(); }
function resetFilter() { F = { from: '', to: '', category: '' }; render(); }

// ---------- Form pengeluaran ----------
async function expForm(id) {
  const t = id ? (await DB.listTransactions()).find(x => x.id === id) : null;
  const cats = (await DB.listBudget()).map(b => b.name).concat('Lainnya');
  $('#modal').innerHTML = `<div class="sheet"><h3>${t ? 'Edit' : 'Tambah'} Pengeluaran</h3>
  <label>Kategori</label><select id="e-cat">${cats.map(c => `<option ${t && t.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
  <label>Nominal (Rp)</label><input id="e-amt" inputmode="numeric" value="${t ? t.amount : ''}" placeholder="250000">
  <label>Tanggal</label><input id="e-date" type="date" value="${t ? t.date : today()}">
  <label>Keterangan</label><input id="e-note" maxlength="200" value="${t ? esc(t.note) : ''}">
  <button class="btn" id="e-ok" onclick="saveExp('${id || ''}')">Simpan</button>
  <button class="btn alt" onclick="closeModal()">Batal</button></div>`;
  $('#modal').classList.add('show');
}
async function saveExp(id) {
  if (busy) return; busy = true; const b = $('#e-ok'); b.disabled = true;
  try {
    const d = { type: 'out', who: 'pria', amount: digits('#e-amt'), date: $('#e-date').value, note: $('#e-note').value, category: $('#e-cat').value };
    id ? await DB.updateTransaction(id, d) : await DB.addTransaction(d);
    closeModal(); toast('Tersimpan ✅'); await render();
  } catch (e) { toast(e.message); }
  finally { busy = false; b.disabled = false; }
}

// ---------- Laporan ----------
async function reportData() {
  const s = await DB.summary(), l = await DB.listTransactions(), b = await DB.listBudget();
  const planned = b.reduce((a, x) => a + x.planned, 0), actual = b.reduce((a, x) => a + x.actual, 0);
  const pct = Math.max(0, Math.min(100, Math.floor(s.balance / P.target * 100)));
  return { s, l, b, planned, actual, left: planned - actual, pct };
}
function bars(l) {
  const m = {};
  l.filter(x => x.type === 'in').forEach(x => { const k = x.date.slice(0, 7); m[k] = (m[k] || 0) + x.amount; });
  const keys = Object.keys(m).sort().slice(-6);
  if (!keys.length) return '<p class="mut center">Belum ada data setoran.</p>';
  const max = Math.max(...keys.map(k => m[k])), w = 300 / keys.length;
  return '<svg viewBox="0 0 300 140">' + keys.map((k, i) => {
    const h = m[k] / max * 90;
    return `<rect x="${i * w + 8}" y="${105 - h}" width="${w - 16}" height="${h}" rx="5" fill="#C9A24B"/>
    <text x="${i * w + w / 2}" y="${100 - h}" font-size="9" text-anchor="middle" fill="#8a7a7e">${(m[k] / 1e6).toFixed(1)} jt</text>
    <text x="${i * w + w / 2}" y="122" font-size="10" text-anchor="middle" fill="#8a7a7e">${k.slice(5)}/${k.slice(2, 4)}</text>`;
  }).join('') + '</svg>';
}
async function reportPage() {
  const r = await reportData();
  $('#app').innerHTML = `<div class="wrap">
  <button class="btn alt" style="margin:0 0 8px" onclick="go('profile')">← Profil</button>
  <div class="card center"><p class="mut">Total tabungan</p><div class="big">${rp(r.s.balance)}</div>
  <div class="ring" style="--p:${r.pct}"><span>${r.pct}%</span></div><p class="mut">dari target ${rp(P.target)}</p></div>
  <div class="card calc"><h3>Ringkasan</h3>
  <div><span>Total pemasukan</span><b>${rp(r.s.totalIn)}</b></div>
  <div><span>Kontribusi ${esc(P.groom)}</span><b>${rp(r.s.pria)}</b></div>
  <div><span>Kontribusi ${esc(P.bride)}</span><b>${rp(r.s.wanita)}</b></div>
  <div><span>Total pengeluaran</span><b>${rp(r.s.totalOut)}</b></div>
  <div><span>Sisa anggaran</span><b>${rp(r.left)}</b></div></div>
  <div class="card"><h3>Setoran per Bulan</h3>${bars(r.l)}</div>
  <div class="card"><h3>Perkembangan Saldo</h3>${chart(r.l)}</div>
  <button class="btn" onclick="exportPDF()">📄 Ekspor PDF</button></div>`;
}

async function exportPDF() {
  const r = await reportData();
  let el = $('#printArea');
  if (!el) { el = document.createElement('div'); el.id = 'printArea'; document.body.appendChild(el); }
  el.innerHTML = `<h1>Laporan Tabungan Tunangan</h1>
  <p>${esc(P.groom)} &amp; ${esc(P.bride)} · Dicetak ${today()} · Tunangan ${P.eventDate}</p>
  <h3>Ringkasan</h3><table>
  <tr><td>Total tabungan</td><td>${rp(r.s.balance)}</td></tr>
  <tr><td>Target</td><td>${rp(P.target)} (${r.pct}% tercapai)</td></tr>
  <tr><td>Kontribusi ${esc(P.groom)}</td><td>${rp(r.s.pria)}</td></tr>
  <tr><td>Kontribusi ${esc(P.bride)}</td><td>${rp(r.s.wanita)}</td></tr>
  <tr><td>Total pengeluaran</td><td>${rp(r.s.totalOut)}</td></tr>
  <tr><td>Sisa anggaran</td><td>${rp(r.left)}</td></tr></table>
  <h3>Anggaran</h3><table><tr><th>Kategori</th><th>Rencana</th><th>Realisasi</th><th>Status</th></tr>
  ${r.b.map(x => `<tr><td>${esc(x.name)}</td><td>${rp(x.planned)}</td><td>${rp(x.actual)}</td><td>${x.status}</td></tr>`).join('')}</table>
  <h3>Riwayat Transaksi</h3><table><tr><th>Tanggal</th><th>Jenis</th><th>Kategori</th><th>Nominal</th><th>Keterangan</th></tr>
  ${r.l.map(x => `<tr><td>${x.date}</td><td>${x.type === 'in' ? 'Masuk' : 'Keluar'}</td><td>${esc(x.category)}</td><td>${rp(x.amount)}</td><td>${esc(x.note)}</td></tr>`).join('')}</table>`;
  toast('Di jendela cetak, pilih "Simpan sebagai PDF"');
  setTimeout(() => window.print(), 700);
}
