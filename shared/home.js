// ══════════════════════════════════════════════════════════════
// shared/home.js — الشاشة الرئيسية الموحّدة (أقسام · صفوف الطوابير · أدوات)
// ══════════════════════════════════════════════════════════════
//
// 🔴 **الملف ده نسختين متطابقتين بالبايت** — واحدة في كل ريبو، ومفيش ريبو «أصل».
//    أي تعديل هنا يتعمل في الاتنين في نفس التمريرة. الفحص:
//    `bash docs/core-twin-check.sh` — بيقارن ويقول الفرق بس، **مابينسخش ولا بيعدّل**.
//
// 🔴 **مايعرفش أسماء طوابير ولا Workers ولا ألوان أي هب.** كل ده في `shared/home-config.js`
//    (`ECO_HOME`): الأقسام والصفوف (الاسم · الرابط · الأيقونة · الـ Worker · الاشتقاق)
//    والأدوات. وألوان الهوية في `shared/hub.css`.
//    ترتيب التحميل: `hub-config.js` ← `core.js` ← ملف المجال ← `home.js` ← `home-config.js`.
//
// 🔴 **سياسة التحديث (قرار أحمد 14-10-2026):** مفيش تحديث تلقائي. الجلب عند «تحديث» أو فتح
//    الرئيسية والكاش **أقدم من ١٠ دقايق** (`ECO_CACHE_TTL_MS`). النبضة (٣٠ ثانية) بتحدّث
//    «منذ كام» **بلا أي نداء شبكة**. ⛔ ومفيش جلب عند الرجوع للتاب (`visibilitychange`).
//
// القواعد اللي كانت مكتوبة في كل هب (قاعدة ٢-٦):
//   · الطوابير بتتجاب بالتوازي بـ`allSettled` — فشل طابور **مايخفيش** التاني.
//   · العدد قبل أول جلب ناجح `—` مش `0` («ما اتحدّثش» ≠ «مفيش شغل»).
//   · الفشل بيعرض حالة فشل مش صفر، والدخول للصفحة **لسه شغّال**.
//   · الختم بيتسجّل حتى لو الطابور رجع فاضي، وفي الفشل **مايتغيّرش**.
//   · الضغط على الصف بيفتح الصفحة **حتى والجلب فشل**.
//   · القايمة بتتبني من `homeQ` نفسه — مش مكتوبة بالإيد (طابور جديد ماينساش في صمت).
//   · زرار «تحديث» لكل صف لوحده — ممنوع يتوحّد (بيخبّي مين اللي فشل).
// ══════════════════════════════════════════════════════════════

const ECO_TICK_MS = 30 * 1000;

const HOME_QUEUES = {};   // key → تعريف الطابور (من ECO_HOME.queues) + `ids`
const homeQ = {};         // key → { at, loading, total, done… }
let homeTickTimer = null;

// 🔴 الكاش بيتقري **بس لو عمره أقل من `ECO_CACHE_TTL_MS`** — أقدم من كده = جلب جديد.
//    ⚠️ وعمر سالب (ساعة الجهاز اترجعت) = مش موثوق = جلب.
const cacheFresh = c => !!c && c.ageMs >= 0 && c.ageMs < ECO_CACHE_TTL_MS;

// طابور بيتجاب خام ويتكاش خام — `derive` واحدة للشبكة وللكاش (نسختين كانوا هيخلّوا رقم الكاش
// يخالف رقم الشبكة لنفس الرد). ⚠️ الكاش بيتكتب بالرد **الخام** زي ما جه: كاش مشتق كان هيخلّي
// أي تعديل في القاعدة يسيب بيانات قديمة بشكل قديم في الجلسة.
function ecoRawQueue({ cacheKey, fetchRaw, derive, valid }) {
  return {
    async fetch() {
      const raw = await fetchRaw();
      cacheSet(cacheKey, raw);
      return derive(raw);
    },
    fromCache() {
      const c = cacheGet(cacheKey);
      if (!cacheFresh(c) || (valid && !valid(c.data))) return null;
      try { return { at: new Date(c.at), r: derive(c.data) }; } catch { return null; }
    },
  };
}

// ══════════════════════════════════════════════════════════════
// §BUILD — الأقسام والصفوف والأدوات تتبني من `ECO_HOME`
// ══════════════════════════════════════════════════════════════
const homeK = key => key.charAt(0).toUpperCase() + key.slice(1);
function homeIds(key) {
  const K = homeK(key);
  return { row:'row'+K, count:'cnt'+K, chips:'chips'+K, money:'money'+K, fail:'fail'+K,
           ago:'ago'+K, stamp:'stamp'+K, btn:'btn'+K, done:'done'+K };
}
const HOME_CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';

function homeQueueRowHTML(key) {
  const d = HOME_QUEUES[key], ids = d.ids;
  const head = `
        <div class="eco-row-id">
          <span class="eco-card-ico">${d.svg}</span>
          <div>
            <div class="eco-card-name">${esc(d.name)}</div>
            <div class="eco-card-code"${d.ltr ? ' dir="ltr"' : ''}>${esc(d.code)}</div>
          </div>
        </div>`;
  // 🔴 صف بلا طابور (أداة مالهاش عدّاد): الرقم `—` رمادي مش `0`، وزرار «فتح الأداة ←» مكان التحديث —
  //    ⛔ مفيش عمر ولا تحديث ولا فشل لأن مفيش جلب أصلًا.
  if (d.link) {
    return `
      <a class="eco-row eco-qrow ${esc(d.idCls)} is-link" id="${ids.row}" href="${esc(d.href)}">${head}
        <div class="eco-row-num"><span class="eco-count pending" aria-label="بلا عدّاد">—</span></div>
        <div class="eco-row-mid"></div>
        <div class="eco-row-act"><span class="eco-open">فتح الأداة ←</span></div>
      </a>`;
  }
  return `
      <a class="eco-row eco-qrow ${esc(d.idCls)} age-none" id="${ids.row}" href="${esc(d.href)}">${head}
        <div class="eco-row-num">
          <span class="eco-count pending" id="${ids.count}">—</span><span class="eco-count-spin" aria-hidden="true">↻</span>
        </div>
        <div class="eco-row-mid">
          <div class="eco-chips" id="${ids.chips}"></div>
          <div class="home-money-row" id="${ids.money}"></div>
          <div class="eco-fail" id="${ids.fail}" style="display:none"></div>
        </div>
        <div class="eco-row-act">
          <div class="eco-agebox">
            <div class="eco-agebox-top"><span class="eco-agebox-lbl">آخر تحديث منذ:</span><span class="eco-agebox-time" id="${ids.stamp}">—</span></div>
            <div class="eco-agebox-val" id="${ids.ago}">—</div>
            <div class="eco-agebar" aria-hidden="true"><i></i></div>
          </div>
          <button class="eco-qref" id="${ids.btn}" type="button" data-refresh="${esc(key)}">
            <span class="eco-qref-ico" aria-hidden="true">↻</span><span class="eco-qref-tx">تحديث</span>
          </button>
        </div>${d.done ? `
        <div class="eco-done" id="${ids.done}"></div>` : ''}
      </a>`;
}

function homeToolHTML(t) {
  return `
      <a class="eco-tool${t.theme ? ' ' + esc(t.theme) : ''}" href="${esc(t.href)}">
        <span class="eco-card-ico${t.ico ? ' ' + esc(t.ico) : ''}">${t.svg}</span>
        <div class="eco-card-name">${esc(t.name)}</div>
      </a>`;
}

function homeSectionHTML(s) {
  const sum = !!s.summary;
  const body = s.queues
    ? `<div class="eco-rows">${s.queues.map(homeQueueRowHTML).join('')}\n    </div>`
    : `<div class="eco-tools-grid">${(s.tools || []).map(homeToolHTML).join('')}\n    </div>`;
  return `
  <section class="eco-home-sec ${esc(s.cls)}${sum ? ' has-sum' : ''}" id="sec${s.id}">
    <div class="eco-home-sec-hd" role="button" tabindex="0" aria-expanded="true" aria-controls="secBody${s.id}" data-sec-toggle>
      <i class="eco-sec-sp" aria-hidden="true"></i><i class="eco-sec-ln" aria-hidden="true"></i>
      <div class="eco-sec-mid">
        <span class="eco-home-sec-ico">${s.svg}</span>
        <div class="eco-sec-tx">
          <div class="eco-home-sec-title">${esc(s.title)}</div>
          <div class="eco-home-sec-sub">${esc(s.sub)}</div>${sum ? `
          <div class="eco-sum" id="sum${s.id}"></div>` : ''}
        </div>
      </div>
      <i class="eco-sec-ln" aria-hidden="true"></i>
      <span class="eco-sec-chev" aria-hidden="true">${HOME_CHEV}</span>
    </div>
    <div class="eco-sec-body" id="secBody${s.id}"><div class="eco-sec-in">${body}</div></div>
  </section>`;
}

// 🔴 **القايمة بتتبني من الأقسام** — `homeQ` و`HOME_SECS` والجلب كلهم من نفس `ECO_HOME`، فمستحيل
//    طابور يتعرض ومايتجابش (الصف بيترسم والعدّاد بيفضل `—` للأبد من غير خطأ).
const HOME_SECS = {};     // sumId → [keys] (للملخّص وهو مطوي)
function ecoHomeMount(root = document.getElementById('homeRoot')) {
  Object.keys(HOME_QUEUES).forEach(k => delete HOME_QUEUES[k]);
  Object.keys(homeQ).forEach(k => delete homeQ[k]);
  Object.keys(HOME_SECS).forEach(k => delete HOME_SECS[k]);
  for (const s of ECO_HOME.sections) {
    for (const key of s.queues || []) {
      const d = ECO_HOME.queues[key];
      HOME_QUEUES[key] = { ...d, ids: homeIds(key) };
      if (!d.link) homeQ[key] = { at: null, loading: false };
    }
    if (s.summary && s.queues) HOME_SECS['sum' + s.id] = s.queues.filter(k => !ECO_HOME.queues[k].link);
  }
  root.innerHTML = ECO_HOME.sections.map(homeSectionHTML).join('');
}

// ══════════════════════════════════════════════════════════════
// §LOAD — المسار الوحيد للجلب
// ══════════════════════════════════════════════════════════════
function loadQueuesStaggered(keys) {
  // 🔴 تفريق التوقيت (قرار أحمد 19-09-2026): الـ Workers بتشارك نفس الـ Custom App، فإطلاق كلهم في
  //    نفس اللحظة = طلبات OAuth متزامنة = `THROTTLED` جماعي. `staggerMs` في الإعداد (٠ = بالتوازي).
  //    ⚠️ مش بديل لـ`allSettled` — فشل طابور واحد لسه **مايخفيش** التاني.
  const ms = ECO_HOME.staggerMs || 0;
  return Promise.allSettled(keys.map((k, i) => ms
    ? new Promise(r => setTimeout(r, i * ms)).then(() => loadQueue(k))
    : loadQueue(k)));
}

function loadCounts() {
  startHomeTicker();
  Object.keys(homeQ).forEach(renderDone);   // «—» لحد أول جلب
  // 🔴 **الكاش الأول** — طابور كاشه أحدث من ١٠ دقايق بيترسم منه بصفر نداء، والباقي بس هو اللي بيتجاب.
  //    ⚠️ والختم بيبقى **وقت الكاش** مش وقت الفتح — «منذ ٨ دقايق» هي الحقيقة.
  const toFetch = Object.keys(homeQ).filter(k => !homeFromCache(k));
  renderFreshness();
  loadQueuesStaggered(toFetch);
}

// بترجّع `true` لو الطابور اترسم من كاش أحدث من ١٠ دقايق (وكاش «خلص» كمان — لو ناقص بنجيب «خلص»
// لوحده من غير ما نجيب الطابور).
function homeFromCache(key) {
  const def = HOME_QUEUES[key], q = homeQ[key];
  const c = def.fromCache();
  if (!c) return false;
  clearFail(def.ids.fail);
  setCount(key, c.r);
  q.at = c.at;
  if (def.done) {
    const d = cacheGet(ECO_CACHE_DONE + key);
    // 🔴 يوم القاهرة جوّه الكاش: كاش اتكتب ١١:٥٧م مايتعرضش «النهارده» بعد نص الليل
    if (d && d.ageMs < ECO_CACHE_TTL_MS && d.data && d.data.day === cairoDayStr(new Date())) {
      q.done = d.data.counts; q.doneErr = null; renderDone(key);
    } else {
      loadDone(key);
    }
  }
  return true;
}

// المسار الوحيد للجلب من الشبكة — الفتح والضغطة اليدوية الاتنين بيعدّوا منه.
async function loadQueue(key, silent = true) {
  const q = homeQ[key], def = HOME_QUEUES[key];
  if (q.loading) return;              // ضغطتين ورا بعض
  q.loading = true;
  setRefreshing(key, true);
  renderFreshness();
  // 🔴 «خلص» بالتوازي ومستقل: فشله **مايمنعش** الطابور ولا العكس. `loadDone` مابترميش أبدًا.
  const donePromise = def.done ? loadDone(key) : null;
  try {
    const r = await def.fetch();
    clearFail(def.ids.fail);
    setCount(key, r);
    // ⚠️ الختم بيتسجّل **حتى لو الطابور رجع فاضي** — «اتحدّث ورجع صفر» معلومة،
    //    و«ما اتحدّثش» معلومة تانية خالص.
    q.at = new Date();
  } catch (err) {
    // ⚠️ الختم **مايتغيّرش** في الفشل — ما نقولش للموظف إن القايمة دي جديدة وهي مش جديدة،
    //    والصف بيفضل بلون عمره الحقيقي. والدخول للصفحة **لسه شغّال**.
    setFail(key, err.message || def.err);
    if (!silent) showToast(err.message || def.err, 'error', 5000);
  } finally {
    if (donePromise) await donePromise;   // الزرار بيفضل «جاري» لحد ما الاتنين يخلصوا
    q.loading = false;
    setRefreshing(key, false);
    renderFreshness();
  }
}

function setCount(key, r) {
  const ids = HOME_QUEUES[key].ids;
  homeQ[key].total = r.total;     // للملخّص وهو مطوي
  const c = document.getElementById(ids.count);
  c.textContent = String(r.total);
  c.setAttribute('aria-label', `${r.total} ${HOME_QUEUES[key].unit || 'أوردر'}`);
  c.classList.remove('pending', 'failed');
  // 🔴 `ch.row` (اختياري) بيحط المربع في سطر لوحده — «In-Return» تحت مربعات المحاولات. من غيره
  //    كل المربعات في سطر واحد بيلفّ لوحده.
  // 🎨 `ch.grp` (اختياري) = المربع من «مجموعة موصولة» (§HOME-CHIPS · قرار أحمد 22-10-2026): كل مربعات
  //    `grp` في السطر بتتلزق في كبسولة واحدة بفواصل (الرقم يمين والاسم يسار)، والصفر باهت. المربعات
  //    بلا `grp` بتفضل كبسولات لوحدها جنبها. 🔴 الألوان من نفس `cls` (`qc-*` · `chip-ch-*`) — مصدر واحد.
  // 🎨 `ch.att` (اختياري · `{ n, title }`) = بادج ⏳ على المربع (مثال: «في انتظار الرفع» على بوسطة) —
  //    ⚠️ ما بيبهتش حتى والمربع صفر: ده تحذير، وتبهيته بيخبّيه لما يتحتاج.
  const ATT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12M6 21h12"/><path d="M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/></svg>';
  const attHtml = ch => ch.att && ch.att.n
    ? `<span class="eco-att" title="${esc(ch.att.title)}" aria-label="${esc(ch.att.title)}: ${ch.att.n}">${ATT_SVG}${ch.att.n}</span>` : '';
  const chipHtml = ch => ch.grp
    ? `<span class="eco-chip ${esc(ch.cls)}${ch.n ? '' : ' z0'}"><b>${ch.n}</b><span>${esc(ch.label)}</span>${attHtml(ch)}</span>`
    : `<span class="eco-chip ${esc(ch.cls)}">${esc(ch.label)} <b>${ch.n}</b></span>`;
  const chipsHtml = list => {
    const g = list.filter(c => c.grp);
    return (g.length ? `<span class="eco-cgroup">${g.map(chipHtml).join('')}</span>` : '')
      + list.filter(c => !c.grp).map(chipHtml).join('');
  };
  const chipRows = {};
  (r.chips || []).forEach(ch => (chipRows[ch.row || 0] = chipRows[ch.row || 0] || []).push(ch));
  const rowKeys = Object.keys(chipRows).sort((a, b) => a - b);
  document.getElementById(ids.chips).innerHTML = rowKeys.length > 1
    ? rowKeys.map(k => `<div class="eco-chips-line">${chipsHtml(chipRows[k])}</div>`).join('')
    : chipsHtml(r.chips || []);
  // ⚠️ تحذير «القايمة مقطوعة» — ده عن الطابور مش عن الفلوس (الفلوس اتشالت من الرئيسية).
  document.getElementById(ids.money).innerHTML = r.truncated
    ? `<span class="eco-chip qc-flag">⚠️ القايمة مقطوعة — فيه أكتر من المعروض</span>` : '';
}

function setFail(key, msg) {
  const ids = HOME_QUEUES[key].ids;
  const f = document.getElementById(ids.fail);
  f.style.display = '';
  f.textContent = `⚠️ ${msg}`;
  // ⚠️ «تعذّر الاستعلام» ≠ «مفيش شغل» — فالعدد **عمره ما يبقى صفر** هنا. ولو فيه جلب ناجح قبل كده،
  //    الرقم القديم **بيفضل** والصف بلونه بيقول عمره — ده أصدق من مسحه.
  if (!homeQ[key].at) {
    const c = document.getElementById(ids.count);
    c.textContent = 'تعذّر';
    c.classList.remove('pending');
    c.classList.add('failed');
  }
}
function clearFail(failId) {
  const f = document.getElementById(failId);
  f.style.display = 'none';
  f.textContent = '';
}

// وقت التحديث: الزرار أبيض بإطار متقطّع والأيقونة بتلف، والرقم الكبير بيتبدّل بـ ↻ بتلف
// (CSS على `.is-loading`)، والشريط بيتحرك رايح جاي.
function setRefreshing(key, on) {
  const ids = HOME_QUEUES[key].ids;
  const btn = document.getElementById(ids.btn);
  document.getElementById(ids.row)?.classList.toggle('is-loading', on);
  if (!btn) return;
  btn.disabled = on;
  btn.querySelector('.eco-qref-tx').textContent = on ? 'جاري' : 'تحديث';   // الزرار نحيف (48px) — «جاري التحديث» بتتقال في مربع العمر
  btn.setAttribute('aria-busy', String(on));
}

// ══════════════════════════════════════════════════════════════
// §DONE — «اللي خلص النهارده / أمس» تحت الصف (اختياري: `done` في تعريف الطابور)
// ══════════════════════════════════════════════════════════════
// 🔴 **أوردرات مميزة، مش صفوف** — إعادة الطباعة/التغليف بتتحسب مرة في اليوم، والمميّز **جوّه اليوم
//    الواحد**. 🔴 **يوم القاهرة** مش يوم UTC. 🔴 **الفشل مش صفر ومش بيخفي الطابور** (جلب مستقل).
// 🔴 **لو السجل أطول من `DONE_MAX_PAGES` صفحة بنرمي** — رقم ناقص بيعدّي كأنه كامل أسوأ من «تعذّر».
// ⚠️ بتتحدّث مع زرار تحديث نفس الصف وبنفس دورة الـ١٠ دقايق — مفيش تايمر لوحدها.
// ⚠️ `pick` (إيه اللي بيتعدّ «اتعمل») خاص بكل أداة — في `home-config.js`.
const DONE_PAGE      = 100;   // سقف `get_logs` المفروض من الـ Workers
const DONE_MAX_PAGES = 15;

// المصدر الأساسي: العدّ جاهز من الـ Worker (`get_done_counts`). ⚠️ مفيش ترفيع `min` عن قصد
// (Standards #29): لو الـ Worker لسه ما اتعملش له Promote أو الرد مش بالشكل المتوقع (أو يوم القاهرة
// عند الـ Worker غير عند الجهاز)، بنرجع لتصفيح `get_logs` — نفس الأرقام بتكلفة أعلى.
async function fetchDoneCounts(key) {
  const d = HOME_QUEUES[key].done;
  try {
    const res = await ecoApi(ECO_WORKERS[d.worker]).apiGet('get_done_counts');
    const c = res && res.counts;
    if (res && res.ok !== false && c && Number.isInteger(c.today) && Number.isInteger(c.yesterday)
        && res.today === cairoDayStr(new Date())) {
      return { today: c.today, yest: c.yesterday };
    }
  } catch { /* Worker قديم / تعذّر — الاحتياطي تحت */ }
  return fetchDoneCountsFromLogs(key);
}

async function fetchDoneCountsFromLogs(key) {
  const d = HOME_QUEUES[key].done;
  const api = ecoApi(ECO_WORKERS[d.worker]);
  const today = cairoDayStr(new Date());
  const yest  = ecoAddDays(today, -1);
  const dateFrom = ecoAddDays(yest, -1);                           // يوم UTC زيادة
  const startMs  = cairoDayStartMs(yest);   // بداية يوم القاهرة لأمس (Intl — مش +٣ ثابتة)
  const seen = { [today]: new Set(), [yest]: new Set() };
  for (let page = 0; page < DONE_MAX_PAGES; page++) {
    const res = await api.apiGet('get_logs', {
      limit: DONE_PAGE, offset: page * DONE_PAGE, dateFrom, dateTo: today, ...(d.params || {}),
    });
    const got = res?.entries || [];
    for (const e of got) {
      const day = e.timestamp ? cairoDayStr(e.timestamp) : null;
      if (!seen[day] || !d.pick(e)) continue;
      const name = String(e.order_name ?? '').replace('#', '').trim();
      if (name) seen[day].add(name);
    }
    const last = got[got.length - 1];
    // `get_logs` مرتّب `timestamp DESC` — أول صفحة بتخلص بصف أقدم من أمس معناه مفيش لزوم لغيرها
    if (got.length < DONE_PAGE || (last && new Date(last.timestamp).getTime() < startMs)) {
      return { today: seen[today].size, yest: seen[yest].size };
    }
  }
  throw new Error('سجل اليومين أطول من الحد — الرقم مش كامل');
}

async function loadDone(key) {
  const q = homeQ[key];
  q.doneBusy = true;
  renderDone(key);
  try {
    q.done = await fetchDoneCounts(key);
    q.doneErr = null;
    cacheSet(ECO_CACHE_DONE + key, { day: cairoDayStr(new Date()), counts: q.done });
  } catch (err) {
    q.doneErr = err.message || 'تعذّر تحميل «خلص»';   // الرقم القديم (لو فيه) بيفضل
  } finally {
    q.doneBusy = false;
    renderDone(key);
  }
}

const DONE_ICO_CK  = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7"/></svg>';
const DONE_ICO_ARR = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/></svg>';
function renderDone(key) {
  const d = HOME_QUEUES[key].done;
  const el = d && document.getElementById(HOME_QUEUES[key].ids.done);
  if (!el) return;
  const q = homeQ[key];
  // «—» قبل أول جلب ناجح، مش «٠» — «ما اتحدّثش» ≠ «مفيش شغل خلص»
  const f = w => q.done ? Number(q.done[w]).toLocaleString('en-US') : '—';
  const warn = q.doneErr
    ? `<span class="eco-done-warn" title="${esc(q.doneErr)}">⚠️ تعذّر</span>` : '';
  el.classList.toggle('is-busy', !!q.doneBusy);
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', `${d.verb}: اليوم وأمس`);
  el.innerHTML =
    `<span class="eco-done-lbl"><span class="eco-ck">${DONE_ICO_CK}</span><span>${esc(d.verb)}</span>${warn}`
    + `<span class="eco-done-arr">${DONE_ICO_ARR}</span></span>`
    + `<span class="eco-done-cells">`
    + `<span class="eco-done-cell"><span class="eco-done-k">اليوم</span><b class="eco-done-today">${f('today')}</b></span>`
    + `<span class="eco-done-cell"><span class="eco-done-k">أمس</span><span class="eco-done-yest">${f('yest')}</span></span>`
    + `</span>`;
}

// ══════════════════════════════════════════════════════════════
// §AGE — عمر الرقم على الصف + ملخّص القسم وهو مطوي
// ══════════════════════════════════════════════════════════════
// ⚠️ ثقة الموظف في الرقم بتتبني على المربع ده — ومن غير تحديث تلقائي هو **الحاجة الوحيدة** اللي
//    بتقول إن الرقم قدم. ⚠️ المرحلة (اللون) من `agoInfo` في `core.js` — **ممنوع سلّم تاني هنا**.
//    اللي بيتحسب هنا هو **الدقايق** (للنص الكبير والشريط).
// ⚠️ بعد قرار أحمد (توحيد الهبّين): **مفيش حافة ملوّنة** على الصف — لون العمر على الخلفية والمربع
//    والزرار بس.
const ECO_CLOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
function ageValueHtml(mins) {
  if (mins < 1)  return '<b>لحظات</b>';
  if (mins < 60) return `<b>${mins}</b>${mins >= 3 && mins <= 10 ? 'دقايق' : 'دقيقة'}`;
  const h = Math.floor(mins / 60);
  return h <= 2 ? `<b>${esc(arHour(h))}</b>` : `<b>${h}</b>${h <= 10 ? 'ساعات' : 'ساعة'}`;
}
// 🎨 ملخّص القسم وهو مطوي — اسم كل صف ورقمه، وتحته المدة بلون عمره ("4 دقيقة"). ⚠️ **نفس `homeQ`
//    ونفس `agoInfo`** — مفيش سلّم تاني ولا نداء شبكة. الصف اللي ما اتجابش `—` مش `0`، والفاشل
//    «تعذّر». الاسم ولون الهوية بيتقروا من الصف نفسه (مصدر واحد).
function sumAgeText(mins) {
  if (mins < 1) return 'لحظات';
  return mins < 60 ? mins + ' دقيقة' : Math.floor(mins / 60) + ' ساعة';
}
function renderSummary(now) {
  Object.keys(HOME_SECS).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = HOME_SECS[id].map(key => {
      const q = homeQ[key], row = document.getElementById(HOME_QUEUES[key].ids.row);
      if (!row) return '';
      const name = row.querySelector('.eco-card-name').textContent.trim();
      const idCls = [...row.classList].find(c => c.startsWith('id-')) || '';
      const lvl = q.at ? agoInfo(q.at, now).cls.replace('ago-', '') : 'none';
      const mins = q.at ? Math.max(0, Math.floor((now - q.at.getTime()) / 60000)) : 0;
      const failed = !!row.querySelector('.eco-count.failed');
      const n = failed ? 'تعذّر' : typeof q.total === 'number' ? String(q.total) : '—';
      const cap = q.loading ? 'جاري التحديث…' : q.at ? sumAgeText(mins) : 'لسه ما اتحدّثش';
      return `<span class="eco-smw"><span class="eco-sm ${idCls}"><span class="eco-sm-n">${esc(name)}</span><em>${esc(n)}</em></span><i class="eco-smcap age-${lvl}">${esc(cap)}</i></span>`;
    }).join('');
  });
}
function renderFreshness(now = Date.now()) {
  Object.keys(homeQ).forEach(key => {
    const q = homeQ[key], ids = HOME_QUEUES[key].ids;
    const row = document.getElementById(ids.row);
    if (!row) return;
    const info = agoInfo(q.at, now);
    const lvl  = q.at ? info.cls.replace('ago-', '') : 'none';
    const mins = q.at ? Math.max(0, Math.floor((now - q.at.getTime()) / 60000)) : 0;
    row.classList.remove('age-none', 'age-fresh', 'age-ok', 'age-warn', 'age-stale');
    row.classList.add('age-' + lvl);
    // `--fill` = الدقايق ÷ ٦٠ (بيقف عند ساعة) — خلفية الصف والشريط بيتملوا تدريجيًا
    row.style.setProperty('--fill', String(q.at ? Math.min(mins / 60, 1) : 0));
    document.getElementById(ids.ago).innerHTML = q.loading
      ? '<span>جاري التحديث…</span>'
      : q.at ? '<span>' + ageValueHtml(mins) + '</span>' : '<span>لسه ما اتحدّثش</span>';
    // 🕐 الساعة بس جنب العنوان (صباحاً/مساءً) — التاريخ اتشال: الكاش عمره ١٠ دقايق والخروج التلقائي
    //    بعد ساعة، فالتاريخ هو النهارده دايمًا. وبيفضل في `title` الصندوق لو احتاجه حد.
    const iso = q.at ? q.at.toISOString() : null;
    const p = iso ? cairoParts(iso) : null;
    const stampEl = document.getElementById(ids.stamp);
    stampEl.innerHTML = p ? ECO_CLOCK_SVG + esc(_ampm(p)) : '—';
    stampEl.closest('.eco-agebox').title = p ? `آخر تحديث ${formatDate(iso)} ${_ampm(p)}` : '';
  });
  renderSummary(now);
}

// ─── النبضة — أرقام محسوبة محليًا، **صفر نداء شبكة** ───
function startHomeTicker() {
  if (homeTickTimer) return;
  homeTickTimer = setInterval(() => renderFreshness(), ECO_TICK_MS);
}

// ══════════════════════════════════════════════════════════════
// §FOLD — طي الأقسام
// ══════════════════════════════════════════════════════════════
// ⚠️ **كله مفتوح عند الفتح** (قرار أحمد) و**الحالة مابتتخزّنش** — الريفريش بيرجّعها مفتوحة. والصفوف
//    المخفية `visibility:hidden` بعد الحركة (CSS)، فمابتاخدش تاب ولا قارئ شاشة وهي مطوية.
function toggleHomeSec(h) {
  const sec = h.closest('.eco-home-sec');
  const c = !sec.classList.contains('is-collapsed');
  sec.classList.toggle('is-collapsed', c);
  h.setAttribute('aria-expanded', String(!c));
}
document.addEventListener('click', e => {
  const h = e.target.closest && e.target.closest('[data-sec-toggle]');
  if (h) { toggleHomeSec(h); return; }
  // زرار «تحديث» جوّه الصف (الصف نفسه لينك) — `preventDefault` عشان مايفتحش الصفحة.
  // 🔴 زرار لكل صف لوحده — ⛔ ممنوع يتوحّد في «تحديث الكل».
  const b = e.target.closest && e.target.closest('[data-refresh]');
  if (b) { e.preventDefault(); e.stopPropagation(); loadQueue(b.dataset.refresh, false); }
});
document.addEventListener('keydown', e => {
  const h = e.target.closest && e.target.closest('[data-sec-toggle]');
  if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleHomeSec(h); }
});
