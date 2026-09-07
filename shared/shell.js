// ══════════════════════════════════════════════════════════════
// shared/shell.js — مركز عمليات المخزن (Warehouse-Operations-Center)
// skills: html-builder v6.6.0 · worker-builder v2.1.0 · constants v1.10.0 · order-lifecycle v1.2.0 — 06-09-2026
// ══════════════════════════════════════════════════════════════
//
// 🔴 **نسخة واحدة مضمّنة — ممنوع الملف ده يتنسخ في أي صفحة.**
//    نسخة تانية معناها إن الصفحتين هيفترقوا مع أول تعديل، وده بالظبط
//    الوضع اللي أنتج باج R1 بين `Ready-to-Pack` و`Orders-Packing-Checker`
//    (منطق واحد في ملفين، اتصلح في واحد وفضل مكسور في التاني لشهور).
//
// 🔴 **القايمة السودا — الدوال دي ممنوع تدخل هنا:**
//
//      switchMainTab · finishLogin · runDiag · renderLogTable · fetchLog
//      renderPagination · goPage · lookupOrder · currentOrder · applySort
//      sortConfig · msState · msToggle · anyFilterActive · clearAllFilters
//
//    من ٦١ اسم مشترك بين الطابعة والتغليف، ~١٥ منهم **منطقهم مختلف فعلاً**
//    مش مجرد تنسيق. حطّهم في الـ shell = تكسر صفحة أو اتنين **بصمت**.
//    كل واحد فيهم يفضل في صفحته.
//
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// §CONFIG — الـ Workers في مكان واحد
// ══════════════════════════════════════════════════════════════
//
// ⚠️ الروابط **مش أسرار** (Standards #28) — الحماية في السر + CORS
//    allowlist. مالهاش مكان في شاشة الإعدادات ولا في التخزين المحلي.
//
// كل Worker ومعاه **أقل نسخة** الهب بيشتغل معاها. الحد الأدنى لكل Worker
// لوحده — مالهمش أي علاقة ببعض ولا بـ `TOOL_VERSION`.
//
// ⚠️ `min` مايترفعش إلا لما الهب **يعتمد فعلاً** على حاجة جديدة في الـ
//    Worker ده (Standards #29). ترفيعه بلا سبب = تحذير كاذب على أي
//    rollback مشروع.
const WOC_WORKERS = {
  // 2.5.0 = أول نسخة فيها `bosta_lookup`/`bosta_awb` و`allZones` في `/orders`
  // و`doc: 'AWB'` في `/track` — قناة بوسطة مش موجودة أصلاً من غيرهم.
  // و2.4.0 كانت أول نسخة فيها `POST /lookup` (كارت إعادة الطباعة).
  // `print.html` **معتمدة على الاتنين فعلاً**، فالترفيع مشروع (Standards #29).
  printer: { url: 'https://order-printer-worker.ecommoda-dev.workers.dev',          min: '2.5.0', label: 'الطباعة' },
  // 2.5.0 = أول نسخة بتقبل `appId` في `verify_employee`/`log_logout`.
  // من غيرها الدخول بيتسجّل `pack_checker` **في صمت** بدل اسم الهب —
  // وده بالظبط نوع الفشل اللي الحارس ده اتكتب عشانه.
  pack:    { url: 'https://orders-packing-checker-worker.ecommoda-dev.workers.dev', min: '2.5.0', label: 'التغليف' },
  remover: { url: 'https://order-item-remover-worker.ecommoda-dev.workers.dev',     min: '1.4.0', label: 'حذف منتج' },
  // 1.1.0 = أول نسخة بتقبل `get_order?id=` (البحث بالـ ID الرقمي).
  // `sku-barcode.html` **معتمدة عليها فعلاً** من v1.10.0: باركود الأوردر
  // المطبوع بيشفّر الـ ID الرقمي (١٠ خانات فأكتر) مش اسم الأوردر، فماسح
  // باركود شوبيفاي على Worker 1.0.0 بيرجّع «رقم الأوردر مطلوب» على كل
  // مسح. الترفيع مشروع (Standards #29).
  // الأداة **قراءة بحتة**: مفيش D1 ومفيش endpoints دخول — الدخول بيحصل
  // في الهب عبر Worker التغليف.
  barcode: { url: 'https://order-sku-barcode-printer-worker.ecommoda-dev.workers.dev', min: '1.1.0', label: 'باركود SKU' },
};

const TOOL_VERSION = 'v1.10.0';                      // الهب كله — مصدر واحد (#24)
const LS_SECRET    = 'warehouse_ops_worker_secret';  // مفتاح مجموعة warehouse_ops (#39)
const WOC_APP_ID   = 'warehouse_ops_center';         // قيمة `tool` في D1 — login/logout بس
const SHOP_HANDLE  = '6c7e1a-53';

// 🔴 السر (`LS_SECRET`) هو **الحاجة الوحيدة** في التخزين المحلي في الريبو
//    كله (#28 · #39). الهوية في sessionStorage، والروابط ثوابت في الكود.
//    الهوية في sessionStorage، والروابط ثوابت في الكود.
function getSecret()      { try { return localStorage.getItem(LS_SECRET) || ''; } catch { return ''; } }
function setSecret(v)     { try { localStorage.setItem(LS_SECRET, v); } catch {} }
function isConfigured()   { return getSecret().trim().length > 0; }

// ══════════════════════════════════════════════════════════════
// §SESSION — الهوية في sessionStorage (استثناء موثّق من بند ٥)
// ══════════════════════════════════════════════════════════════
//
// ⚠️ `sessionStorage` **مش** التخزين الدائم — بيموت مع قفل التاب، ولكل
//    تاب لوحده، ومابيديش أي صلاحية جديدة (`employee` بيتبعت من العميل في
//    كل كتابة **النهاردة كمان** — الـ Worker بيتحقق من السر مش من هوية
//    الموظف). ده استثناء موثّق من `ecommoda-html-builder` بند ٥، سببه إن
//    الهب متعدد الصفحات فالذاكرة مابتعيشش عبر التنقل.
//    راجع `CLAUDE.md` § الاستثناءان المعتمدان.
//
// ⚠️ كل قراءة/كتابة جوّه try/catch — المتصفح في وضع خاص أو بحظر التخزين
//    بيرمي على **مجرد الوصول**، والرمي ده كان هيمنع فتح الصفحة أصلاً.

const WOC_SESSION_KEY  = 'woc_session';       // الهوية
const WOC_CACHE_PRINT  = 'woc_queue_print';   // كاش طابور الطباعة
const WOC_CACHE_PACK   = 'woc_queue_pack';    // كاش طابور التغليف
const WOC_CACHE_TTL_MS = 15 * 60 * 1000;      // ١٥ دقيقة

function getSession() {
  try {
    const raw = sessionStorage.getItem(WOC_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    // `v` نسخة العقد — لو الشكل اتغيّر، القديم بيترفض بدل ما يتقري غلط
    if (s?.v !== 1 || !s.username || !s.displayName) return null;
    return s;
  } catch { return null; }
}

function setSession(username, displayName) {
  try {
    sessionStorage.setItem(WOC_SESSION_KEY, JSON.stringify({
      v: 1, username, displayName, loginAt: new Date().toISOString(),
    }));
  } catch {}
}

function clearSession() {
  try {
    sessionStorage.removeItem(WOC_SESSION_KEY);
    sessionStorage.removeItem(WOC_CACHE_PRINT);
    sessionStorage.removeItem(WOC_CACHE_PACK);
  } catch {}
}

// الحارس — بيتنادى في **أول سطر** في كل صفحة غير `index.html`.
// بيرجّع الجلسة أو بيحوّل لشاشة الدخول ومعاها وجهة الرجوع.
//
// 🔴 **بيرمي عن قصد.** من غير الرمي، باقي سكربت الصفحة بيكمّل تنفيذ
//    وبينادي الـ Worker وبيرسم جدول **أثناء** ما التحويل شغّال — نداءات
//    ضايعة ووميض شاشة. الرمي بيوقف السكربت فورًا.
//
// ⚠️ `location.replace` مش `location.href` — عشان صفحة محمية مايتسجّلش
//    لها مدخل في تاريخ المتصفح. زرار الرجوع بعد الخروج مايرجعش لشاشة فاضية.
function requireSession() {
  const s = getSession();
  if (!s) {
    const next = location.pathname.split('/').pop() + location.search;
    location.replace(`index.html?next=${encodeURIComponent(next)}`);
    throw new Error('no session');
  }
  return s;
}

// ── كاش الطوابير ──────────────────────────────────────────────
// الشاشة الفاضية أسوأ من شاشة قديمة **مختومة بوقتها**.
function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c?.at || !c?.data) return null;
    return { ...c, ageMs: Date.now() - new Date(c.at).getTime() };
  } catch { return null; }
}

function cacheSet(key, data) {
  // ⚠️ QuotaExceededError ممكن يحصل — الكاش **تحسين مش شرط**، فالفشل
  //    بيتبلع بصمت والصفحة بتشتغل عادي بجلب جديد.
  try { sessionStorage.setItem(key, JSON.stringify({ at: new Date().toISOString(), data })); }
  catch {}
}

// ══════════════════════════════════════════════════════════════
// §API — مصنع بدل دوال عامة
// ══════════════════════════════════════════════════════════════
//
// كل صفحة بتنادي Worker مختلف، فالـ api بيتبني بالـ URL بتاعه.
//
// ⚠️ `apiRequest` دي **نسخة `Orders-Packing-Checker`** — بتعلّق `status`
//    و`payload` على الاستثناء. `pack.html` محتاجاهم لمسار الـ 409
//    («اتغلّف قبل كده»). الصفحات التانية مش بتقراهم فمفيش تعارض.
//
// ⚠️ بتفرّق بين تلات حالات كانوا بيدّوا نفس الرسالة الغامضة:
//    «الـ Worker رد بخطأ» · «مقدرناش نوصله أصلاً» (CORS/واقع) · «رد مش JSON».
//    والرسالة بتسمّي **الأداة** — الهب بينادي تلات Workers، ورسالة بلا
//    اسم بتخلّي الموظف يدوّر في التلاتة.
function wocApi(worker) {
  const base = worker.url.replace(/\/$/, '');

  async function apiRequest(url, opts) {
    const secret = getSecret();
    if (!secret) { openSettings(); throw new Error('الإعدادات غير مكتملة — أدخل الـ WORKER SECRET'); }
    let resp;
    try {
      resp = await fetch(url, {
        ...opts,
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${secret}`,
          ...(opts?.headers || {}),
        },
      });
    } catch (e) {
      throw new Error(`تعذّر الوصول لـ Worker ${worker.label} — راجع الاتصال أو حالة الـ Worker: ${e.message}`);
    }
    const text = await resp.text();
    let data;
    try { data = text ? JSON.parse(text) : null; }
    catch { throw new Error(`رد غير متوقع من Worker ${worker.label} (HTTP ${resp.status}): ${text.slice(0, 160)}`); }
    if (!resp.ok) {
      const err = new Error(data?.error || `HTTP ${resp.status}`);
      err.status  = resp.status;
      err.payload = data;
      throw err;
    }
    return data;
  }

  return {
    apiGet:  (action, params = {}) => apiRequest(`${base}/?${new URLSearchParams({ action, ...params })}`, { method: 'GET' }),
    apiPost: (action, body = {})   => apiRequest(`${base}/?action=${encodeURIComponent(action)}`, { method: 'POST', body: JSON.stringify(body) }),
    // ⚠️ الطابعة بترّوت بالـ path كمان (`/orders` · `/invoice` · `/track` ·
    //    `/logs`) — شكل تاريخي متساب **عمدًا**، مش غلط يتصلّح.
    apiPath: (path, body = {})     => apiRequest(`${base}${path}`, { method: 'POST', body: JSON.stringify(body) }),
  };
}

// ══════════════════════════════════════════════════════════════
// §HELPERS
// ══════════════════════════════════════════════════════════════

// تهريب HTML — **مصدر واحد للريبو كله**. أي `rdyEsc`/`escapeHtml` في صفحة
// لازم يبقى اسم تاني لنفس الدالة دي، مش نسخة منها.
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Date/Time — القاهرة (UTC+3) · datetime-format.md ──────────
function toCairo(iso) { return new Date(new Date(iso).getTime() + 3 * 60 * 60 * 1000); }

function formatDateTime(iso) {
  const d = toCairo(iso), pad = n => String(n).padStart(2, '0');
  let h = d.getUTCHours();
  const ampm = h >= 12 ? 'مساءً' : 'صباحاً';
  h = h % 12 || 12;
  return `📅 ${pad(d.getUTCDate())}/${pad(d.getUTCMonth()+1)}/${d.getUTCFullYear()} 🕐 ${pad(h)}:${pad(d.getUTCMinutes())} ${ampm}`;
}
function formatDate(iso) {
  const d = toCairo(iso), pad = n => String(n).padStart(2, '0');
  return `📅 ${pad(d.getUTCDate())}/${pad(d.getUTCMonth()+1)}/${d.getUTCFullYear()}`;
}
function formatTimeOnly(iso) {
  const d = toCairo(iso), pad = n => String(n).padStart(2, '0');
  let h = d.getUTCHours();
  const ampm = h >= 12 ? 'مساءً' : 'صباحاً';
  h = h % 12 || 12;
  return `🕐 ${pad(h)}:${pad(d.getUTCMinutes())} ${ampm}`;
}
function formatDateForExport(iso) {
  const d = toCairo(iso), pad = n => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth()+1)}-${d.getUTCFullYear()}`;
}
function formatTimeForExport(iso) {
  const d = toCairo(iso), pad = n => String(n).padStart(2, '0');
  let h = d.getUTCHours();
  const ampm = h >= 12 ? 'مساءً' : 'صباحاً';
  h = h % 12 || 12;
  return `${pad(h)}:${pad(d.getUTCMinutes())} ${ampm}`;
}

// اليوم بتوقيت القاهرة كـ YYYY-MM-DD.
// ⚠️ لازم يتحسب من `toCairo` مش من `iso.slice(0,10)` — التانية بتقفل
//    اليوم الساعة ٣ صباحًا بتوقيتنا، فأوردر اتعمل ١١ مساءً بيتحسب على
//    اليوم اللي بعده.
function cairoDayStr(dateLike) {
  const iso = dateLike instanceof Date ? dateLike.toISOString() : dateLike;
  const d = toCairo(iso), pad = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// فرق **الأيام التقويمية** بتوقيت القاهرة — مش (الآن − الوقت)/86400000.
// أوردر اتطبع ١١ مساءً بيبقى «متأخر يوم» الساعة ١ صباحًا، وده الصح للمخزن:
// «عدّى اليوم» معناها التاريخ اتغيّر، مش إن ٢٤ ساعة عدّت.
function cairoDayIndex(dateLike) {
  const d = toCairo(dateLike instanceof Date ? dateLike.toISOString() : dateLike);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000);
}

// صيغ الجمع العربية — «٢ دقيقة» و«٣ يوم» غلط لغويًا وبتقلّل الثقة في الشاشة
function arMin(n)  { return n <= 0 ? 'أقل من دقيقة' : n === 1 ? 'دقيقة' : n === 2 ? 'دقيقتين' : n <= 10 ? `${n} دقايق`  : `${n} دقيقة`; }
function arHour(n) { return n === 1 ? 'ساعة'  : n === 2 ? 'ساعتين' : n <= 10 ? `${n} ساعات` : `${n} ساعة`; }
function arDay(n)  { return n === 1 ? 'يوم'   : n === 2 ? 'يومين'  : n <= 10 ? `${n} أيام`  : `${n} يوم`; }

// «منذ كام» من ختم وقت — مستخدمة في ختم الكاش وفي لوحة «آخر تحديث»
function sinceText(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return 'الآن';
  if (mins < 60) return `منذ ${arMin(mins)}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `منذ ${arHour(hrs)}`;
  return `منذ ${arDay(Math.floor(hrs / 24))}`;
}

// سلّم قِدَم «آخر تحديث» — **مصدر واحد للريبو كله**.
//
// 🔴 كان معرّف جوّه `index.html` لوحده، ولما `stats.html` احتاجت نفس اللوحة
//    كان الاختيار: نسخة تانية ولا مصدر واحد. النسخة التانية هي بالظبط اللي
//    أنتجت باج R1 (منطق واحد في ملفين، اتصلح في واحد وفضل مكسور في التاني).
//    والقاعدة في `CLAUDE.md` صريحة: لوحة بشكلين مختلفين لنفس المعلومة =
//    الموظف بيتعلّمها مرتين.
//
// ⚠️ `at` بيتاخد **Date أو null**، و`now` بالملّي — التوقيع ده مقصود عشان
//    النبضة تنادي الدالة بـ `Date.now()` واحدة لكل الصفوف بدل قراءة جديدة
//    للساعة مع كل صف.
function agoInfo(at, now) {
  if (!at) return { cls: '', text: 'لسه ما اتحدّثش', stale: false };
  const mins = Math.max(0, Math.floor((now - at.getTime()) / 60000));
  if (mins < 1)  return { cls: 'ago-fresh', text: '⏱ منذ لحظات', stale: false };
  if (mins < 5)  return { cls: 'ago-fresh', text: `⏱ منذ ${arMin(mins)}`, stale: false };
  if (mins < 15) return { cls: 'ago-ok',    text: `⏱ منذ ${arMin(mins)}`, stale: false };
  if (mins < 60) return { cls: 'ago-warn',  text: `⏱ منذ ${arMin(mins)} — يفضّل تحدّث`, stale: true };
  return { cls: 'ago-stale', text: `⏱ منذ ${arHour(Math.floor(mins / 60))} — الرقم قديم، حدّث`, stale: true };
}

// ── رابط الأوردر على شوبيفاي (قاعدة #20) ──────────────────────
function shopifyOrderUrl(orderId) {
  return `https://admin.shopify.com/store/${SHOP_HANDLE}/orders/${orderId}`;
}
// ⚠️ أوردر من غير `id` بيرجع **نص عادي** مش لينك بلا هدف — لينك رايح لـ
//    `orders/undefined` أسوأ من نص: الموظف بيفتحه ويلاقي صفحة خطأ
//    ويفتكر الأوردر اتمسح.
function orderLink(orderNumber, orderId) {
  const label = orderNumber || '—';
  if (!orderId) return `<span class="order-num">${esc(label)}</span>`;
  return `<a class="order-link" target="_blank" rel="noopener" href="${shopifyOrderUrl(orderId)}">${esc(label)}</a>`;
}

// ── حد أدنى رقمي، مش تطابق حرفي ───────────────────────────────
function cmpVersion(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

// ── صفارة ─────────────────────────────────────────────────────
let wocAudioCtx = null;
function playBeep(type) {
  try {
    if (!wocAudioCtx) wocAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = wocAudioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if (type === 'warn') {
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.setValueAtTime(520, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.32, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'success') {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.setValueAtTime(200, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.35);
    }
  } catch {}
}

// ══════════════════════════════════════════════════════════════
// §UI — التوست · الإعدادات · النسخة · About/Changelog · الخروج
// ══════════════════════════════════════════════════════════════

function showToast(msg, type = 'neutral', duration = 3000) {
  const box = document.getElementById('toastContainer');
  if (!box) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

// ── الإعدادات — السر بس (الروابط ثوابت، #28) ──────────────────
function openSettings() {
  const f = document.getElementById('cfgSecret');
  if (f) f.value = getSecret();
  const dg = document.getElementById('diagResult');
  if (dg) dg.innerHTML = '';
  document.getElementById('settingsOverlay')?.classList.add('open');
}
function closeSettings()            { document.getElementById('settingsOverlay')?.classList.remove('open'); }
function closeSettingsOnBackdrop(e) { if (e.target === e.currentTarget) closeSettings(); }

function updateSettingsBtn() {
  document.getElementById('settingsBtn')?.classList.toggle('settings-configured', isConfigured());
  const lb = document.getElementById('loginSettingsBtn');
  if (lb) { const ok = isConfigured(); lb.classList.toggle('ready', ok); lb.classList.toggle('missing', !ok); }
}

// ⚠️ الصفحة اللي عندها شغل بعد الحفظ (تحميل قائمة الموظفين مثلاً) بتعرّف
//    `onSettingsSaved()` عندها — الـ shell مابيعرفش شغل الصفحة.
function saveSettings() {
  const secret = document.getElementById('cfgSecret').value.trim();
  if (!secret) { showToast('أدخل WORKER SECRET', 'error'); return; }
  setSecret(secret);
  updateSettingsBtn();
  closeSettings();
  showToast('تم حفظ الإعدادات ✓', 'success');
  if (typeof onSettingsSaved === 'function') onSettingsSaved();
}

// ── النسخة — مصدر واحد (#24) ──────────────────────────────────
function renderVersionUI() {
  const verBtn = document.getElementById('verBtn');
  if (verBtn) verBtn.textContent = `${TOOL_VERSION} 📋`;
  const clBadge = document.getElementById('clLatestVerBadge');
  if (clBadge) clBadge.textContent = TOOL_VERSION;
  const loginVer = document.getElementById('loginVersionText');
  if (loginVer) loginVer.textContent = TOOL_VERSION;
  updateSettingsBtn();
}

function openChangelog()  { document.getElementById('changelogOverlay')?.classList.add('open'); }
function closeChangelog() { document.getElementById('changelogOverlay')?.classList.remove('open'); }
function openAbout()      { document.getElementById('aboutOverlay')?.classList.add('open'); }
function closeAbout()     { document.getElementById('aboutOverlay')?.classList.remove('open'); }

// ── الفحص الذاتي — **ممنوع يعرض قيمة أي سر** ──────────────────
//
// 🔴 **التلات Workers بيرجّعوا `checks` بشكلين مختلفين** — الهب بينادي
//    التلاتة، فلازم يفهم الاتنين:
//      · الطباعة والتغليف → **مصفوفة** `[{ ok, label|name, detail }]`
//      · حذف منتج          → **كائن عادي** `{ d1: 'ok', oauth: 'FAILED: …' }`
//    نسخة v1.0.0 كانت بتعمل `for…of` على الاتنين، فالكائن كان بيرمي
//    «object is not iterable» و**بيوقّف الفحص كله** عند أول Worker
//    بالشكل ده — يعني الموظف مايشوفش نتيجة الأدوات اللي بعده.
//
// ⚠️ في شكل الكائن مفيش `ok` صريحة، فالحكم من القيمة والاسم:
//    `'ok'` ✅ · بتبدأ بـ `FAILED` ❌ · الاسم منتهي بـ `Error`/`Warning` ⚠️ ·
//    غير كده **معلومة** ℹ️ (زي `accessScopes` و`envKeys`) — مش نجاح ولا فشل.
function diagRows(checks) {
  if (!checks) return [];
  const line = (icon, label, detail) =>
    `<div class="diag-line"><span>${icon}</span><span>${esc(label)}${detail ? ' — <span class="diag-detail">' + esc(detail) + '</span>' : ''}</span></div>`;

  if (Array.isArray(checks)) {
    return checks.map(c => line(c.ok ? '✅' : '❌', c.label || c.name || '', c.detail || ''));
  }
  if (typeof checks !== 'object') return [line('ℹ️', String(checks), '')];

  return Object.entries(checks).map(([k, v]) => {
    const txt = (v && typeof v === 'object') ? JSON.stringify(v) : String(v);
    let icon = 'ℹ️';
    if (/(Error|Warning)$/.test(k))      icon = '⚠️';
    else if (/^FAILED/i.test(txt))       icon = '❌';
    else if (txt === 'ok' || v === true) icon = '✅';
    else if (v === false)                icon = '❌';
    return line(icon, k, txt);
  });
}

// الصفحة بتعرّف `PAGE_WORKERS` (المفاتيح اللي بتناديها)، والفحص بيمشي
// عليها واحد واحد ويسمّي كل Worker باسمه. الأسماء والأطوال بس — مفيش
// قيمة سر (البصمة القصيرة في `diag` هي اللي بتثبت إن السر واحد).
async function wocRunDiag() {
  const box = document.getElementById('diagResult');
  const btn = document.getElementById('diagBtn');
  if (!box) return;
  const keys = (typeof PAGE_WORKERS !== 'undefined' && PAGE_WORKERS.length)
    ? PAGE_WORKERS : Object.keys(WOC_WORKERS);
  box.innerHTML = 'جارٍ الفحص...';
  if (btn) btn.disabled = true;
  const out = [];
  for (const k of keys) {
    const w = WOC_WORKERS[k];
    try {
      const d = await wocApi(w).apiGet('diag');
      const ver = d.version || d.WORKER_VERSION || '—';
      const behind = cmpVersion(ver, w.min) < 0;
      out.push(`<div class="diag-line"><span>${behind ? '⚠️' : 'ℹ️'}</span><span><b>${esc(w.label)}</b> — نسخة <code>${esc(ver)}</code> (الحد الأدنى <code>${esc(w.min)}</code>)</span></div>`);
      out.push(...diagRows(d.checks));
    } catch (e) {
      out.push(`<div class="diag-line"><span>❌</span><span><b>${esc(w.label)}</b> — ${esc(e.message)}</span></div>`);
    }
  }
  box.innerHTML = out.join('');
  if (btn) btn.disabled = false;
}

// ── حارس النسخة — **لازم يسمّي الـ Worker** ────────────────────
// الهب بينادي تلات Workers بتلات حدود دنيا مستقلة. رسالة «الـ Worker
// نسخة قديمة» من غير اسم الأداة بتخلّي الموظف يدوّر في التلاتة.
let wocStaleMsgs = [];
async function checkWorkerVersion(keys) {
  // ⚠️ بلا سر مفيش فحص نسخة **أصلاً**. من غير الحارس ده أول نداء بيقع في
  //    `apiRequest` اللي بيفتح شاشة الإعدادات — فتطلع فوق شاشة الدخول
  //    وتغطّي زرار الإعدادات اللي جوّه الكارت (Standards #4). الموظف
  //    بيلاقي نافذة فتحت لوحدها من غير ما يضغط حاجة.
  if (!isConfigured()) return;
  for (const k of keys) {
    const w = WOC_WORKERS[k];
    if (!w) continue;
    try {
      const { apiGet } = wocApi(w);
      const cfg = await apiGet('get_config');
      const got = cfg.version || cfg.WORKER_VERSION;
      if (got && cmpVersion(got, w.min) < 0) {
        wocStaleMsgs.push(
          `Worker ${w.label} نسخته ${got} والهب محتاج ${w.min} على الأقل — ` +
          `التحديث على ما يبدو ما نزلش. راجع Deployments و Promote في كلاودفلير.`
        );
        const btn = document.getElementById('verStaleBtn');
        if (btn) {
          btn.style.display = '';
          btn.textContent = wocStaleMsgs.length === 1
            ? `⚠️ Worker ${w.label} نسخة قديمة`
            : `⚠️ ${wocStaleMsgs.length} Workers نسخة قديمة`;
        }
      }
    } catch { /* الفشل هنا مش تحذير نسخة — الأداة نفسها هتبلّغ عند أول نداء */ }
  }
}
function showWorkerStale() {
  if (!wocStaleMsgs.length) return;
  showToast(wocStaleMsgs.join(' · '), 'error', 9000);
}

// ── الخروج ────────────────────────────────────────────────────
// ⚠️ `appId` بيتبعت هنا كمان — من غيره صف الـ `logout` بيتسجّل
//    `pack_checker` والدخول `warehouse_ops_center`، فالزوج مايتقفلش.
// ⚠️ الجلسة والكاش بيتمسحوا **حتى لو** نداء التسجيل فشل — الخروج فعل
//    محلي، ومانسيبش موظف داخل عشان D1 ما ردّتش.
async function doLogout() {
  const s = getSession();
  try {
    if (s?.username) {
      await wocApi(WOC_WORKERS.pack).apiGet('log_logout', { username: s.username, appId: WOC_APP_ID });
    }
  } catch { /* الخروج بيتم برضه */ }
  clearSession();
  location.replace('index.html');
}

// ══════════════════════════════════════════════════════════════
// §HEADER — الهيدر الموحّد
// ══════════════════════════════════════════════════════════════
//
// الترتيب RTL (القراءة من اليمين للشمال):
//
//   [العنوان]  ←→  [🏠 الرئيسية في النص]  ←→  [extras] [ℹ️] [vX.Y.Z 📋] [اسم ✕] [⚙️]
//
// ⚠️ `⚙️ الإعدادات` **آخر عنصر** في ترتيب القراءة = أقصى الشمال بصريًا
//    (Step 3 · Header Button Order). الأدوات التلاتة الحالية مش متطابقة
//    في الترتيب ده — الهب بيوحّده.
// ⚠️ `🏠 الرئيسية` **أول عنصر** (أقصى اليمين، جنب العنوان) — مكان الرجوع
//    الطبيعي. في `index.html` الزرار ده مايتعرضش (`home: false`).
function wocHeader(opts = {}) {
  const { icon = '📦', title = '', subtitle = '', home = true, extras = '', session = null } = opts;
  // 🔴 زرار الرئيسية **في المنطقة الوسطى** ومصمت أزرق (قرار أحمد 06-09-2026).
  //    ده انحراف مقصود عن Step 3 (الرئيسية أول عنصر في قراءة RTL) —
  //    السبب إن الموظف بيرجع منه من كل أداة، وكان بيتوه وسط زراير
  //    بنفس الشكل بالظبط. موثّق في `CLAUDE.md` §الهيدر الموحّد.
  const homeZone = home
    ? `<div class="app-header-center"><button class="hbtn hbtn-home" onclick="location.href='index.html'" title="الشاشة الرئيسية">🏠 الرئيسية</button></div>`
    : '';
  // زرار الموظف **هو** زرار الخروج — ✕ بدل كلمة «خروج»، و👤 اتشالت
  // لأن الاسم لوحده كافي. `aria-label` بيحافظ على الوضوح لقارئ الشاشة.
  const userBtn = session
    ? `<button class="hbtn active-user" id="activeUserBtn" onclick="doLogout()" title="تسجيل الخروج — ${esc(session.displayName)}" aria-label="تسجيل الخروج">`
      + `<span>${esc(session.displayName)}</span><span class="user-x" aria-hidden="true">✕</span></button>`
    : '';
  return `
    <div class="app-header${home ? ' has-center' : ''}">
      <div class="app-title">
        <span class="app-icon">${icon}</span>
        <div class="app-title-text">
          <h1>${esc(title)}</h1>
          <span>${esc(subtitle)}</span>
        </div>
      </div>
      ${homeZone}
      <div class="app-header-btns">
        ${extras}
        <button class="hbtn" id="verStaleBtn" style="display:none" onclick="showWorkerStale()">⚠️ الـ Worker نسخة قديمة</button>
        <button class="hbtn" onclick="openAbout()">ℹ️ عن الأداة</button>
        <button class="hbtn ver-btn" id="verBtn" onclick="openChangelog()">v1.0.0 📋</button>
        ${userBtn}
        <button class="hbtn" id="settingsBtn" onclick="openSettings()">⚙️ الإعدادات</button>
      </div>
    </div>`;
}

// المودالات المشتركة (الإعدادات) — بتتحقن في كل صفحة عشان ماتتكررش في
// الـ HTML. الـ About والـ Changelog **بيفضلوا في صفحتهم** لأن محتواهم
// مختلف من صفحة للتانية.
function wocSharedModals() {
  return `
    <div class="settings-overlay" id="settingsOverlay" onclick="closeSettingsOnBackdrop(event)">
      <div class="settings-modal">
        <div class="settings-modal-hdr">
          <span>⚙️ الإعدادات</span>
          <button class="modal-close-x" onclick="closeSettings()">✕</button>
        </div>
        <div class="settings-modal-body">
          <div class="settings-field">
            <label class="settings-label">WORKER SECRET</label>
            <!-- ⚠️ من غير placeholder — Step 2 بند ٧ في ecommoda-html-builder.
                 الشرح مكانه الـ label فوق والسطر الثابت تحت، مش نص رمادي جوّه
                 الحقل بيختفي أول ما الموظف يكتب حرف.
                 ⚠️ التعليق ده جوّه template literal — ممنوع أي backtick فيه. -->
            <input type="password" class="settings-input" id="cfgSecret" autocomplete="off">
            <div class="settings-static">السر المشترك لمجموعة <code>warehouse_ops</code> — قيمة واحدة للأربع Workers</div>
          </div>
          <div class="settings-field">
            <label class="settings-label">الـ Workers</label>
            <div class="settings-static">order-printer-worker · orders-packing-checker-worker · order-item-remover-worker · order-sku-barcode-printer-worker</div>
          </div>
          <div class="settings-field">
            <label class="settings-label">فحص النظام</label>
            <button class="btn-outline" id="diagBtn" onclick="wocRunDiag()">🩺 افحص الأداة والاتصالات</button>
            <div class="diag-box" id="diagResult"></div>
          </div>
        </div>
        <div class="settings-modal-ftr">
          <button class="btn-modal-cancel" onclick="closeSettings()">إلغاء</button>
          <button class="btn-modal-save" onclick="saveSettings()">حفظ</button>
        </div>
      </div>
    </div>
    <div class="toast-container" id="toastContainer"></div>`;
}
