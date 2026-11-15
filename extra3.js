// extra3.js - Pengaturan, Keamanan, Backup, Mode Gelap, Pengingat (Tahap 7)
const _render3 = render;
render = async function () {
  if (page !== 'profile') return _render3();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.p === 'profile'));
  try { await settingsPage(); } catch (e) { toast(e.message); }
};

async function settingsPage() {
  const pr = await DB.getPrefs(), pin = await DB.hasPin();
  const lab = { harian: 'Setiap hari', mingguan: 'Setiap minggu', bulanan: 'Setiap bulan' };
  $('#app').innerHTML = `<div class="wrap">
  <div class="card hero">${P.photo ? `<img src="${P.photo}">` : '<div style="font-size:50px">💑</div>'}
  <h2>${esc(P.groom)} &amp; ${esc(P.bride)}</h2><p class="tag">Tunangan: ${P.eventDate}</p></div>
  <div class="card"><h3>Keuangan</h3>
    <button class="btn" style="margin-top:8px" onclick="go('hist')">📒 Riwayat Keuangan</button>
    <button class="btn" onclick="go('report')">📊 Laporan dan Ekspor PDF</button></div>
  <div class="card"><h3>Pengaturan</h3>
    <button class="btn" style="margin-top:8px" onclick="profForm()">✏️ Edit Profil, Foto, Target, Tanggal</button>
    <button class="btn" onclick="remindForm()">🔔 Pengingat: ${pr.remindOn ? lab[pr.remind] : 'Mati'}</button>
    <button class="btn" onclick="pinForm()">🔒 PIN: ${pin ? 'Aktif (ubah/hapus)' : 'Belum dibuat'}</button>
    <button class="btn" onclick="toggleDark()">${pr.dark ? '☀️ Mode Terang' : '🌙 Mode Gelap'}</button></div>
  <div class="card"><h3>Backup dan Pulihkan</h3>
    <button class="btn" style="margin-top:8px" onclick="doBackup()">💾 Simpan Backup</button>
    <label>Pulihkan dari file backup</label><input type="file" accept=".json,application/json" onchange="doRestore(this)">
    <p class="mut" style="margin-top:8px">File backup berisi data keuangan dan tidak dienkripsi. Simpan dengan aman. PIN tidak ikut dalam backup.</p></div></div>`;
}

// ---------- Edit profil ----------
function profForm() {
  photoData = P.photo || '';
  $('#modal').innerHTML = `<div class="sheet"><h3>Edit Profil</h3>
  <label>Nama calon pria</label><input id="p-g" maxlength="50" value="${esc(P.groom)}">
  <label>Nama calon wanita</label><input id="p-b" maxlength="50" value="${esc(P.bride)}">
  <label>Ganti foto (opsional)</label><input type="file" accept="image/*" onchange="pickPhoto(this)">
  <label>Tanggal mulai menabung</label><input id="p-st" type="date" value="${P.startDate}">
  <label>Tanggal target tunangan</label><input id="p-ev" type="date" value="${P.eventDate}">
  <label>Target total (Rp)</label><input id="p-t" inputmode="numeric" value="${P.target}">
  <label>Target pria (Rp)</label><input id="p-tg" inputmode="numeric" value="${P.targetGroom}">
  <label>Target wanita (Rp)</label><input id="p-tb" inputmode="numeric" value="${P.targetBride}">
  <button class="btn" id="p-ok" onclick="saveProf()">Simpan</button>
  <button class="btn alt" onclick="closeModal()">Batal</button></div>`;
  $('#modal').classList.add('show');
}
async function saveProf() {
  if (busy) return; busy = true; const b = $('#p-ok'); b.disabled = true;
  try {
    P = await DB.saveProfile({ groom: $('#p-g').value, bride: $('#p-b').value, photo: photoData,
      startDate: $('#p-st').value, eventDate: $('#p-ev').value, target: digits('#p-t'),
      targetGroom: digits('#p-tg'), targetBride: digits('#p-tb') });
    closeModal(); toast('Profil diperbarui ✅'); await render();
  } catch (e) { toast(e.message); }
  finally { busy = false; b.disabled = false; }
}

// ---------- Mode gelap ----------
async function toggleDark() {
  const pr = await DB.getPrefs(), d = !pr.dark;
  await DB.setPrefs({ dark: d });
  document.body.classList.toggle('dark', d);
  render();
}

// ---------- PIN ----------
async function pinForm() {
  const has = await DB.hasPin();
  $('#modal').innerHTML = `<div class="sheet"><h3>PIN Keamanan</h3>
  ${has ? '<label>PIN saat ini</label><input id="n-old" type="password" inputmode="numeric" maxlength="6">' : ''}
  <label>${has ? 'PIN baru' : 'Buat PIN'} (4-6 angka)</label><input id="n-new" type="password" inputmode="numeric" maxlength="6">
  <button class="btn" id="n-ok" onclick="savePin()">Simpan PIN</button>
  ${has ? '<button class="btn" style="background:#c0504d" onclick="dropPin()">Hapus PIN</button>' : ''}
  <button class="btn alt" onclick="closeModal()">Batal</button></div>`;
  $('#modal').classList.add('show');
}
async function savePin() {
  if (busy) return; busy = true; const b = $('#n-ok'); b.disabled = true;
  try {
    if (await DB.hasPin() && !(await DB.checkPin($('#n-old').value))) throw new Error('PIN saat ini salah.');
    await DB.setPin($('#n-new').value);
    closeModal(); toast('PIN disimpan 🔒'); await render();
  } catch (e) { toast(e.message); }
  finally { busy = false; b.disabled = false; }
}
async function dropPin() {
  try {
    if (!(await DB.checkPin($('#n-old').value))) throw new Error('PIN saat ini salah.');
    if (!confirm('Hapus PIN? Aplikasi akan terbuka tanpa PIN.')) return;
    await DB.removePin(); closeModal(); toast('PIN dihapus'); await render();
  } catch (e) { toast(e.message); }
}

// ---------- Backup dan pulihkan ----------
async function doBackup() {
  try {
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'backup-tabungan-tunangan-' + today() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('Backup disimpan (cek folder Download)');
  } catch (e) { toast(e.message); }
}
function doRestore(inp) {
  const f = inp.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    let data;
    try { data = JSON.parse(r.result); } catch (e) { toast('File backup tidak valid.'); inp.value = ''; return; }
    try {
      if (!data || data.app !== 'tabungan-tunangan') throw new Error('File backup tidak valid.');
      if (!confirm('Pulihkan data? Semua data saat ini akan DIGANTI dengan isi file backup.')) { inp.value = ''; return; }
      await DB.importAll(data);
      P = await DB.getProfile();
      const pr = await DB.getPrefs();
      document.body.classList.toggle('dark', !!pr.dark);
      if (!P) { toast('Backup tidak berisi profil.'); return setupScreen(); }
      toast('Data dipulihkan ✅'); render();
    } catch (e) { toast('Gagal: ' + e.message); inp.value = ''; }
  };
  r.readAsText(f);
}

// ---------- Pengingat ----------
async function remindForm() {
  const pr = await DB.getPrefs();
  $('#modal').innerHTML = `<div class="sheet"><h3>Pengingat Menabung</h3>
  <label>Status</label><select id="r-on"><option value="1" ${pr.remindOn ? 'selected' : ''}>Aktif</option><option value="0" ${pr.remindOn ? '' : 'selected'}>Mati</option></select>
  <label>Seberapa sering</label><select id="r-f">
    ${[['harian', 'Setiap hari'], ['mingguan', 'Setiap minggu'], ['bulanan', 'Setiap bulan']].map(o => `<option value="${o[0]}" ${pr.remind === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
  <p class="mut" style="margin-top:10px">Pengingat muncul saat Anda membuka aplikasi, berisi motivasi dan peringatan jika tabungan bulan ini belum cukup.</p>
  <button class="btn" onclick="saveRemind()">Simpan</button>
  <button class="btn alt" onclick="closeModal()">Batal</button></div>`;
  $('#modal').classList.add('show');
}
async function saveRemind() {
  try {
    await DB.setPrefs({ remindOn: $('#r-on').value === '1', remind: $('#r-f').value, lastRemind: '' });
    closeModal(); toast('Pengingat disimpan 🔔'); await render();
  } catch (e) { toast(e.message); }
}
async function checkReminder() {
  try {
    const pr = await DB.getPrefs(); if (!pr.remindOn) return;
    const t = today(), last = pr.lastRemind || '';
    const gap = last ? Math.round((new Date(t) - new Date(last)) / 864e5) : 999;
    const due = pr.remind === 'harian' ? last !== t : pr.remind === 'mingguan' ? gap >= 7 : last.slice(0, 7) !== t.slice(0, 7);
    if (!due) return;
    const s = await DB.summary();
    const l = await DB.listTransactions({ type: 'in', from: t.slice(0, 7) + '-01' });
    const saved = l.reduce((a, x) => a + x.amount, 0);
    const rem = Math.max(0, P.target - s.balance), d = daysLeft();
    const need = d ? Math.ceil(rem / (d / 30)) : rem;
    const msg = rem === 0 ? '🎉 Target tabungan sudah tercapai!'
      : saved < need ? `⚠️ Bulan ini baru terkumpul ${rp(saved)} dari kebutuhan ${rp(need)}. Yuk tambah tabungan.`
      : `✅ Tabungan bulan ini sudah sesuai target (${rp(saved)}). Pertahankan!`;
    $('#modal').innerHTML = `<div class="sheet center"><h3>🔔 Waktunya Menabung</h3>
    <p class="serif" style="margin:12px 0">“${QUOTES[Math.floor(Math.random() * QUOTES.length)]}”</p>
    <p>${msg}</p>
    <button class="btn" onclick="txForm()">+ Tambah Tabungan</button>
    <button class="btn alt" onclick="closeModal()">Nanti</button></div>`;
    $('#modal').classList.add('show');
    await DB.setPrefs({ lastRemind: t });
  } catch (e) { /* pengingat tidak boleh mengganggu aplikasi */ }
}
const _start3 = start;
start = function () { _start3(); checkReminder(); };
