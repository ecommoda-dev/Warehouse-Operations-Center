// ══════════════════════════════════════════════════════════════
// shared/core.js — النواة المشتركة بين هب المخزن وهب الشحن والتحصيل
// ══════════════════════════════════════════════════════════════
//
// 🔴 **الملف ده نسختين متطابقتين بالبايت** — واحدة في كل ريبو
//    (`Warehouse-Operations-Center` · `Delivery-COD-Operations-Center`)، ومفيش
//    ريبو «أصل». الهبّين ريبوهين منفصلين وكل واحد على GitHub Pages بتاعه
//    فالنسخ حتمي. **أي تعديل هنا يتعمل في الاتنين في نفس التمريرة.**
//    الفحص: `bash docs/core-twin-check.sh` — بيقارن ويقول الفرق بس،
//    **مابينسخش ولا بيعدّل**. أحمد هو اللي بيقرر أنهي نسخة الصح.
//
// 🔴 **الـ core مايعرفش أسماء طوابير ولا Workers ولا صفحات أي هب.** كل حاجة
//    خاصة بهب بتيجي من `shared/hub-config.js` (`ECO_WORKERS` · `TOOL_VERSION`
//    · `LS_SECRET` · `SHOP_HANDLE` · مفاتيح الجلسة والكاش · `ECO_HUB`)،
//    وقواعد المجال في ملف المجال بتاع الهب (`gates.js` · `dco-rules.js`).
//    ترتيب التحميل: `hub-config.js` ← `core.js` ← ملف المجال.
//
// 🔴 **القايمة السودا — الدوال دي ممنوع تدخل هنا:**
//
//      switchMainTab · finishLogin · runDiag · renderTable · applySort
//      sortConfig · msState · msToggle · anyFilterActive · clearAllFilters
//
//    منطقهم بيفرق من صفحة للتانية فعلاً. كل واحد فيهم يفضل في صفحته.
//
// البادئة `eco` محايدة (كانت `woc` في المخزن و`dco` في الشحن).
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// §SECRET — سر المجموعة (المفتاح `LS_SECRET` في hub-config.js)
// ══════════════════════════════════════════════════════════════


// 🔴 السر (`LS_SECRET`) هو **الحاجة الوحيدة** في التخزين المحلي في الريبو
//    كله (#28 · #39). الهوية في sessionStorage، والروابط ثوابت في الكود.
function getSecret()      { try { return localStorage.getItem(LS_SECRET) || ''; } catch { return ''; } }
function setSecret(v)     { try { localStorage.setItem(LS_SECRET, v); } catch {} }
function isConfigured()   { return getSecret().trim().length > 0; }

// ══════════════════════════════════════════════════════════════
// §SESSION — الهوية في sessionStorage (استثناء موثّق من بند ٥)
// ══════════════════════════════════════════════════════════════

// 🔴 **الرئيسية بتترسم من الكاش لو عمره أقل من ده — من غير أي نداء** (v1.38.0
//    · قرار أحمد 14-10-2026). التحديث التلقائي اتلغى، فالرجوع للرئيسية بـ 🏠
//    كان هيبقى أتقل نداء في الهب (٥ نداءات كل رجوع) لو ماكانش فيه الحد ده.
//    ⚠️ أقدم من كده = جلب جديد عادي، والموظف مايشوفش رقم قديم أول ما يفتح.
const ECO_CACHE_TTL_MS  = 10 * 60 * 1000;      // ١٠ دقايق

function getSession() {
  try {
    const raw = sessionStorage.getItem(ECO_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    // `v` نسخة العقد — لو الشكل اتغيّر، القديم بيترفض بدل ما يتقري غلط
    if (s?.v !== 1 || !s.username || !s.displayName) return null;
    return s;
  } catch { return null; }
}

function setSession(username, displayName) {
  try {
    sessionStorage.setItem(ECO_SESSION_KEY, JSON.stringify({
      v: 1, username, displayName, loginAt: new Date().toISOString(),
    }));
    sessionStorage.setItem(ECO_IDLE_KEY, String(Date.now()));   // §IDLE — بداية العدّ من الدخول
  } catch {}
}

// 🔴 مفاتيح الكاش اللي بتتمسح مع الخروج بتيجي من `ECO_HUB.clearKeys` في
//    `hub-config.js` — الـ core مايعرفش أسماء طوابير أي هب.
function clearSession() {
  try {
    sessionStorage.removeItem(ECO_SESSION_KEY);
    for (const k of ECO_HUB.clearKeys) sessionStorage.removeItem(k);
    sessionStorage.removeItem(ECO_IDLE_KEY);
  } catch {}
}

// الحارس — بيتنادى في **أول سطر** في كل صفحة غير `index.html`.
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


// ══════════════════════════════════════════════════════════════
// §API — مصنع بدل دوال عامة
// ══════════════════════════════════════════════════════════════
//
// كل صفحة بتنادي Worker مختلف، فالـ api بيتبني بالـ URL بتاعه.
//
// ⚠️ `apiRequest` دي **نسخة `Orders-Packing-Checker`** — بتعلّق `status`
//    و`payload` على الاستثناء. `Orders-Packing-Checker.html` محتاجاهم لمسار الـ 409
//    («اتغلّف قبل كده»). الصفحات التانية مش بتقراهم فمفيش تعارض.
//
// ⚠️ بتفرّق بين تلات حالات كانوا بيدّوا نفس الرسالة الغامضة:
//    «الـ Worker رد بخطأ» · «مقدرناش نوصله أصلاً» (CORS/واقع) · «رد مش JSON».
//    والرسالة بتسمّي **الأداة** — الهب بينادي تلات Workers، ورسالة بلا
//    اسم بتخلّي الموظف يدوّر في التلاتة.
//
// 🔴 **مهلة صريحة على كل نداء** (اتضافت في v1.22.0 مع سكانرات بوسطة).
//    من غيرها الـ Worker الواقف بيسيب الزرار معطّل والـ spinner بيلف
//    **للأبد** (المتصفح ممكن يستنى دقايق) — والموظف بيفتكر إن الأداة
//    اتعلّقت فبيعمل refresh **وسط عملية كتابة**. ودي مش حالة نظرية: هي
//    بالظبط عيلة الفشل اللي أنتجت ٥٩ صف فشل كذّاب في سجل سكانر المرتجعات
//    (الشاشة ما اتغيّرتش بعد النجاح فالموظف ضغط تاني).
//    ⚠️ الرقم طويل عن قصد — دفعة كاملة بتاخد عشرات الثواني، والقطع بدري
//       أسوأ من الانتظار.
//    ⚠️ ورسالة الـ timeout **بتقول للموظف يراجع السجل قبل الإعادة** —
//       «ما ردّش» ≠ «ما اتنفّذش»، والكتابة ممكن تكون تمّت فعلاً.
const ECO_API_TIMEOUT_MS = 90000;

function ecoApi(worker) {
  const base = worker.url.replace(/\/$/, '');

  async function apiRequest(url, opts) {
    const secret = getSecret();
    if (!secret) { openSettings(); throw new Error('الإعدادات غير مكتملة — أدخل الـ WORKER SECRET'); }
    // `cancelSignal` اختياري: إلغاء يدوي من الموظف (زرار «إلغاء» في تحميل الباركودات
    // بجرد المخزون). مفيش مستهلك تاني — باقي الصفحات مابتبعتهوش فالسلوك زي ما هو.
    const { cancelSignal, ...fetchOpts } = opts || {};
    let resp;
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ECO_API_TIMEOUT_MS);
    if (cancelSignal) {
      if (cancelSignal.aborted) ctrl.abort();
      else cancelSignal.addEventListener('abort', () => ctrl.abort(), { once: true });
    }
    try {
      resp = await fetch(url, {
        ...fetchOpts,
        signal: ctrl.signal,
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${secret}`,
          ...(opts?.headers || {}),
        },
      });
    } catch (e) {
      if (e.name === 'AbortError' && cancelSignal && cancelSignal.aborted) {
        const ce = new Error('اتلغى'); ce.cancelled = true; throw ce;
      }
      if (e.name === 'AbortError')
        throw new Error(`Worker ${worker.label} ما ردّش خلال ${ECO_API_TIMEOUT_MS / 1000} ثانية — راجع السجل قبل ما تعيد المحاولة، ممكن تكون العملية تمّت`);
      throw new Error(`تعذّر الوصول لـ Worker ${worker.label} — راجع الاتصال أو حالة الـ Worker: ${e.message}`);
    } finally {
      clearTimeout(timer);
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
    apiGet:  (action, params = {}, cancelSignal) => apiRequest(`${base}/?${new URLSearchParams({ action, ...params })}`, { method: 'GET', cancelSignal }),
    apiPost: (action, body = {})   => apiRequest(`${base}/?action=${encodeURIComponent(action)}`, { method: 'POST', body: JSON.stringify(body) }),
    // ⚠️ الطابعة بترّوت بالـ path كمان (`/orders` · `/invoice` · `/track` ·
    //    `/logs`) — شكل تاريخي متساب **عمدًا**، مش غلط يتصلّح.
    apiPath: (path, body = {})     => apiRequest(`${base}${path}`, { method: 'POST', body: JSON.stringify(body) }),
    // `action` في جسم الطلب نفسه — الراوتينج المختلط في `cod-payment-center-worker`.
    apiPostRoot: (action, body = {}) => apiRequest(`${base}/`, { method: 'POST', body: JSON.stringify({ action, ...body }) }),
  };
}

// ══════════════════════════════════════════════════════════════
// §HELPERS
// ══════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════
// §HELPERS
// ══════════════════════════════════════════════════════════════

// تهريب HTML — **مصدر واحد للريبو كله**. أي `escapeHtml` في صفحة لازم
// يبقى اسم تاني لنفس الدالة دي، مش نسخة منها.
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// حالة «جاري الاستعلام» الموحّدة (v1.36.0) — نفس الشكل والنص في كل الأدوات.
// ⚠️ الـ CSS (`.eco-loadbox`) في `shared/core.css` §LOADBOX. `msg` اختياري،
//    `small` للاستخدام جوّه خلية جدول.
const ECO_LOADING_MSG = '⏳ جاري الاستعلام عن الأوردرات برجاء الانتظار ...';
function ecoLoadingHTML(msg, small) {
  return '<div class="eco-loadbox' + (small ? ' is-sm' : '') + '" role="status" aria-live="polite">'
    + '<span class="eco-load-spin" aria-hidden="true"></span>'
    + '<div class="eco-load-title">' + esc(msg || ECO_LOADING_MSG) + '</div></div>';
}

// ── التوقيت — `Africa/Cairo` **يتحسب**، مايتكتبش ثابت ─────────
//
// 🔴 **ودي مش نسخة من هب المخزن — دي النسخة الصح.** الشِل هناك لسه شايل
//    `toCairo = +3 ساعات` ثابتة، وهو بالظبط النمط اللي `ecommoda-constants`
//    §13 بيسمّيه **كاسر**: مصر بترجع UTC+2 يوم **29-10-2026**، وساعتها كل
//    وقت معروض بيغلط بساعة **والأداة مابتشتكيش**. الهب ده بيبدأ صح من أول
//    يوم، فمحتاجش أي تدخل يوم التحويل.
// ⚠️ والدوال دي **نفس نسخة الـ Worker بالحرف** (`ecommoda-constants` §13).
const CAIRO_TZ = 'Africa/Cairo';
const _cairoFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAIRO_TZ, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

// 🔴 **حارس `Invalid Date` إلزامي.** `formatToParts` بترمي `RangeError` على
//    تاريخ باظ، وصف واحد بتاريخ غلط كان كفاية **يوقّع رسم الجدول كله** —
//    يعني الطابور بيختفي بالكامل عشان صف واحد. بترجّع `null` والمستدعي
//    بيعرض `—`.
function cairoParts(dateLike) {
  // 🔴 **`null` و`''` لازم يترفضوا صراحةً قبل `new Date`.**
  //    `new Date(null)` بيرجّع **1970-01-01 صالح** (مش `Invalid Date`)، يعني
  //    أوردر مالوش تاريخ كان بياخد بادج أحمر بيقول «متأخر ٢٠٬٧٠٠ يوم» بدل
  //    «—». الفحص بـ`isNaN` لوحده **مابيمسكش الحالة دي**.
  //    ⚠️ اتمسك في `docs/rules-check.mjs` — مش في مراجعة كود ولا في فحص
  //       المتصفح (البيانات الوهمية كلها كان ليها تواريخ).
  if (dateLike === null || dateLike === undefined || dateLike === '') return null;
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (isNaN(d.getTime())) return null;
  try {
    const o = {};
    for (const p of _cairoFmt.formatToParts(d)) if (p.type !== 'literal') o[p.type] = p.value;
    if (o.hour === '24') o.hour = '00';   // حارس: بعض المحركات بترجّع 24
    return o;
  } catch { return null; }
}

function _ampm(p) {
  let h = Number(p.hour);
  const ampm = h >= 12 ? 'مساءً' : 'صباحاً';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${p.minute} ${ampm}`;
}

// فرق القاهرة عن UTC بالملّي ثانية عند اللحظة `t` (ms) — ٧٢٠٠٠٠٠ شتاءً · ١٠٨٠٠٠٠٠ صيفًا.
function cairoOffsetMs(t) {
  const o = {};
  for (const p of _cairoFmt.formatToParts(new Date(t))) if (p.type !== 'literal') o[p.type] = p.value;
  const h = o.hour === '24' ? 0 : +o.hour;     // حارس: بعض المحركات بترجّع 24
  const wall = Date.UTC(+o.year, +o.month - 1, +o.day, h, +o.minute, +o.second);
  return wall - Math.floor(t / 1000) * 1000;
}

function toCairo(iso) {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return new Date(NaN);
  return new Date(t + cairoOffsetMs(t));
}

// بداية يوم القاهرة (`YYYY-MM-DD`) كلحظة UTC بالملّي — بدل `T00:00:00Z - ٣ ساعات`.
function cairoDayStartMs(dayStr) {
  const guess = Date.parse(`${dayStr}T00:00:00Z`);
  if (isNaN(guess)) return NaN;
  const t0 = guess - cairoOffsetMs(guess);
  return guess - cairoOffsetMs(t0);
}

function formatDate(iso) {
  const p = cairoParts(iso);
  return p ? `📅 ${p.day}/${p.month}/${p.year}` : '—';
}
function formatTimeOnly(iso) {
  const p = cairoParts(iso);
  return p ? `🕐 ${_ampm(p)}` : '—';
}
function formatDateTime(iso) {
  const p = cairoParts(iso);
  return p ? `📅 ${p.day}/${p.month}/${p.year} 🕐 ${_ampm(p)}` : '—';
}
function formatDateForExport(iso) {
  const p = cairoParts(iso);
  return p ? `${p.day}-${p.month}-${p.year}` : '';
}
function formatTimeForExport(iso) {
  const p = cairoParts(iso);
  return p ? _ampm(p) : '';
}
// ── أرضية تاريخ الأوردر — `YYYY-MM-DD` → `DD/MM/YYYY` ─────────
// 🔴 **في الـ shell مش في الصفحة** — `Package-Transfer-To-Office.html` و
//    `Package-Transfer-To-Warehouse.html` الاتنين بيعرضوا نفس السطر من نفس الرد، ونسخة
//    في كل صفحة هي درس R1 بالحرف.
// ⚠️ **ومافيهاش `new Date()`** — القيمة **تاريخ مجرّد** جاي من الـ Worker،
//    و`new Date('2026-04-01')` بتتقرا UTC وبتتعرض بتوقيت الجهاز، فأرضية
//    `01/04` كانت ممكن تتعرض `31/03` على جهاز غرب جرينتش. القصّ النصّي هنا
//    **مقصود**: مفيش وقت في القيمة أصلاً عشان يتحوّل.
function ecoYmdToDMY(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

// اليوم بتوقيت القاهرة كـ YYYY-MM-DD.
// ⚠️ لازم يتحسب من `cairoParts` مش من `iso.slice(0,10)` — التانية بتقفل
//    اليوم الساعة ٢ أو ٣ صباحًا بتوقيتنا، فأوردر اتعمل ١١ مساءً بيتحسب
//    على اليوم اللي بعده.
function cairoDayStr(dateLike) {
  const p = cairoParts(dateLike);
  return p ? `${p.year}-${p.month}-${p.day}` : null;
}

// إضافة أيام لـ`YYYY-MM-DD` بحساب تاريخ مجرّد (UTC) — مش `Date.now() - 24h`، لأن
// الأخيرة بتنزلق ساعة حوالين تغيير التوقيت وبتدّي «امبارح» غلط. بتتستخدم في
// الشاشة الرئيسية (§HOME-DONE) و`stats.html` — نسخة واحدة (درس R1).
function ecoAddDays(dayStr, n) {
  const [y, m, d] = dayStr.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1, d) + n * 86400000), pad = v => String(v).padStart(2, '0');
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

// رقم اليوم التقويمي بتوقيت القاهرة — أساس كل فرق بالأيام.
function cairoDayIndex(dateLike) {
  const p = cairoParts(dateLike);
  if (!p) return null;
  return Math.floor(Date.UTC(+p.year, +p.month - 1, +p.day) / 86400000);
}

// صيغ الجمع العربية — «٢ دقيقة» و«٣ يوم» غلط لغويًا وبتقلّل الثقة في الشاشة
function arMin(n)  { return n <= 0 ? 'أقل من دقيقة' : n === 1 ? 'دقيقة' : n === 2 ? 'دقيقتين' : n <= 10 ? `${n} دقايق`  : `${n} دقيقة`; }
function arHour(n) { return n === 1 ? 'ساعة'  : n === 2 ? 'ساعتين' : n <= 10 ? `${n} ساعات` : `${n} ساعة`; }
function arDay(n)  { return n === 1 ? 'يوم'   : n === 2 ? 'يومين'  : n <= 10 ? `${n} أيام`  : `${n} يوم`; }

function sinceText(iso) {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '—';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1)  return 'الآن';
  if (mins < 60) return `منذ ${arMin(mins)}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `منذ ${arHour(hrs)}`;
  return `منذ ${arDay(Math.floor(hrs / 24))}`;
}

// سلّم قِدَم «آخر تحديث» — **مصدر واحد للريبو كله**.
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

// ── العمر بفرق **الأيام التقويمية** بتوقيت القاهرة ────────────
//
// 🔴 مش `(الآن − الوقت) / 86400000`. أوردر اتعمل ١١ مساءً بيبقى «منذ أمس»
//    الساعة ١ صباحًا، وده الصح للمخزن والشحن: «عدّى اليوم» معناها **التاريخ
//    اتغيّر**، مش إن ٢٤ ساعة عدّت. أي «تبسيط» للطرح المباشر بيكسر الدلالة.
function ecoDayDiff(iso, now) {
  const a = cairoDayIndex(now), b = cairoDayIndex(iso);
  if (a === null || b === null) return null;
  return a - b;
}

// درجة اللون من فرق الأيام — **مصدر واحد** لكل الأعمدة المحسوبة بالوقت.
// النص هو اللي بيفرق بين «عمر الأوردر» و«الوقت منذ التغليف»، مش اللون.
function ecoDayLevel(days) {
  if (days === null) return 'tb-none';
  if (days <= 0) return 'tb-d0';
  if (days === 1) return 'tb-d1';
  if (days === 2) return 'tb-d2';
  if (days <  7)  return 'tb-d3';
  return 'tb-d7';
}

// عمر الأوردر — بالأيام **بس** (بادج صغير جوّه عمود تاريخ الأوردر).
// ⚠️ بترجّع `tb-none` للأوردر اللي مالوش تاريخ — بادج رمادي بشرطة، مش
//    خانة فاضية: «مش عارفين» معلومة، و«فاضي» بيتقري عطل.
function ecoOrderAge(iso, now = new Date()) {
  const days = ecoDayDiff(iso, now);
  if (days === null) return { cls: 'tb-none', text: '—' };
  const text = days <= 0 ? 'اليوم' : days === 1 ? 'منذ أمس' : `منذ ${arDay(days)}`;
  return { cls: ecoDayLevel(days), text };
}

// ── رابط الأوردر على شوبيفاي (قاعدة #20) ──────────────────────
function shopifyOrderUrl(orderId) {
  return `https://admin.shopify.com/store/${SHOP_HANDLE}/orders/${orderId}`;
}

// 🔴 **رابط صفحة المتغيّر في الأدمن مركّب من الاتنين** (v1.17.0):
//    `/products/<productId>/variants/<variantId>`. `variantId` لوحده
//    **مايبنيش رابط صالح** — الأدمن بيرد صفحة خطأ، مش بيحوّل للمنتج.
//    عشان كده الدالة بترجّع `null` لو أي واحد فيهم ناقص، والمستدعي بيعرض
//    نص عادي — نفس منطق `orderLink` تحت بالحرف.
// ⚠️ **مكانها الـ shell مش الصفحة** — `Order-SKU-Barcode-Printer.html` بتستخدمها في
//    الجدول **وفي قايمة الاقتراحات**، وأي صفحة تانية هتعرض SKU هتحتاجها.
//    نسخة تانية معناها إن شكل الرابط يفترق مع أول تغيير في الأدمن (درس R1).
function shopifyVariantUrl(productId, variantId) {
  if (!productId || !variantId) return null;
  return `https://admin.shopify.com/store/${SHOP_HANDLE}/products/${productId}/variants/${variantId}`;
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

// ══════════════════════════════════════════════════════════════
// §MACHINE · COURIER — ماكينة الأوردر ومجموعة المندوب
// ══════════════════════════════════════════════════════════════

function ecoMachineByType(o) { return (o.type === 'S2' || o.orderType === 'S2') ? 'S2' : 'S1'; }

// ── الماكينة: الصف ده عن الشحنة الأصلية ولا دورة الاستبدال؟ ───
//
// 🔴 **الترتيب هو القرار:** S1 الأول. أوردر حالتَيه على نفس القيمة (مثلاً
//    `Ready` في الاتنين) بيتحسب **S1**، وبياخد علامة شذوذ — مش بيتقسم
//    لصفّين. صفّين لنفس الأوردر معناهم إن الرقم الكبير بيعدّه مرتين.
function ecoMachineByStatus(o, status) {
  if (o.s1 === status) return 's1';
  if (o.s2 === status) return 's2';
  return null;
}

// ── تجميع المندوب — بوسطة · شو روم · مناديب ───────────────────
//
// ⚠️ التطبيع بيشيل المسافات والشرطات والـ underscore: `Show_Room` و
//    `Show Room` و`showroom` و«شو روم» كلهم مربع واحد. مطابقة حرفية على
//    `Showroom` بالظبط كانت هتخلّي صف يقع في المربع الغلط.
// ⚠️ والفاضي بيقع في «مناديب» — «مفيش مندوب مسجل» **مش** بوسطة ولا شو روم،
//    وحطّه في مربع رابع كان هيدّي مربع بصفر في اليوم العادي.
function ecoCourierGroup(courier) {
  const k = String(courier || '').trim().toLowerCase().replace(/[\s_-]/g, '');
  if (k === 'bosta'    || k === 'بوسطة') return 'bosta';
  if (k === 'showroom' || k === 'شوروم') return 'showroom';
  return 'other';
}

// الترتيب **ثابت** (مش بالعدد): الترتيب بالعدد كان هيرقّص المربعات مكانها
// مع كل تحديث. ونفس الألوان ونفس الليبل في الرئيسية وفي الصفحتين.
const ECO_COURIER_GROUPS = [
  { key: 'other',    label: 'مناديب', cls: 'qc-courier'  },
  { key: 'bosta',    label: 'بوسطة',  cls: 'qc-bosta'    },
  { key: 'showroom', label: 'شو روم', cls: 'qc-showroom' },
];

// ⚠️ المفاتيح بتتبني من `ECO_COURIER_GROUPS` نفسها — مجموعة جديدة بتدخل
//    وبتطلع مربع عدّاده `undefined` لو الخريطة مكتوبة بالإيد.
function ecoCourierCounts(rows) {
  const out = Object.fromEntries(ECO_COURIER_GROUPS.map(g => [g.key, 0]));
  for (const r of rows || []) out[ecoCourierGroup(r.courier)]++;
  return out;
}

// ══════════════════════════════════════════════════════════════
// §BEEP — نغمات الصوت
// ══════════════════════════════════════════════════════════════


// ── صفارة ─────────────────────────────────────────────────────
let ecoAudioCtx = null;
function playBeep(type) {
  try {
    if (!ecoAudioCtx) ecoAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = ecoAudioCtx;
    if (type === 'alarm') {
      // 🔴 إنذار عالي ومميّز — ثلاث دقّات مربّعة (900→450). منقول بالحرف من
      //    `Inventory-Audit-Updater` (جرد المخزون): بيتنادى على باركود مجهول أو متكرر
      //    وقت المسح الجماعي، وبيقفل التنفيذ — لازم يتميّز عن نغمة الفشل العادية.
      const t0 = ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + i * 0.28;
        o.type = 'square'; o.connect(g); g.connect(ctx.destination);
        o.frequency.setValueAtTime(900, t); o.frequency.setValueAtTime(450, t + 0.13);
        g.gain.setValueAtTime(0.9, t); g.gain.setValueAtTime(0.9, t + 0.23);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.27);
        o.start(t); o.stop(t + 0.27);
      }
      return;
    }
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
    } else if (type === 'scan') {
      // 🔴 **بلبة السكانة — نغمة قصيرة عالية، مختلفة عن النجاح والفشل.**
      //    الفرع ده كان **ناقص من الـ shell** لحد v1.22.0، و`playBeep('scan')`
      //    كانت بتقع في الـ `else` تحت — يعني **نغمة الفشل النازلة** (300→200)
      //    بتطلع على كل رقم تتبع **بيتضاف بنجاح**. ودي أسوأ من السكوت: الموظف
      //    بيسكن ٨٢ ملصق وراه، وبيسمع «فشل» ٨٢ مرة على شغل تمام.
      //    ⚠️ **صفر خطأ في الكونسول** — الـ `else` بيرد على أي قيمة.
      //    القيم كلها منقولة بالحرف من الأداة المستقلة عشان الموظف اللي
      //    بيتنقّل بين الاتنين يسمع نفس البلبة.
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
    } else {
      // `error` وأي قيمة تانية — نغمة نازلة.
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
// 🔴 **الـ Workers في الستاك بيرجّعوا `checks` بتلات أشكال مختلفة**، والهب
//    بينادي أكتر من واحد فلازم يفهمهم كلهم:
//      · الجديد (والأداتين دول) → **مصفوفة** `[{ ok, label, detail, hint }]`
//      · أدوات قديمة            → **كائن** `{ d1: 'ok', oauth: 'FAILED: …' }`
//      · وشكل تالت              → كائن بندوده **كائنات** فيها `ok` صريحة
//    نسخة بتعمل `for…of` على الكائن بترمي «object is not iterable»
//    و**بتوقّف الفحص كله** عند أول Worker بالشكل ده.
//
// ⚠️ `hint` بيتعرض **بس لو الفحص فشل** — سطر «إزاي تصلّحها» تحت فحص ناجح
//    ضوضاء، وتحت فحص فاشل هو الحاجة الوحيدة المفيدة.
function diagRows(checks, labels = {}) {
  if (!checks) return [];
  const line = (icon, label, detail, hint) =>
    `<div class="diag-line"><span>${icon}</span><span>${esc(label)}`
    + (detail ? ' — <span class="diag-detail">' + esc(detail) + '</span>' : '')
    + (hint ? '<div class="diag-hint">↳ ' + esc(hint) + '</div>' : '')
    + `</span></div>`;

  if (Array.isArray(checks)) {
    return checks.map(c => line(c.ok ? '✅' : '❌', c.label || c.name || '', c.detail || '', c.ok ? '' : (c.hint || '')));
  }
  if (typeof checks !== 'object') return [line('ℹ️', String(checks), '', '')];

  return Object.entries(checks).map(([k, v]) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.ok === 'boolean') {
      const rest = Object.entries(v).filter(([kk]) => kk !== 'ok' && kk !== 'hint');
      const detail = rest.map(([kk, vv]) =>
        `${kk}: ${(vv && typeof vv === 'object') ? JSON.stringify(vv) : String(vv)}`).join(' · ');
      return line(v.ok ? '✅' : '❌', labels[k] || k, detail, v.ok ? '' : (v.hint || ''));
    }
    const txt = (v && typeof v === 'object') ? JSON.stringify(v) : String(v);
    let icon = 'ℹ️';
    if (/(Error|Warning)$/.test(k))      icon = '⚠️';
    else if (/^FAILED/i.test(txt))       icon = '❌';
    else if (txt === 'ok' || v === true) icon = '✅';
    else if (v === false)                icon = '❌';
    return line(icon, labels[k] || k, txt, '');
  });
}

// الصفحة بتعرّف `PAGE_WORKERS` (المفاتيح اللي بتناديها)، والفحص بيمشي
// عليها واحد واحد **ويسمّي كل Worker باسمه**.
async function ecoRunDiag() {
  const box = document.getElementById('diagResult');
  const btn = document.getElementById('diagBtn');
  if (!box) return;
  const keys = (typeof PAGE_WORKERS !== 'undefined' && PAGE_WORKERS.length)
    ? PAGE_WORKERS : Object.keys(ECO_WORKERS);
  box.innerHTML = 'جارٍ الفحص...';
  if (btn) btn.disabled = true;
  const out = [];
  for (const k of keys) {
    const w = ECO_WORKERS[k];
    try {
      const d = await ecoApi(w).apiGet('diag');
      const ver = d.version || d.WORKER_VERSION || '—';
      const behind = cmpVersion(ver, w.min) < 0;
      out.push(`<div class="diag-line"><span>${behind ? '⚠️' : 'ℹ️'}</span><span><b>${esc(w.label)}</b> — نسخة <code>${esc(ver)}</code> (الحد الأدنى <code>${esc(w.min)}</code>)</span></div>`);
      const labels = (typeof PAGE_DIAG_LABELS !== 'undefined') ? PAGE_DIAG_LABELS : {};
      out.push(...diagRows(d.checks, labels));
    } catch (e) {
      out.push(`<div class="diag-line"><span>❌</span><span><b>${esc(w.label)}</b> — ${esc(e.message)}</span></div>`);
    }
  }
  box.innerHTML = out.join('');
  if (btn) btn.disabled = false;
}

// ── حارس النسخة — **لازم يسمّي الـ Worker** ────────────────────
// رسالة «الـ Worker نسخة قديمة» من غير اسم الأداة بتخلّي الموظف يدوّر في
// التلاتة.
let ecoStaleMsgs = [];
async function checkWorkerVersion(keys) {
  // ⚠️ بلا سر مفيش فحص نسخة **أصلاً**. من غير الحارس ده أول نداء بيقع في
  //    `apiRequest` اللي بيفتح شاشة الإعدادات — فتطلع فوق شاشة الدخول
  //    وتغطّي زرار الإعدادات اللي جوّه الكارت (Standards #4).
  if (!isConfigured()) return;
  for (const k of keys) {
    const w = ECO_WORKERS[k];
    if (!w) continue;
    try {
      const { apiGet } = ecoApi(w);
      const cfg = await apiGet('get_config');
      const got = cfg.version || cfg.WORKER_VERSION;
      if (got && cmpVersion(got, w.min) < 0) {
        ecoStaleMsgs.push(
          `Worker ${w.label} نسخته ${got} والهب محتاج ${w.min} على الأقل — ` +
          `التحديث على ما يبدو ما نزلش. راجع Deployments و Promote في كلاودفلير.`
        );
        const btn = document.getElementById('verStaleBtn');
        if (btn) {
          btn.style.display = '';
          btn.textContent = ecoStaleMsgs.length === 1
            ? `⚠️ Worker ${w.label} نسخة قديمة`
            : `⚠️ ${ecoStaleMsgs.length} Workers نسخة قديمة`;
        }
      }
    } catch { /* الفشل هنا مش تحذير نسخة — الأداة نفسها هتبلّغ عند أول نداء */ }
  }
}
function showWorkerStale() {
  if (!ecoStaleMsgs.length) return;
  showToast(ecoStaleMsgs.join(' · '), 'error', 9000);
}

// ── الخروج (Standards #52) ────────────────────────────────────
// 🔴 **الخروج اليدوي فوري بلا أي تأكيد من الـ shell** (`confirm`/`showConfirm` ممنوعين)
//    — والضغط على اسم الموظف في الهيدر يطلّع. الحارسان: دفعة شغّالة (toast مش
//    تأكيد)، وخطّاف `onBeforeLogout()` الاختياري لصفحة عندها شغل ما اتحفظش (الجرد
//    الجماعي) — هو اللي بيسأل هناك، والـ shell مابيسألش.
// ⚠️ الخروج بينادي `ECO_WORKERS.auth` — نفس Worker الدخول بالضبط، بلا
//    `appId` (الاسم متحدّد في كود الـ Worker نفسه من v1.32.0). ونداء `log_logout`
//    ليه سقف ٣ ثواني — Worker بطيء مايعطّلش الخروج.
// ⚠️ الجلسة والكاش بيتمسحوا **حتى لو** نداء التسجيل فشل — الخروج فعل
//    محلي، ومانسيبش موظف داخل عشان D1 ما ردّتش.
function doLogout() {
  if (typeof onBeforeLogout === 'function') {
    if (onBeforeLogout() === false) return;
  } else if (ecoIdleBusy()) {
    showToast('فيه دفعة بتتنفّذ دلوقتي — استنى لحد ما تخلص', 'warning');
    return;
  }
  performLogout('manual');
}

// مسار واحد للخروج اليدوي والتلقائي. `reason`: 'manual' | 'idle'.
async function performLogout(reason = 'manual') {
  idleStop();
  const s = getSession();
  try {
    if (s?.username) {
      await Promise.race([
        ecoApi(ECO_WORKERS.auth).apiGet('log_logout', { username: s.username }),
        new Promise(r => setTimeout(r, 3000)),
      ]);
    }
  } catch { /* الخروج بيتم برضه */ }
  clearSession();                      // الجلسة + الكاش (حساس: أسماء وتليفونات وعناوين ومبالغ COD)
  location.replace(reason === 'idle' ? 'index.html?reason=idle' : 'index.html');
}

// ══════════════════════════════════════════════════════════════
// §IDLE — الخروج التلقائي لعدم النشاط (Standards #52)
// ══════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════
// §IDLE — الخروج التلقائي لعدم النشاط (Standards #52 · idle-logout.md)
// ══════════════════════════════════════════════════════════════
// 🔴 **60 دقيقة لكل الأدوات بلا استثناء** — ممنوع قيمة مختلفة لصفحة بعينها.
// 🔴 **مرة واحدة هنا مش في كل صفحة** — وآخر نشاط في `sessionStorage` (مش
//    متغيّر): كل صفحة في الهب reload كامل، والمتغيّر بيضيع مع التنقل.
// ⚠️ وقت فعلي (`Date.now()`) كل ٣٠ ث + عند `visibilitychange`/`focus` — مش
//    `setTimeout` واحد ٦٠ دقيقة (المتصفح بيبطّئه في الخلفية والجهاز لما ينام
//    بيوقفه).
// ⚠️ النشاط = `keydown/pointerdown/wheel/touchstart/scroll` على `document`.
//    ⛔ مش `mousemove` (ماوس مهزوز على المكتب ≠ موظف موجود) ولا أي polling.
//    السكانر بيبعت ضغطات مفاتيح فبيتحسب نشاط لوحده.
// ⚠️ الحماية على العميل بس — مش أمان حقيقي (الهوية من العميل أصلًا). الهدف:
//    ماتفضلش بيانات حساسة على شاشة مهجورة.
const IDLE_TIMEOUT_MIN = 60;
const IDLE_WARN_SEC    = 60;
const IDLE_CHECK_MS    = 30000;
const IDLE_THROTTLE_MS = 10000;

function idleGet() {
  try { return +sessionStorage.getItem(ECO_IDLE_KEY) || Date.now(); } catch { return Date.now(); }
}
function idleSet(t) { try { sessionStorage.setItem(ECO_IDLE_KEY, String(t)); } catch {} }
let idleLast = idleGet(), idleTimer = null, idleFast = null, idleDone = false;

// صفحة فيها دفعة شغّالة بتعرّف `window.shellIsBusy = () => …`، أو الهب نفسه
// بيعرّف `ECO_HUB.isBusy` في `hub-config.js` للصفحات اللي ما بتتعدّلش
// بالإيد (الأدوات المدموجة المتولّدة). الـ core مايعرفش أسماء صفحات.
function ecoIdleBusy() {
  try {
    if (typeof window.shellIsBusy === 'function' && window.shellIsBusy()) return true;
    if (typeof ECO_HUB.isBusy === 'function' && ECO_HUB.isBusy()) return true;
  } catch {}
  return false;
}

function idleMark() {
  const now = Date.now();
  if (now - idleLast < IDLE_THROTTLE_MS) return;
  idleLast = now; idleSet(now); idleHideWarn();
}

function idleWarnEl() {
  let el = document.getElementById('idleWarn');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'idleWarn'; el.className = 'idle-warn';
  el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-live', 'assertive');
  el.innerHTML =
    '<div class="idle-warn-txt"><div class="idle-warn-l1"></div><div class="idle-warn-l2"></div></div>'
    + '<button type="button" class="idle-warn-btn" id="idleWarnBtn">أنا موجود</button>';
  document.body.appendChild(el);
  el.querySelector('#idleWarnBtn').addEventListener('click', () => { idleLast = 0; idleMark(); });
  return el;
}
function idleShowWarn(sec) {
  const el = idleWarnEl();
  const name = getSession()?.displayName || '';
  el.querySelector('.idle-warn-l1').textContent = `سيتم تسجيل الخروج لعدم النشاط بعد ${sec} ثانية`;
  el.querySelector('.idle-warn-l2').textContent = `هل أنت موجود يا ${name}؟`;
  el.classList.add('visible');
}
function idleHideWarn() {
  const el = document.getElementById('idleWarn');
  if (el) el.classList.remove('visible');
}

function idleTick() {
  if (idleDone || !getSession()) return;
  if (ecoIdleBusy()) { idleLast = Date.now(); idleSet(idleLast); idleHideWarn(); return; }
  // صفحة/تاب تاني ممكن يكون جدّد. قراءة خام: مفتاح غايب = 0 (مش «دلوقتي»)
  // وإلا جلسة قديمة بلا مفتاح كانت هتفضل شغّالة للأبد.
  let stored = 0; try { stored = +sessionStorage.getItem(ECO_IDLE_KEY) || 0; } catch {}
  idleLast = Math.max(idleLast, stored);
  const limit  = IDLE_TIMEOUT_MIN * 60000;
  const idleMs = Date.now() - idleLast;
  if (idleMs >= limit) { idleStop(); idleHideWarn(); performLogout('idle'); return; }
  const remain = limit - idleMs;
  if (remain <= IDLE_WARN_SEC * 1000) idleShowWarn(Math.ceil(remain / 1000)); else idleHideWarn();
}

function idleStart() {
  idleDone = false;
  if (idleTimer) return;
  idleTimer = setInterval(idleTick, IDLE_CHECK_MS);
}
function idleStop() {
  idleDone = true;
  if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
  if (idleFast)  { clearInterval(idleFast);  idleFast = null; }
}
function idleInit() {
  ['keydown', 'pointerdown', 'wheel', 'touchstart', 'scroll'].forEach(ev =>
    document.addEventListener(ev, idleMark, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) idleTick(); });
  window.addEventListener('focus', idleTick);
  if (getSession()) {
    idleStart();
    idleTick();          // reload بعد غياب طويل → خروج فوري
    // بانر التحذير بيعدّ كل ثانية (الفحص الأساسي كل ٣٠ ث مش كفاية للعدّاد)
    idleFast = setInterval(() => {
      if (document.getElementById('idleWarn')?.classList.contains('visible')) idleTick();
    }, 1000);
  }
}
// ⚠️ حارس البيئة: فحص المنطق (rules-check.mjs) بيقيّم الملف في Node بلا DOM كامل
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') idleInit();

// ══════════════════════════════════════════════════════════════
// §HEADER — الهيدر الموحّد
// ══════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════
// §HEADER — الهيدر الموحّد
// ══════════════════════════════════════════════════════════════
//
// الترتيب RTL (القراءة من اليمين للشمال):
//
//   [العنوان]  ←→  [🏠 الرئيسية في النص]  ←→  [extras] [ℹ️] [vX.Y.Z 📋] [اسم ✕] [⚙️]
//
// ⚠️ `⚙️ الإعدادات` **آخر عنصر** في ترتيب القراءة = أقصى الشمال بصريًا
//    (Step 3 · Header Button Order).
// 🔴 **زرار الرئيسية في المنطقة الوسطى ومصمت أزرق** — انحراف مقصود عن
//    Step 3 (اللي بيقول أول عنصر في قراءة RTL)، منقول من هب المخزن بنفس
//    السبب: الموظف بيرجع منه من كل أداة، وكان بيتوه وسط زراير بنفس الشكل.
function ecoHeader(opts = {}) {
  const { icon = ECO_HUB.icon, title = '', subtitle = '', home = true, extras = '', session = null } = opts;
  const homeZone = home
    ? `<div class="app-header-center"><button class="hbtn hbtn-home" onclick="location.href='index.html'" title="الشاشة الرئيسية">🏠 الرئيسية</button></div>`
    : '';
  // زرار الموظف **هو** زرار الخروج — ✕ بدل كلمة «خروج»، و👤 اتشالت لأن
  // الاسم لوحده كافي. `aria-label` بيحافظ على الوضوح لقارئ الشاشة —
  // من غيره الزرار بيتقري «اسم الموظف» بس، بلا أي إشارة إنه بيخرّج.
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

// المودالات المشتركة (الإعدادات + حاوية التوست) — بتتحقن في كل صفحة عشان
// ماتتكررش في الـ HTML. الـ About والـ Changelog **بيفضلوا في صفحتهم**
// لأن محتواهم مختلف من صفحة للتانية.

// المودالات المشتركة (الإعدادات + حاوية التوست) — بتتحقن في كل صفحة عشان
// ماتتكررش في الـ HTML. الـ About والـ Changelog **بيفضلوا في صفحتهم**
// لأن محتواهم مختلف من صفحة للتانية.
function ecoSharedModals() {
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
            <!-- من غير placeholder — Step 2 بند ٧: الشرح مكانه الـ label
                 والسطر الثابت تحت، مش نص رمادي جوّه الحقل بيختفي أول ما
                 الموظف يكتب حرف. -->
            <input type="password" class="settings-input" id="cfgSecret" autocomplete="off">
            <div class="settings-static">${ECO_HUB.secretNote}</div>
          </div>
          <div class="settings-field">
            <label class="settings-label">الـ Workers</label>
            <div class="settings-static">${ECO_HUB.workersNote}</div>
          </div>
          <div class="settings-field">
            <label class="settings-label">فحص النظام</label>
            <button class="btn-outline" id="diagBtn" onclick="ecoRunDiag()">🩺 افحص الأداة والاتصالات</button>
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

// ══════════════════════════════════════════════════════════════
// §TABLE — فلاتر رأس العمود + عناوين ثابتة + سحب عرض الأعمدة (Standards #47 · #49 · #50 · #51)
// ══════════════════════════════════════════════════════════════
// 🔴 **مكوّن بيشتغل على الـ DOM الجاهز — مش جوّه رسم كل صفحة.** الصفحة بترسم جدولها زي ما هي، والمكوّن
//    بيحقن قمع ▽ ومقبض السحب في كل `<th>` وبيخفي/يظهر `<tr>` حسب قيمة الخلية. صفحة بتعيد رسم `<tbody>`
//    (جلب · ترتيب · تصفيح) بيتعاد عليها الفلتر لوحده (MutationObserver).
// 🔴 **التفعيل صريح:** الصفحة بتنادي `ecoTablesAuto()` مرة واحدة. صفحات DCO (فيها مكوّنها الخاص في
//    الجداول المولّدة) **مابتناديهاش** — غير كده الجدول هيتحقن مرتين.
// ⚠️ **الفلتر على الصفوف المعروضة بس.** جدول بتصفيح من السيرفر (السجلات) بيفلتر الصفحة الحالية — البار فوق
//    الجدول بيقول «N من M» عشان الموظف مايفتكرش إن ده كل السجل.
// ⚠️ **العرض مابيتغيّرش لحد ما الموظف يسحب أو يدوس دبل كليك** — أول سحب بيجمّد العروض على قياسها الحالي.
//    الجدول اللي ماحدّش لمسه بيفضل بتخطيطه الأصلي بالحرف.
// ⚠️ **`localStorage` للعروض تفضيل شاشة مش بيانات** — مايتمسحش مع الخروج، ومفتاحه واحد لكل صفحة.
// ⚠️ صف فيه `colspan` (تفاصيل · «مفيش نتيجة» · عنوان مجموعة) مابيتفلترش بنفسه — بيتبع الصف اللي قبله.
const ECO_TBL_LS = 'eco_col_widths_v1_' + ((typeof location !== 'undefined' && location.pathname.split('/').pop()) || 'page');
const ECO_DOM = typeof window !== 'undefined' && typeof window.addEventListener === 'function';   // rules-check بيحمّل الملف في Node
const ECO_TBL_MIN = 64, ECO_TBL_MAX = 700;
const ECO_TBL_SKIP = /^(إجراء|الإجراء|تحديد|اختيار|حذف|✓|#)?$/;
const ecoTblFilters = {};          // sig → { colKey: { sel:Set } | { q:string } }
let ecoTblPop = null, ecoTblPopCtx = null, ecoTblDrag = null, ecoTblBadge = null, ecoTblScanT = null;

function ecoTblLabel(th) {
  const c = th.cloneNode(true);
  c.querySelectorAll('.eco-hf,.eco-rz,svg,.eco-tbl-skip').forEach(n => n.remove());
  return (c.textContent || '').replace(/[▲▼↑↓⇅⇵↕▴▾]/g, '').replace(/\s+/g, ' ').trim();
}
function ecoTblHeads(t) { return [...t.querySelectorAll(':scope > thead > tr:last-child > th')]; }
function ecoTblSig(t) { return ecoTblHeads(t).map(ecoTblLabel).join('|'); }
function ecoTblCellText(td) {
  if (!td) return '';
  if (td.dataset && td.dataset.ecoV !== undefined) return td.dataset.ecoV;
  return (td.innerText || td.textContent || '').replace(/\s+/g, ' ').trim();
}
function ecoTblRows(t) { return t.tBodies[0] ? [...t.tBodies[0].children].filter(r => r.tagName === 'TR') : []; }
function ecoTblIsData(tr, n) { return tr.children.length === n && !tr.querySelector('td[colspan],th[colspan]'); }
function ecoTblEligible(t) {
  if (t.dataset.ecoNotable !== undefined || t.classList.contains('eco-tbl-on')) return false;
  if (t.closest('.eco-overlay,.eco-modal,#printArea,[data-eco-notable]')) return false;
  return ecoTblHeads(t).length >= 2 && !!t.tBodies[0];
}
function ecoTblState(t) { const s = ecoTblSig(t); return ecoTblFilters[s] || (ecoTblFilters[s] = {}); }
function ecoTblFilterable(th, i, t) {
  if (th.dataset.ecoNofilter !== undefined || th.querySelector('input')) return false;
  const l = ecoTblLabel(th);
  return !ECO_TBL_SKIP.test(l);
}

// ── التفعيل ──
function ecoTblEnhance(t) {
  const wrap = document.createElement('div'); wrap.className = 'eco-tbl-wrap';
  const bar = document.createElement('div'); bar.className = 'eco-tbl-bar'; bar.hidden = true;
  t.parentNode.insertBefore(bar, t); t.parentNode.insertBefore(wrap, t); wrap.appendChild(t);
  t.classList.add('eco-tbl-on');
  t._eco = { wrap, bar, frozen: false, w: {} };
  ecoTblInject(t);
  const mo = new MutationObserver(ms => {
    let head = false, body = false;
    ms.forEach(m => { const tg = m.target; if (tg.closest && tg.closest('thead')) head = true; else if (tg === t.tBodies[0] || (tg.closest && tg.closest('tbody'))) body = true; else if (tg === t) head = true; });
    clearTimeout(t._eco.T);
    t._eco.T = setTimeout(() => { if (head) ecoTblInject(t); ecoTblApply(t); }, 40);
  });
  mo.observe(t, { childList: true, subtree: true });
  t._eco.mo = mo;
  ecoTblApply(t);
}
function ecoTblInject(t) {
  const heads = ecoTblHeads(t), keys = heads.map((th, i) => ecoTblLabel(th) || ('c' + i));
  heads.forEach((th, i) => {
    if (ecoTblFilterable(th, i, t) && !th.querySelector(':scope > .eco-hf')) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'eco-hf'; b.setAttribute('aria-label', 'فلتر العمود');
      b.innerHTML = '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M1.5 2.5h13L9.5 8.7V13l-3 1.5V8.7z" fill="currentColor"/></svg>';
      b.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); ecoTblOpenPop(t, i, b); });
      th.appendChild(b);
    }
    if (!th.querySelector(':scope > .eco-rz')) {
      const h = document.createElement('span'); h.className = 'eco-rz'; h.setAttribute('aria-hidden', 'true'); th.appendChild(h);
    }
  });
  // مفتاح العمود على الـ th نفسه (للعروض المحفوظة)
  heads.forEach((th, i) => { th.dataset.ecoK = keys[i]; });
  // الأعمدة اتغيّرت (تبديل وضع) → العروض القديمة ملغية والتخطيط يرجع تلقائي
  const sig = keys.join('|');
  if (t._eco.sig && t._eco.sig !== sig) ecoTblUnfreeze(t);
  t._eco.sig = sig;
  if (!t._eco.loaded) { t._eco.loaded = true; ecoTblLoadW(t); }
  ecoTblUpdateIcons(t);
}

// ── الفلترة ──
function ecoTblActive(f) { return f && ((f.sel && f.sel.size) || (f.q && f.q.trim())); }
function ecoTblApply(t) {
  const st = ecoTblState(t), heads = ecoTblHeads(t), n = heads.length;
  const idx = {}; heads.forEach((th, i) => idx[th.dataset.ecoK] = i);
  const act = Object.keys(st).filter(k => ecoTblActive(st[k]) && idx[k] !== undefined);
  const rows = ecoTblRows(t); let total = 0, shown = 0, prevVisible = true;
  rows.forEach(tr => {
    if (!ecoTblIsData(tr, n)) { tr.classList.toggle('eco-tf-hide', act.length > 0 && !prevVisible); return; }
    total++;
    let ok = true;
    for (const k of act) {
      const f = st[k], v = ecoTblCellText(tr.children[idx[k]]);
      if (f.sel && f.sel.size) { if (!f.sel.has(v)) { ok = false; break; } }
      else if (f.q && f.q.trim() && !v.toLowerCase().includes(f.q.trim().toLowerCase())) { ok = false; break; }
    }
    tr.classList.toggle('eco-tf-hide', !ok); prevVisible = ok; if (ok) shown++;
  });
  const bar = t._eco.bar;
  if (act.length) {
    bar.hidden = false;
    bar.innerHTML = `<span>فلتر مفعّل — عرض <b>${shown}</b> من <b>${total}</b> (الصفوف المعروضة في الصفحة)</span><button type="button" class="eco-tbl-clear">✕ مسح كل الفلاتر</button>`;
    bar.querySelector('.eco-tbl-clear').onclick = () => { ecoTblClosePop(); Object.keys(st).forEach(k => delete st[k]); ecoTblApply(t); };
  } else { bar.hidden = true; bar.innerHTML = ''; }
  ecoTblUpdateIcons(t);
}
function ecoTblUpdateIcons(t) {
  const st = ecoTblState(t);
  ecoTblHeads(t).forEach(th => { const b = th.querySelector(':scope > .eco-hf'); if (b) b.classList.toggle('on', !!ecoTblActive(st[th.dataset.ecoK])); });
}

// ── القايمة العائمة ──
function ecoTblClosePop() { if (ecoTblPop) { ecoTblPop.remove(); ecoTblPop = null; ecoTblPopCtx = null; } }
function ecoTblValues(t, i) {
  const n = ecoTblHeads(t).length, m = new Map();
  ecoTblRows(t).forEach(tr => { if (!ecoTblIsData(tr, n)) return; const v = ecoTblCellText(tr.children[i]); m.set(v, (m.get(v) || 0) + 1); });
  return m;
}
function ecoTblOpenPop(t, i, anchor) {
  if (ecoTblPopCtx && ecoTblPopCtx.anchor === anchor) { ecoTblClosePop(); return; }
  ecoTblClosePop();
  const th = ecoTblHeads(t)[i], key = th.dataset.ecoK, st = ecoTblState(t), vals = ecoTblValues(t, i);
  const longest = Math.max(0, ...[...vals.keys()].map(v => v.length));
  const mode = (vals.size <= 30 && longest <= 40) ? 'list' : 'text';
  ecoTblPop = document.createElement('div'); ecoTblPop.className = 'eco-hpop'; document.body.appendChild(ecoTblPop);
  ecoTblPopCtx = { t, i, key, anchor, mode };
  const title = esc(ecoTblLabel(th));
  if (mode === 'text') {
    ecoTblPop.innerHTML = `<div class="eco-hpop-hd">${title}</div><div class="eco-hpop-body"><input type="text" class="eco-hpop-inp" aria-label="بحث في ${title}" autocomplete="off" value="${esc((st[key] && st[key].q) || '')}"><button type="button" class="eco-hpop-clr">✕ مسح الاختيار</button></div>`;
    const inp = ecoTblPop.querySelector('input');
    inp.addEventListener('input', () => { clearTimeout(inp._t); inp._t = setTimeout(() => { if (inp.value.trim()) st[key] = { q: inp.value }; else delete st[key]; ecoTblApply(t); }, 150); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ecoTblClosePop(); } });
    ecoTblPop.querySelector('.eco-hpop-clr').onclick = () => { delete st[key]; inp.value = ''; ecoTblApply(t); };
    setTimeout(() => inp.focus(), 0);
  } else {
    const items = [...vals.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ar'));
    const draw = () => {
      const sel = (st[key] && st[key].sel) || new Set();
      ecoTblPop.innerHTML = `<div class="eco-hpop-hd">${title}</div><div class="eco-hpop-top"><button type="button" class="eco-hpop-clr">✕ مسح الاختيار</button><button type="button" class="eco-hpop-all">تحديد الكل</button></div><div class="eco-hpop-list">` +
        items.map(([v, c], j) => `<label class="eco-hpop-item${sel.has(v) ? ' on' : ''}"><input type="checkbox" data-j="${j}" ${sel.has(v) ? 'checked' : ''}><span>${v === '' ? '— فاضي —' : esc(v)}</span><em>${c}</em></label>`).join('') + `</div>`;
      ecoTblPop.querySelector('.eco-hpop-clr').onclick = () => { delete st[key]; ecoTblApply(t); draw(); ecoTblPlace(); };
      ecoTblPop.querySelector('.eco-hpop-all').onclick = () => { st[key] = { sel: new Set(items.map(x => x[0])) }; ecoTblApply(t); draw(); ecoTblPlace(); };
      ecoTblPop.querySelectorAll('input[data-j]').forEach(cb => cb.addEventListener('change', () => {
        const cur = (st[key] && st[key].sel) || new Set(), v = items[+cb.dataset.j][0];
        if (cb.checked) cur.add(v); else cur.delete(v);
        if (cur.size) st[key] = { sel: cur }; else delete st[key];
        ecoTblApply(t); draw(); ecoTblPlace();
      }));
    };
    draw();
  }
  ecoTblPlace();
}
function ecoTblPlace() {
  if (!ecoTblPop || !ecoTblPopCtx) return;
  const a = ecoTblPopCtx.anchor;
  if (!document.contains(a)) { ecoTblClosePop(); return; }
  const r = a.getBoundingClientRect(), pw = ecoTblPop.offsetWidth, ph = ecoTblPop.offsetHeight;
  let left = r.left + r.width / 2 - pw / 2; left = Math.max(8, Math.min(left, innerWidth - pw - 8));
  let top = r.bottom + 6; if (top + ph > innerHeight - 8) top = Math.max(8, r.top - ph - 6);
  ecoTblPop.style.left = left + 'px'; ecoTblPop.style.top = top + 'px';
}
ECO_DOM && document.addEventListener('mousedown', e => {
  // 🔴 حارس `document.contains` — القايمة بتتعاد رسمها بعد كل اختيار، والعنصر المضغوط بيتشال من الـ DOM قبل الحدث
  if (!ecoTblPop) return;
  if (!document.contains(e.target)) return;
  if (ecoTblPop.contains(e.target) || (e.target.closest && e.target.closest('.eco-hf'))) return;
  ecoTblClosePop();
}, true);
ECO_DOM && document.addEventListener('keydown', e => { if (e.key === 'Escape') ecoTblClosePop(); });
ECO_DOM && document.addEventListener('scroll', ecoTblPlace, true);
ECO_DOM && window.addEventListener('resize', ecoTblPlace);

// ── العروض ──
function ecoTblCols(t) {
  let cg = t.querySelector(':scope > colgroup.eco-cg');
  const n = ecoTblHeads(t).length;
  if (!cg || cg.children.length !== n) {
    if (cg) cg.remove();
    cg = document.createElement('colgroup'); cg.className = 'eco-cg';
    cg.innerHTML = '<col>'.repeat(n); t.insertBefore(cg, t.firstChild);
  }
  return [...cg.children];
}
function ecoTblLoadW(t) {
  try {
    const all = JSON.parse(localStorage.getItem(ECO_TBL_LS) || '{}'), s = all[t._eco.sig];
    const keys = ecoTblHeads(t).map(th => th.dataset.ecoK);
    if (s && keys.every(k => s[k] >= ECO_TBL_MIN)) { t._eco.w = s; t._eco.frozen = true; t._eco.custom = true; ecoTblApplyW(t); }
  } catch (e) {}
}
function ecoTblSaveW(t) {
  try { const all = JSON.parse(localStorage.getItem(ECO_TBL_LS) || '{}'); all[t._eco.sig] = t._eco.w; localStorage.setItem(ECO_TBL_LS, JSON.stringify(all)); } catch (e) {}
}
function ecoTblApplyW(t) {
  const keys = ecoTblHeads(t).map(th => th.dataset.ecoK), cols = ecoTblCols(t), e = t._eco;
  let sum = 0; keys.forEach(k => sum += e.w[k] || 0);
  const slack = Math.max(0, e.wrap.clientWidth - sum); let tot = 0;
  cols.forEach((c, i) => { const w = (e.w[keys[i]] || ECO_TBL_MIN) + (i === cols.length - 1 ? slack : 0); c.style.width = w + 'px'; tot += w; });
  t.style.width = tot + 'px'; t.classList.add('eco-fixed');
}
function ecoTblFreeze(t) {
  if (t._eco.frozen) return;
  const heads = ecoTblHeads(t); if (!heads[0] || !heads[0].getBoundingClientRect().width) return;
  heads.forEach(th => { t._eco.w[th.dataset.ecoK] = Math.max(ECO_TBL_MIN, Math.floor(th.getBoundingClientRect().width)); });
  t._eco.frozen = true; ecoTblApplyW(t);
}
function ecoTblUnfreeze(t) {
  const e = t._eco; e.frozen = false; e.custom = false; e.w = {};
  t.classList.remove('eco-fixed'); t.style.width = '';
  const cg = t.querySelector(':scope > colgroup.eco-cg'); if (cg) cg.remove();
  e.loaded = false;
}
function ecoTblShowBadge(w) { if (!ecoTblBadge) { ecoTblBadge = document.createElement('div'); ecoTblBadge.className = 'eco-w-badge'; document.body.appendChild(ecoTblBadge); } ecoTblBadge.textContent = w + ' px'; }
ECO_DOM && document.addEventListener('pointerdown', e => {
  const h = e.target.closest && e.target.closest('.eco-rz'); if (!h || e.button) return;
  const th = h.closest('th'), t = th.closest('table.eco-tbl-on'); if (!t) return;
  e.preventDefault(); e.stopPropagation(); ecoTblClosePop();
  ecoTblFreeze(t); if (!t._eco.frozen) return;
  const k = th.dataset.ecoK, heads = ecoTblHeads(t), last = heads[heads.length - 1] === th;
  if (last) { let s = 0; heads.forEach(x => s += t._eco.w[x.dataset.ecoK] || 0); t._eco.w[k] += Math.max(0, t._eco.wrap.clientWidth - s); }
  ecoTblDrag = { t, k, x: e.clientX, w: t._eco.w[k], sign: getComputedStyle(t).direction === 'rtl' ? -1 : 1, h };
  try { h.setPointerCapture(e.pointerId); } catch (_) {}
  h.classList.add('active'); document.body.classList.add('eco-col-resizing'); ecoTblShowBadge(ecoTblDrag.w);
});
ECO_DOM && document.addEventListener('pointermove', e => {
  if (!ecoTblDrag) return;
  const d = ecoTblDrag; d.t._eco.w[d.k] = Math.max(ECO_TBL_MIN, Math.min(ECO_TBL_MAX, Math.round(d.w + d.sign * (e.clientX - d.x))));
  ecoTblApplyW(d.t); ecoTblShowBadge(d.t._eco.w[d.k]);
});
function ecoTblEnd() {
  if (!ecoTblDrag) return; const d = ecoTblDrag; ecoTblDrag = null;
  d.h.classList.remove('active'); document.body.classList.remove('eco-col-resizing');
  if (ecoTblBadge) { ecoTblBadge.remove(); ecoTblBadge = null; }
  d.t._eco.custom = true; ecoTblSaveW(d.t);
}
ECO_DOM && document.addEventListener('pointerup', ecoTblEnd); ECO_DOM && document.addEventListener('pointercancel', ecoTblEnd);
// ⚠️ المقبض جوّه `<th>` اللي عليه `onclick` للترتيب — الضغطة بعد السحب لازم ما توصلش للترتيب
ECO_DOM && document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.eco-rz')) { e.stopPropagation(); e.preventDefault(); } }, true);
// دبل كليك = ضبط على أطول محتوى. 🔴 القياس بـ`Range` على المحتوى مش على الخلية (قياس الخلية بيدّي عرض العمود الحالي)
ECO_DOM && document.addEventListener('dblclick', e => {
  const h = e.target.closest && e.target.closest('.eco-rz'); if (!h) return;
  const th = h.closest('th'), t = th.closest('table.eco-tbl-on'); if (!t) return;
  ecoTblFreeze(t); if (!t._eco.frozen) return;
  const i = ecoTblHeads(t).indexOf(th), k = th.dataset.ecoK;
  t.classList.add('eco-measure');
  const hr = document.createRange(); hr.setStart(th, 0); hr.setEndBefore(th.querySelector('.eco-hf') || h);
  let w = hr.getBoundingClientRect().width + 36;
  ecoTblRows(t).forEach(tr => { const td = tr.children[i]; if (!td || tr.classList.contains('eco-tf-hide') || !ecoTblIsData(tr, ecoTblHeads(t).length)) return; const r = document.createRange(); r.selectNodeContents(td); w = Math.max(w, r.getBoundingClientRect().width + 16); });
  t.classList.remove('eco-measure');
  t._eco.w[k] = Math.max(ECO_TBL_MIN, Math.min(ECO_TBL_MAX, Math.ceil(w))); t._eco.custom = true; ecoTblApplyW(t); ecoTblSaveW(t);
});
ECO_DOM && window.addEventListener('resize', () => { document.querySelectorAll('table.eco-tbl-on.eco-fixed').forEach(t => ecoTblApplyW(t)); });

// ── التشغيل ──
function ecoTblScan() { document.querySelectorAll('table').forEach(t => { if (ecoTblEligible(t)) ecoTblEnhance(t); }); }
function ecoTablesAuto() {
  ecoTblScan();
  new MutationObserver(() => { clearTimeout(ecoTblScanT); ecoTblScanT = setTimeout(ecoTblScan, 80); }).observe(document.body, { childList: true, subtree: true });
}
