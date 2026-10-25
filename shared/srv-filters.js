// ══════════════════════════════════════════════════════════════
// §SRV-FILTERS — فلاتر رأس العمود للجداول اللي فلترتها server-side
// ──────────────────────────────────────────────────────────────
// ملف مشترك للهب (مش جزء من النواة المتطابقة مع هب الشحن). بيتحمّل بعد core.js.
//
// الفرق عن §TABLE في core.js: §TABLE بيفلتر الصفوف المعروضة في الصفحة بس،
// وده بيبعت الفلتر للـ Worker (النتائج والعدّ والصفحات والتصدير كلهم بنفس القيم).
// 🔴 على جدول بيستخدم المكوّن ده، حط `data-eco-nofilter` على كل `th` — وإلا يظهر
//    قمعين (واحد server وواحد client) على نفس العمود.
//
//   const f = ecoSrvFilters({
//     onChange: () => reload(),            // بيتنادى بعد كل تغيير (الاختيارات بتتأخر 250ms)
//     chips: '#srvChips', zone: '#srvChipsZone', clearBtn: '#clearAllBtn',
//     columns: [
//       { key:'emp',  th:'#thEmp',  type:'list', label:'الموظف', param:'employees', items:[…] },
//       { key:'q',    th:'#thOrd',  type:'text', label:'بحث',    param:'search' },
//       { key:'date', th:'#thDate', type:'date', label:'التاريخ' },     // dateFrom / dateTo
//     ],
//   });
//   f.params()  → كائن باراميترات جاهز للنداء  ·  f.setItems(key, items)  ·  f.clearAll()  ·  f.active()
// ══════════════════════════════════════════════════════════════
function ecoSrvFilters(cfg) {
  const $ = (s) => (typeof s === 'string' ? document.querySelector(s) : s);
  const cols = {};
  const SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="3 4 21 4 14 12.5 14 20 10 18 10 12.5 3 4"></polygon></svg>';
  const PRESETS = [
    ['today', 'اليوم'], ['yesterday', 'أمس'], ['last3', 'آخر 3 أيام'], ['last7', 'آخر 7 أيام'],
    ['last30', 'آخر 30 يوم'], ['last90', 'آخر 90 يوم'], ['thisMonth', 'الشهر الحالي'],
    ['lastMonth', 'الشهر السابق'], ['thisYear', 'العام الحالي'], ['lastYear', 'العام السابق'],
  ];
  const MONTHS = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const p2 = (n) => String(n).padStart(2, '0');

  // ─── الحالة ───
  cfg.columns.forEach((c) => {
    cols[c.key] = Object.assign({ items: [], sel: new Set(), q: '', text: '', from: '', to: '', preset: '', btn: null }, c, { th: $(c.th) });
  });

  // ─── الفترات: يوم القاهرة من core (cairoDayStr / ecoAddDays) ───
  function presetRange(id) {
    const today = cairoDayStr(new Date());
    const [y, m] = today.split('-').map(Number);
    const monthEnd = (yy, mm) => `${yy}-${p2(mm)}-${p2(new Date(Date.UTC(yy, mm, 0)).getUTCDate())}`;
    switch (id) {
      case 'today':     return [today, today];
      case 'yesterday': { const d = ecoAddDays(today, -1); return [d, d]; }
      case 'last3':     return [ecoAddDays(today, -2), today];
      case 'last7':     return [ecoAddDays(today, -6), today];
      case 'last30':    return [ecoAddDays(today, -29), today];
      case 'last90':    return [ecoAddDays(today, -89), today];
      case 'thisMonth': return [`${y}-${p2(m)}-01`, today];
      case 'lastMonth': { const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y; return [`${py}-${p2(pm)}-01`, monthEnd(py, pm)]; }
      case 'thisYear':  return [`${y}-01-01`, today];
      case 'lastYear':  return [`${y - 1}-01-01`, `${y - 1}-12-31`];
    }
    return null;
  }

  // ─── هل العمود فيه فلتر؟ ───
  function isOn(c) { return c.type === 'list' ? c.sel.size > 0 : c.type === 'text' ? !!c.text.trim() : !!(c.from || c.to); }
  function active() { return Object.values(cols).some(isOn); }

  // ─── الباراميترات للـ Worker (المصدر الوحيد للعرض والعدّ والتصدير) ───
  function params() {
    const p = {};
    Object.values(cols).forEach((c) => {
      if (c.type === 'list' && c.sel.size) p[c.param] = [...c.sel].join(',');
      else if (c.type === 'text' && c.text.trim()) p[c.param] = c.text.trim();
      else if (c.type === 'date') { if (c.from) p.dateFrom = c.from; if (c.to) p.dateTo = c.to; }
    });
    return p;
  }

  // ─── الترويسة: زرار القمع + العدّاد ───
  function paintHeads() {
    Object.values(cols).forEach((c) => {
      if (!c.th) return;
      c.th.classList.toggle('flt-on', isOn(c));
      const cnt = c.btn.querySelector('.th-cnt');
      if (cnt) cnt.remove();
      if (c.type === 'list' && c.sel.size) {
        const s = document.createElement('span'); s.className = 'th-cnt'; s.textContent = c.sel.size; c.btn.appendChild(s);
      }
    });
  }

  // ─── الشيبس: سطر لكل فلتر، واسم الفلتر مرة واحدة ───
  function dateChipText(c) {
    if (c.preset === 'month') return `${MONTHS[Number(c.from.slice(5, 7))]} ${c.from.slice(0, 4)}`;
    const preset = PRESETS.find((x) => x[0] === c.preset);
    if (preset) return preset[1];
    return `${c.from ? 'من ' + ecoYmdToDMY(c.from) : ''}${c.from && c.to ? ' ' : ''}${c.to ? 'إلى ' + ecoYmdToDMY(c.to) : ''}`;
  }
  function renderChips() {
    const rows = $(cfg.chips), zone = $(cfg.zone);
    if (rows) {
      rows.innerHTML = Object.values(cols).filter(isOn).map((c) => {
        let chips;
        if (c.type === 'list') {
          chips = [...c.sel].map((v) => {
            const it = c.items.find((i) => i.value === v);
            const t = it ? it.label : v;
            return `<span class="ms-chip">${esc(t)}<button type="button" aria-label="شيل ${esc(t)}" data-k="${esc(c.key)}" data-v="${esc(v)}">✕</button></span>`;
          }).join('');
        } else {
          const t = c.type === 'text' ? c.text.trim() : dateChipText(c);
          chips = `<span class="ms-chip">${esc(t)}<button type="button" aria-label="شيل الفلتر" data-k="${esc(c.key)}">✕</button></span>`;
        }
        return `<div class="ms-chips-row"><span class="chips-label">${esc(c.label)}:</span>${chips}</div>`;
      }).join('');
    }
    if (zone) zone.hidden = !active();
    paintHeads();
  }

  // ─── التغيير: الشيبس فورًا، والنداء بتأخير بسيط (اختيارات متتالية = نداء واحد) ───
  let timer = null;
  function changed(now) {
    renderChips();
    clearTimeout(timer);
    timer = setTimeout(() => cfg.onChange && cfg.onChange(), now ? 0 : 250);
  }

  // ─── النافذة المنسدلة (واحدة مشتركة) ───
  const pop = document.createElement('div');
  pop.className = 'srv-pop'; pop.setAttribute('role', 'dialog');
  document.body.appendChild(pop);
  let openKey = null;

  function listHTML(c) {
    const q = c.q.trim().toLowerCase();
    const vis = q ? c.items.filter((i) => i.label.toLowerCase().includes(q)) : c.items;
    const all = vis.length > 0 && vis.every((i) => c.sel.has(i.value));
    return (c.items.length > 6 ? `<input class="srv-input" data-act="q" aria-label="بحث في ${esc(c.label)}" value="${esc(c.q)}">` : '')
      + `<label class="srv-item"><input type="checkbox" data-act="all" ${all ? 'checked' : ''}><span>${q ? `تحديد كل نتائج البحث (${vis.length})` : 'تحديد الكل'}</span></label>`
      + `<div class="srv-list">${vis.length ? vis.map((i) => `<label class="srv-item ${c.sel.has(i.value) ? 'checked' : ''}"><input type="checkbox" data-v="${esc(i.value)}" ${c.sel.has(i.value) ? 'checked' : ''}><span>${esc(i.label)}</span></label>`).join('') : '<div class="srv-empty">لا توجد نتائج مطابقة</div>'}</div>`;
  }
  function paintPop(keepFocus) {
    const c = cols[openKey];
    if (!c) return;
    pop.classList.toggle('wide', c.type === 'date');
    let body;
    if (c.type === 'list') body = listHTML(c);
    else if (c.type === 'text') body = `<input class="srv-input" data-act="text" aria-label="${esc(c.label)}" value="${esc(c.text)}">`;
    else {
      body = `<div class="srv-presets">${PRESETS.map((x) => `<button type="button" class="srv-preset ${c.preset === x[0] ? 'active' : ''}" data-preset="${x[0]}">${x[1]}</button>`).join('')}</div>`
        + `<div class="srv-field"><span>شهر محدد</span><input type="month" class="srv-input" data-act="month" aria-label="شهر محدد" value="${c.preset === 'month' ? c.from.slice(0, 7) : ''}"></div>`
        + `<div class="srv-row"><div class="srv-field"><span>من تاريخ</span><input type="date" class="srv-input" data-act="from" aria-label="من تاريخ" value="${esc(c.from)}"></div>`
        + `<div class="srv-field"><span>إلى تاريخ</span><input type="date" class="srv-input" data-act="to" aria-label="إلى تاريخ" value="${esc(c.to)}"></div></div>`;
    }
    const focused = keepFocus && pop.contains(document.activeElement) ? document.activeElement.dataset.act : null;
    pop.innerHTML = `<div class="srv-pop-top"><span class="srv-pop-title">${esc(c.label)}</span><button type="button" class="srv-pop-clear" data-act="clear">مسح الاختيار</button></div><div class="srv-pop-body">${body}</div>`;
    if (focused) { const el = pop.querySelector(`[data-act="${focused}"]`); if (el) { el.focus(); if (el.setSelectionRange && el.type === 'text') { const n = el.value.length; el.setSelectionRange(n, n); } } }
  }
  function place(btn) {
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    pop.style.left = left + 'px';
    pop.style.top = (r.bottom + 6) + 'px';
    pop.style.maxHeight = Math.max(200, window.innerHeight - r.bottom - 16) + 'px';
  }
  function open(key) {
    close();
    openKey = key;
    const c = cols[key];
    c.q = '';
    pop.classList.add('open');
    paintPop(false);
    place(c.btn);
    c.btn.classList.add('open'); c.btn.setAttribute('aria-expanded', 'true');
    const first = pop.querySelector('input[data-act="q"], input[data-act="text"]');
    if (first) first.focus();
  }
  function close() {
    if (openKey) { const b = cols[openKey].btn; b.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); }
    openKey = null; pop.classList.remove('open');
  }

  function clearCol(c) { c.sel.clear(); c.text = ''; c.from = ''; c.to = ''; c.preset = ''; }
  function setRange(c, from, to, preset) { c.from = from || ''; c.to = to || ''; c.preset = preset || ''; }

  // ─── أحداث النافذة (delegation) ───
  pop.addEventListener('click', (e) => {
    const c = cols[openKey]; if (!c) return;
    const t = e.target;
    if (t.dataset.act === 'clear') { clearCol(c); paintPop(false); changed(true); return; }
    if (t.dataset.preset) { const r = presetRange(t.dataset.preset); setRange(c, r[0], r[1], t.dataset.preset); paintPop(false); changed(true); close(); }
  });
  pop.addEventListener('change', (e) => {
    const c = cols[openKey]; if (!c) return;
    const t = e.target, a = t.dataset.act;
    if (c.type === 'list') {
      if (a === 'all') {
        const q = c.q.trim().toLowerCase();
        (q ? c.items.filter((i) => i.label.toLowerCase().includes(q)) : c.items).forEach((i) => (t.checked ? c.sel.add(i.value) : c.sel.delete(i.value)));
      } else if (t.dataset.v !== undefined) {
        t.checked ? c.sel.add(t.dataset.v) : c.sel.delete(t.dataset.v);
      } else return;
      paintPop(true); changed(false);
    } else if (c.type === 'date') {
      if (a === 'month') {
        const [yy, mm] = t.value.split('-').map(Number);
        if (!yy || !mm) return;
        setRange(c, `${yy}-${p2(mm)}-01`, `${yy}-${p2(mm)}-${p2(new Date(Date.UTC(yy, mm, 0)).getUTCDate())}`, 'month');
      } else if (a === 'from' || a === 'to') {
        setRange(c, a === 'from' ? t.value : c.from, a === 'to' ? t.value : c.to, '');
      } else return;
      paintPop(false); changed(false);
    }
  });
  pop.addEventListener('input', (e) => {
    const c = cols[openKey]; if (!c) return;
    const a = e.target.dataset.act;
    if (a === 'q') { c.q = e.target.value; paintPop(true); }
    else if (a === 'text') { c.text = e.target.value; changed(false); }
  });
  pop.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.act === 'text') { close(); } });

  // ─── الشيبس والمسح الشامل ───
  const chipsEl = $(cfg.chips);
  if (chipsEl) chipsEl.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k]'); if (!b) return;
    const c = cols[b.dataset.k]; if (!c) return;
    if (c.type === 'list') c.sel.delete(b.dataset.v); else clearCol(c);
    if (openKey === c.key) paintPop(false);
    changed(true);
  });
  const clearEl = $(cfg.clearBtn);
  if (clearEl) clearEl.addEventListener('click', () => clearAll());
  function clearAll() { Object.values(cols).forEach(clearCol); if (openKey) paintPop(false); changed(true); }

  // ─── إغلاق: ضغطة برّه · Esc · سكرول/ريسايز ───
  // ⚠️ الحارس الأول إلزامي (Standards #32): الاختيار بيعمل re-render فالعنصر المضغوط
  //    بيتشال من الـ DOM قبل ما الحدث يوصل هنا، و contains(detached) بترجّع false.
  document.addEventListener('click', (e) => {
    if (!openKey || !document.contains(e.target)) return;
    if (pop.contains(e.target) || cols[openKey].btn.contains(e.target)) return;
    close();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openKey) { const b = cols[openKey].btn; close(); b.focus(); } });
  window.addEventListener('resize', close);
  window.addEventListener('scroll', (e) => { if (openKey && !pop.contains(e.target)) close(); }, true);

  // ─── زرار القمع في كل ترويسة ───
  Object.values(cols).forEach((c) => {
    if (!c.th) return;
    c.th.setAttribute('data-eco-nofilter', '');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'th-flt eco-tbl-skip';
    b.setAttribute('aria-label', `فلتر ${c.label}`); b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false');
    b.innerHTML = SVG;
    // ⚠️ الضغطة ماتوصلش للترويسة — الترويسة نفسها ممكن تكون ترتيب (onclick)
    b.addEventListener('click', (e) => { e.stopPropagation(); openKey === c.key ? close() : open(c.key); });
    c.th.appendChild(b); c.btn = b;
  });
  renderChips();

  return {
    params, active, clearAll, close, refresh: renderChips,
    setItems(key, items) { cols[key].items = items; if (openKey === key) paintPop(true); renderChips(); },
    label(key, value) { const i = cols[key].items.find((x) => x.value === value); return i ? i.label : value; },
  };
}
