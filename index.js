// ══════════════════════════════════════════════════════════════
// §HEADER
// Worker: warehouse-operations-center-worker — EcomModa
// Tool:   مركز عمليات المخزن — **الدخول والخروج وبس**
//
// skills: worker-builder v3.7.1 · constants v1.10.0 · html-builder v6.6.0 — 24-09-2026
//
// 🔴 **الـ Worker ده جزء من الهب نفسه، مش أداة تانية.** الهب واجهة + Worker
//    دخول = **الشكل القياسي** في الستاك (قرار ٨ في
//    `ecommoda-tool-migration-playbook`: أداة = Worker واحد + HTML واحد +
//    ريبو واحد) — نفس الشكل اللي `Delivery-COD-Operations-Center` بيه، ونفس
//    القرار اللي نقل الهب ده من «الدخول عبر Worker التغليف» لـWorker بتاعه.
//
// ⛔ **وممنوع يتضاف له أي endpoint تشغيلي.** لا طابور ولا سكان ولا تغليف.
//    كل أداة تشغيلية في الهب على Worker بتاعها في ريبوها (التغليف · الطباعة ·
//    حذف منتج · باركود SKU · سكانرا بوسطة · تسليمات المكتب · استلام
//    المرتجعات). الاسم بيقول «مركز عمليات المخزن» فالإغراء موجود — والقاعدة
//    دي هي اللي بتمنعه: Worker واحد بيخدم أدوات كتير = مصدرين للحقيقة.
//
// 🔴 **بيكتب صفّين بس في D1:** `login` و`logout` تحت
//    `tool = 'warehouse_ops_center'`. صفر كتابة على شوبيفاي، وصفر أي
//    قيمة `type` تانية.
//
// 🔴 **ومفيش `CLIENT_ID`/`CLIENT_SECRET` عليه بقرار** — مالوش أي نداء
//    لشوبيفاي. يعني سطح الـ PIN ومفاتيح المتجر **في Workers مختلفة**:
//    اللي بيقرا PIN مايقدرش يلمس المتجر، واللي بيقرا المتجر مايقدرش يقرا PIN.
//
// 🔴 **قبل ده كان الدخول بيحصل عبر `orders-packing-checker-worker`** (عن
//    طريق `appId: 'warehouse_ops_center'` في `verify_employee`/`log_logout`).
//    السبب اللي غيّر ده: أكبر Worker شغل في المخزن كان بيتحكم في أهم نقطة
//    في الهب (الدخول)، وأي مشكلة أو Promote ناقص فيه كان بيقفل باب الدخول
//    كله. الدخول دلوقتي مستقل تمامًا، وWorker التغليف رجع لشغله بس.
// ══════════════════════════════════════════════════════════════
const TOOL_NAME      = 'warehouse_ops_center';
const WORKER_VERSION = '1.0.0';

// ─── §CONSTANTS::authApps ───
// 🔴 **قايمة بيضاء مقفولة، مش قبول لأي نص.** `appId` جاي من العميل، وجدول
//    `logs` **مشترك بين كل أدوات الستاك**. من غير القايمة دي أي طلب معاه
//    السر يقدر يكتب صفوف بأي قيمة `tool`.
// ⚠️ والـ Worker ده بيخدم **واجهة واحدة**، فالقايمة فيها اسم واحد والهب
//    **مابيبعتش `appId` أصلاً** — الاسم بيتحدد هنا. لو اتضافت واجهة تانية
//    يومًا، اسمها بيتضاف هنا **وبيترفع الحد الأدنى في الواجهة في نفس
//    التسليم** (`worker-builder` §appId قاعدة ٤).
const AUTH_APPS = new Set([TOOL_NAME]);
function resolveAuthTool(appId) { return AUTH_APPS.has(appId) ? appId : TOOL_NAME; }

// ══════════════════════════════════════════════════════════════
// §CORS — Option B (قايمة صارمة)
// ══════════════════════════════════════════════════════════════
// ⚠️ الـ Worker ده بيستقبل **PIN** — فمفيش wildcard بأي حال.
const ALLOWED_ORIGINS = ['https://ecommoda-dev.github.io'];
function getCORS(request) {
  const origin  = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

// ══════════════════════════════════════════════════════════════
// §HELPERS
// ══════════════════════════════════════════════════════════════
function json(data, status = 200, request = null) {
  const headers = { 'Content-Type': 'application/json' };
  Object.assign(headers, request ? getCORS(request) : { 'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0] });
  return new Response(JSON.stringify(data), { status, headers });
}

// ─── §HELPERS::assertEnv ───
// ⚠️ **`DB` بس** — مفيش `SHOP_DOMAIN` ولا `CLIENT_*`: الـ Worker ده مالوش أي
//    نداء لشوبيفاي، وvar مش مستخدم = كود ميت مش «احتياط».
function assertEnv(env) {
  if (!env.DB) {
    throw new Error(
      'binding قاعدة البيانات ناقص (`DB`) — ضِفه في `wrangler.toml` تحت ' +
      '`[[d1_databases]]` بالاسم `DB` بالحرف. أي اسم تاني = كتابة فاشلة بصمت. ' +
      '(شغّل ?action=diag)'
    );
  }
}

// ─── §HELPERS::secretFingerprint — بصمة قصيرة لسر المجموعة ───
// (`ecommoda-constants` → `references/secret-groups.md`)
// الطول لوحده **مش كافي** لإثبات إن أعضاء مجموعة `warehouse_ops` شايلين
// نفس القيمة — سرّين مختلفين بنفس الطول شكلهم واحد. البصمة بتكشف الحالتين
// اللي بيوقّعوا الناس: ① عضو لسه على السر القديم ② السر اتضاف والـ Promote
// ما اتعملش. ⛔ ٨ خانات hex من SHA-256 — **مش** قابلة لاسترجاع القيمة.
async function secretFingerprint(secret) {
  if (!secret) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return [...new Uint8Array(buf)].slice(0, 4)
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── §HELPERS::time — توقيت القاهرة **يتحسب** مايتكتبش ثابت ───
// (`ecommoda-constants` §13 — نفس الدوال بالحرف في الـ Worker وفي الواجهة)
const CAIRO_TZ = 'Africa/Cairo';
const _cairoFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAIRO_TZ, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});
function cairoParts(d) {
  const o = {};
  for (const p of _cairoFmt.formatToParts(d)) if (p.type !== 'literal') o[p.type] = p.value;
  if (o.hour === '24') o.hour = '00';
  return o;
}
function cairoDate() { const p = cairoParts(new Date()); return `${p.year}-${p.month}-${p.day}`; }

// ══════════════════════════════════════════════════════════════
// §SHARED — copy verbatim from references/shared-functions.md — never modify
// ══════════════════════════════════════════════════════════════

/**
 * Verify employee and return display_name if correct.
 * Updates last_login automatically.
 * Returns: string (display_name) or null if wrong PIN.
 * Throws: Error if account is suspended.
 */
async function verifyEmployee(db, username, pin) {
  const row = await db.prepare(
    'SELECT display_name, is_active FROM employees WHERE username = ? AND pin = ?'
  ).bind(username, pin).first();

  if (!row) return null;

  if (!row.is_active) {
    throw new Error('الحساب موقوف — تواصل مع المسؤول');
  }

  db.prepare('UPDATE employees SET last_login = ? WHERE username = ?')
    .bind(new Date().toISOString(), username)
    .run()
    .catch(() => {});

  return row.display_name;
}

/**
 * Check if employee exists and has a PIN registered.
 * Used in Login screen to decide: normal login vs first-time PIN setup.
 */
async function checkEmployee(db, username) {
  const row = await db.prepare(
    'SELECT is_active, pin FROM employees WHERE username = ?'
  ).bind(username).first();

  if (!row) return { exists: false, hasPin: false, isActive: false };
  return {
    exists:   true,
    hasPin:   !!row.pin,
    isActive: !!row.is_active,
  };
}

/**
 * Register PIN for the first time.
 * Throws if: user not found / suspended / already has PIN.
 */
async function registerPin(db, username, pin) {
  const row = await db.prepare(
    'SELECT pin, is_active FROM employees WHERE username = ?'
  ).bind(username).first();

  if (!row)           throw new Error('اسم المستخدم غير موجود');
  if (!row.is_active) throw new Error('الحساب موقوف — تواصل مع المسؤول');
  if (row.pin)        throw new Error('هذا المستخدم مسجّل بالفعل — تواصل مع المسؤول لإعادة الضبط');

  await db.prepare('UPDATE employees SET pin = ? WHERE username = ?')
    .bind(pin, username)
    .run();

  return true;
}

// ════════════════════════════════════════════════════════════
// §LOG-REG — الحارس الديناميكي لقيم اللوج (الطبقة ٥)
// ════════════════════════════════════════════════════════════
// قطعة الأداة دي بس من log-values.json اللي جنبها — بتتحدّث معاه في نفس
// الـ commit. `resolveAuthTool()` هنا دايمًا بترجع TOOL_NAME (AUTH_APPS
// فيها اسم واحد بس)، فمفيش قيمة tool تانية ممكن تتكتب من الكود ده فعليًا.
const LOG_REGISTRY = {
  warehouse_ops_center: new Set(['login', 'logout']),
};

const isRegisteredLogValue = (tool, type) => !!LOG_REGISTRY[tool]?.has(type);

// UPSERT على (source_tool, tool, type) — صف واحد لكل قيمة، hits بيعدّ.
// الحدث الكامل مش بيضيع: الصف الأصلي موجود في logs وعليه _unregistered،
// والجدول ده فهرس مش سجل تاني — عشان كده dedupe مش صف لكل حدث.
const LOG_ALERT_SQL = `
  INSERT INTO log_value_alerts
    (source_tool, tool, type, first_seen, last_seen, hits,
     worker_version, sample_order_name, sample_employee, sample_notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(source_tool, tool, type) DO UPDATE SET
    last_seen         = excluded.last_seen,
    hits              = log_value_alerts.hits + excluded.hits,
    worker_version    = excluded.worker_version,
    sample_order_name = excluded.sample_order_name,
    sample_employee   = excluded.sample_employee,
    sample_notes      = excluded.sample_notes,
    status            = CASE WHEN log_value_alerts.status = 'ignored'
                             THEN 'ignored' ELSE 'open' END
`;

// فشل التنبيه ممنوع يأثر على أي حاجة — try/catch صامت. بتجمّع التكرار
// جوّه نفس الدفعة في صف واحد (hits) قبل ما تكتب.
async function noteUnregisteredLogValues(db, entries) {
  const byPair = new Map();
  for (const e of entries) {
    const key = `${e.tool}\u0000${e.type}`;
    const acc = byPair.get(key);
    if (acc) { acc.hits++; continue; }
    byPair.set(key, { entry: e, hits: 1 });
  }
  const now = new Date().toISOString();
  for (const { entry, hits } of byPair.values()) {
    try {
      await db.prepare(LOG_ALERT_SQL).bind(
        TOOL_NAME, entry.tool ?? '(بدون tool)', entry.type ?? '(بدون type)',
        now, now, hits, WORKER_VERSION ?? null,
        entry.orderName ?? null, entry.employee ?? null,
        entry.notes ? String(entry.notes).slice(0, 200) : null,
      ).run();
    } catch (e) { /* متعمّد: التنبيه فهرس، وفشله أهون من تعطيل الأداة */ }
  }
}

async function writeLog(db, entry) {
  const unregistered = !isRegisteredLogValue(entry.tool, entry.type);
  const extra = unregistered
    ? { ...(entry.extra || {}), _unregistered: true }
    : entry.extra;

  await db.prepare(`
    INSERT INTO logs
      (timestamp, tool, type, employee, order_id, order_name,
       sku, product_title, delta, value_before, value_after, notes, extra)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    entry.timestamp    ?? new Date().toISOString(),
    entry.tool,
    entry.type,
    entry.employee     ?? null,
    entry.orderId      ?? null,
    entry.orderName    ?? null,
    entry.sku          ?? null,
    entry.productTitle ?? null,
    entry.delta        ?? null,
    entry.valueBefore  ?? null,
    entry.valueAfter   ?? null,
    entry.notes        ?? null,
    extra ? JSON.stringify(extra) : null
  ).run();

  if (unregistered) await noteUnregisteredLogValues(db, [entry]);   // بعد الكتابة، مش قبلها
}

// ══════════════════════════════════════════════════════════════
// §DIAG — فحص ذاتي بلا أي كتابة
// ══════════════════════════════════════════════════════════════
// الشكل المعتمد للجديد: **مصفوفة** `[{ ok, label, detail, hint }]` — `ok`
// صريحة. ⛔ ممنوع يرجّع قيمة أي سر — الاسم والطول والبصمة بس.
async function handleDiag(env, request) {
  const checks = [];
  const push = (ok, label, detail, hint) => checks.push({ ok, label, detail, hint });

  // ① السر — اسم وطول بس
  const s = env.WORKER_SECRET;
  const hasSecret = typeof s === 'string' && s.trim() !== '';
  push(hasSecret, 'سر الـ Worker',
       hasSecret ? `WORKER_SECRET=${String(s).length} حرف` : 'WORKER_SECRET=❌ ناقص',
       'Dashboard → Settings → Variables، وبعدها **Promote** للنسخة — من غير Promote القيمة بتفضل undefined');

  // ② بصمة سر المجموعة — الطول مش كافي لإثبات التوحيد
  const fp = await secretFingerprint(s);
  push(!!fp, 'بصمة WORKER_SECRET', fp
    ? `بصمة ${fp} · مجموعة warehouse_ops — لازم تطابق باقي الثمانية Workers`
    : 'مفيش سر — البصمة مستحيلة',
    'لو البصمة مختلفة عن باقي الأعضاء، المجموعة مكسورة والهب هيرجّع 401 من العضو المختلف بس');

  // ③ D1 — الـ binding وجدول الموظفين وصفوف الهب
  try {
    assertEnv(env);
    const emp = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM employees WHERE is_active = 1'
    ).first();
    push(true, 'D1 — جدول الموظفين', `متصل · ${emp?.n ?? 0} موظف نشط`);

    const rows = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM logs WHERE tool = ?'
    ).bind(TOOL_NAME).first();
    // ⚠️ **صفر صفوف مش دليل على حاجة** (`ecommoda-constants` §7.0) — ممكن
    //    الأداة لسه ما اشتغلتش، أو السجل اتنضّف. السطر ده للتشخيص بس.
    push(true, 'D1 — صفوف الهب', `${rows?.n ?? 0} صف تحت \`${TOOL_NAME}\` (دخول/خروج بس)`);
  } catch (e) {
    push(false, 'D1', `FAILED: ${e.message}`,
         'binding اسمه `DB` بالحرف في `wrangler.toml` — أي اسم تاني = كتابة فاشلة بصمت');
  }

  // ④ شوبيفاي — **مقصود إنه مش متصل**
  // ⚠️ السطر ده معلومة مش فحص: الـ Worker ده مالوش أي نداء لشوبيفاي، وغياب
  //    المفاتيح **مش عطل** — هو قرار (سطح الـ PIN بعيد عن مفاتيح المتجر).
  const hasShopify = !!(env.CLIENT_ID || env.CLIENT_SECRET || env.SHOP_DOMAIN);
  push(true, 'شوبيفاي',
       hasShopify
         ? '⚠️ فيه مفاتيح شوبيفاي على الـ Worker ده — مالهاش مستهلك، والمفروض تتشال'
         : 'مفيش مفاتيح — مقصود: الـ Worker ده دخول بس ومالوش أي نداء لشوبيفاي');

  // ⑤ الأصل
  const origin = request.headers.get('Origin') || '(بلا Origin)';
  push(ALLOWED_ORIGINS.includes(origin), 'الـ Origin', `${origin} · المسموح: ${ALLOWED_ORIGINS.join(', ')}`,
       'الواجهة لازم تتفتح من https://ecommoda-dev.github.io — الفتح من ملف محلي بيترفض');

  return json({ ok: checks.every(c => c.ok), version: WORKER_VERSION,
                tool: TOOL_NAME, cairoDate: cairoDate(), checks }, 200, request);
}

// ══════════════════════════════════════════════════════════════
// §HANDLER
// ══════════════════════════════════════════════════════════════
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: getCORS(request) });

    // 🔴 حارس السر الغايب **قبل** فحص الـ auth — من غيره القالب بينتج السلسلة
    //    الحرفية "Bearer undefined"، يعني أي طلب معاه الهيدر ده **بيعدّي**،
    //    والحالة اللي المفروض تبقى «كل حاجة 401» بتتحوّل لـ«الحماية اتشالت».
    if (typeof env.WORKER_SECRET !== 'string' || !env.WORKER_SECRET.trim())
      return json({ ok: false, error: 'WORKER_SECRET غير مضبوط على الـ Worker', step: 'env' }, 500, request);

    const auth = request.headers.get('Authorization');
    if (!auth || auth !== `Bearer ${env.WORKER_SECRET}`)
      return json({ error: 'Unauthorized' }, 401, request);

    const url    = new URL(request.url);
    const action = url.searchParams.get('action') || '';

    try {
      if (action === 'get_config')
        return json({ ok: true, version: WORKER_VERSION, WORKER_VERSION, tool: TOOL_NAME }, 200, request);

      if (action === 'diag') return await handleDiag(env, request);

      // ═══════════════════════════════════════════════════════════════
      // AUTH ENDPOINTS — منسوخة حرفيًا من
      // `ecommoda-worker-builder` → `references/auth-endpoints.md`
      // ⛔ ممنوع تتعدّل. أي فرق هنا عن باقي الستاك = موظف بيدخل من أداة
      //    ومايقدرش من أداة تانية بنفس الـ PIN.
      // ═══════════════════════════════════════════════════════════════
      assertEnv(env);

      // ── check_employee — GET (no sensitive data — GET is ok) ──────
      if (action === 'check_employee') {
        const username = url.searchParams.get('username');
        if (!username) return json({ ok: false, error: 'username مطلوب' }, 400, request);
        const result = await checkEmployee(env.DB, username);
        return json({ ok: true, ...result }, 200, request);
      }

      // ── register_pin — POST (PIN in body — GET is FORBIDDEN) ──────
      // ⚠️ **إنشاء PIN لأول مرة بس** — مش تغيير ولا إعادة ضبط (دول في
      //    الأدمن بانل). والـ PIN مشترك على الستاك كله، فاللي بيتعمل من هنا
      //    هو نفسه اللي بيدخل بيه محطة الشحن والتحصيل والأدوات المستقلة.
      if (action === 'register_pin') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        const { username, pin } = await request.json().catch(() => ({}));
        if (!username || !pin) return json({ ok: false, error: 'username و pin مطلوبان' }, 400, request);
        await registerPin(env.DB, username, pin);
        return json({ ok: true }, 200, request);
      }

      // ── verify_employee — POST (PIN in body — GET is FORBIDDEN) ───
      if (action === 'verify_employee') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        const { username, pin, appId } = await request.json().catch(() => ({}));
        if (!username || !pin) return json({ ok: false, error: 'username و pin مطلوبان' }, 400, request);

        const displayName = await verifyEmployee(env.DB, username, pin);
        if (!displayName) return json({ ok: false, error: 'PIN خطأ أو المستخدم غير موجود' }, 401, request);

        // ⚠️ الدخول نفسه نجح فعلاً هنا. فشل D1 بعد كده بيترجع `logged:false`
        //    — **مش** بيسقّط الرد كله على 500 لدخول حصل فعلاً (Step 5A ⑦).
        let logged = true;
        try {
          await writeLog(env.DB, {
            tool:     resolveAuthTool(appId),
            type:     'login',
            employee: username,
            notes:    `دخول: ${displayName}`,
          });
        } catch (e) {
          logged = false;
        }
        return json({ ok: true, displayName, logged }, 200, request);
      }

      // ── log_logout — GET ok (no sensitive data) ───────────────────
      if (action === 'log_logout') {
        const username = url.searchParams.get('username');
        const appId    = url.searchParams.get('appId');
        let logged = true;
        if (username) {
          try {
            await writeLog(env.DB, {
              tool:     resolveAuthTool(appId),
              type:     'logout',
              employee: username,
              notes:    `خروج: ${username.replace(/_/g, ' ')}`,
            });
          } catch (e) {
            logged = false;
          }
        }
        return json({ ok: true, logged }, 200, request);
      }

      // ── get_employees — GET (for HTML dropdown) ───────────────────
      if (action === 'get_employees') {
        const { results } = await env.DB.prepare(
          'SELECT username, display_name FROM employees WHERE is_active = 1 ORDER BY display_name'
        ).all();
        return json({ ok: true, employees: results }, 200, request);
      }
      // ═══════════════════════════════════════════════════════════════
      // END AUTH ENDPOINTS BLOCK
      // ═══════════════════════════════════════════════════════════════

      // 🔴 **مفيش `get_logs*` — والغياب مقصود.** الهب مالوش تاب سجل دخول،
      //    والأداة بتكتب صفّي دخول/خروج بس. endpoint بلا مستهلك = سطح بلا
      //    لازمة (نفس قرار الطابورين وأداتَي العهدة). لو اتطلب عرض سجل
      //    الدخول يومًا، مكانه شاشة الإحصائيات أو الأدمن بانل مش هنا.
      return json({ error: `Unknown action: ${action}` }, 404, request);
    } catch (e) {
      return json({ ok: false, error: e.message }, 500, request);
    }
  },
};
