// extra.js - Anggaran dan Checklist (Tahap 5)
const _baseRender = render;
render = async function () {
  if (page !== 'budget' && page !== 'check') return _baseRender();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.p === page));
  try { page === 'budget' ? await budgetPage() : await checkPage(); }
  catch (e) { toast(e.message); }
};

const STATUS_COLOR = { 'Belum Bayar': '#c0504d', 'DP': '#d98c1f', 'Lunas': '#4a9a5c' };

async function budgetPage() {
  const l = await DB.listBudget();
  const pl = l.reduce((a, x) => a + x.planned, 0);
  const ac = l.reduce((a, x) => a + x.actual, 0);
  const left = pl - ac;
  $('#app').innerHTML = `<div class="wrap">
  <div class="card center"><h3>Ringkasan Anggaran</h3>
  <div class="row" style="margin-top:10px">
    <div><p class="mut">Rencana</p><b>${rp(pl)}</b></div>
    <div><p class="mut">Realisasi</p><b>${rp(ac)}</b></div>
    <div><p class="mut">Sisa</p><b style="color:${left < 0 ? '#c0504d' : 'inherit'}">${rp(left)}</b></div>
  </div>
  <div class="bar"><i style="width:${pl ? Math.min(100, Math.floor(ac / pl * 100)) : 0}%"></i></div>
  ${pl > P.target ? '<p class="mut" style="margin-top:8px">⚠️ Total rencana melebihi target tabungan ' + rp(P.target) + '</p>' : ''}
  </div>
  ${l.map(x => `<div class="card" onclick="budgetForm('${x.id}')" style="cursor:pointer">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <b>${esc(x.name)}</b>
      <span style="font-size:12px;color:#fff;background:${STATUS_COLOR[x.status]};padding:3px 10px;border-radius:10px">${x.status}</span>
    </div>
    <div class="row" style="margin-top:8px">
      <div><p class="mut">Rencana</p>${rp(x.planned)}</div>
      <div><p class="mut">Realisasi</p>${rp(x.actual)}</div>
    </div>
    ${x.note ? '<p class="mut" style="margin-top:6px">📝 ' + esc(x.note) + '</p>' : ''}
  </div>`).join('')}
  <p class="mut center">Ketuk kategori untuk mengubah.</p></div>`;
}

async function budgetForm(id) {
  const x = (await DB.listBudget()).find(b => b.id === id);
  $('#modal').innerHTML = `<div class="sheet"><h3>${esc(x.name)}</h3>
  <label>Anggaran direncanakan (Rp)</label><input id="b-pl" inputmode="numeric" value="${x.planned || ''}" placeholder="0">
  <label>Pengeluaran sebenarnya (Rp)</label><input id="b-ac" inputmode="numeric" value="${x.actual || ''}" placeholder="0">
  <label>Status pembayaran</label><select id="b-st">
    ${['Belum Bayar', 'DP', 'Lunas'].map(s => `<option ${s === x.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
  <label>Catatan</label><input id="b-nt" maxlength="200" value="${esc(x.note)}">
  <button class="btn" id="b-ok" onclick="saveBudgetForm('${id}')">Simpan</button>
  <button class="btn alt" onclick="closeModal()">Batal</button></div>`;
  $('#modal').classList.add('show');
}

async function saveBudgetForm(id) {
  if (busy) return; busy = true; const b = $('#b-ok'); b.disabled = true;
  try {
    await DB.saveBudget(id, { planned: digits('#b-pl'), actual: digits('#b-ac'), status: $('#b-st').value, note: $('#b-nt').value });
    closeModal(); toast('Tersimpan ✅'); await render();
  } catch (e) { toast(e.message); }
  finally { busy = false; b.disabled = false; }
}

async function checkPage() {
  const l = await DB.listChecklist();
  const done = l.filter(x => x.done).length;
  const pct = l.length ? Math.floor(done / l.length * 100) : 0;
  $('#app').innerHTML = `<div class="wrap">
  <div class="card center"><h3>Persiapan Tunangan</h3>
  <div class="big">${pct}%</div><p class="mut">${done} dari ${l.length} selesai</p>
  <div class="bar"><i style="width:${pct}%"></i></div>
  ${pct === 100 ? '<p style="margin-top:8px">🎉 Semua persiapan selesai!</p>' : ''}</div>
  <div class="card">${l.map(x => `<label class="tx" style="margin:0;color:var(--text);cursor:pointer">
    <span style="display:flex;gap:12px;align-items:center;${x.done ? 'text-decoration:line-through;opacity:.55' : ''}">
      <input type="checkbox" style="width:22px;height:22px" ${x.done ? 'checked' : ''} onchange="toggleItem('${x.id}')">${esc(x.name)}</span></label>`).join('')}
  </div></div>`;
}

async function toggleItem(id) {
  try { await DB.toggleCheck(id); await render(); } catch (e) { toast(e.message); }
}
