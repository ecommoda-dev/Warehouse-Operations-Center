// ══════════════════════════════════════════════════════════════
// shared/gates.js — بوابات القنوات والمكتب والمرتجعات (مجال المخزن)
// ══════════════════════════════════════════════════════════════
//
// بوابة قناة الطباعة/بوسطة · أهلية «جاهز للتسليم للمكتب» · أهلية «جاهز للرجوع للمخزن».
// 🔴 ملف المجال **خاص بالهب ده بس** — مالوش مقابل في الريبو التاني، والـ core
//    (`core.js`) مايعرفش عنه. ترتيب التحميل: `hub-config.js` ← `core.js` ← ده.
// ══════════════════════════════════════════════════════════════


// أيقونة أداة «باركود SKU» — SVG لا إيموجي (قرار أحمد). `🏷️` كانت أيقونة
// «تاج سعر» ومش معبّرة عن باركود. الأشرطة بتوريث اللون (`fill="currentColor"`)
// وبتتحجّم بـ `1em` عشان تتصرّف زي حرف عادي جوّه أي نص — نفس مقاس `.app-icon`
// و`.eco-card-ico` بالظبط من غير أي CSS إضافي. **مصدر واحد**: أي صفحة تانية
// تعرض الأيقونة دي (وليس تعريف محلي) عشان الشكل مايفترقش مع أول تعديل (درس R1).
const ECO_ICON_BARCODE = '<svg viewBox="0 0 24 24" width="1em" height="1em" '
  + 'style="vertical-align:-0.14em" fill="currentColor" aria-hidden="true">'
  + '<rect x="2" y="3" width="2" height="18"/><rect x="6" y="3" width="1" height="18"/>'
  + '<rect x="9" y="3" width="3" height="18"/><rect x="14" y="3" width="1" height="18"/>'
  + '<rect x="17" y="3" width="1" height="18"/><rect x="20" y="3" width="2" height="18"/>'
  + '</svg>';

// ══════════════════════════════════════════════════════════════
// 🚚 §BOSTA-GATE — قناة الطباعة ومين بيتعرض فيها
// ══════════════════════════════════════════════════════════════
//
// 🔴 **في الـ shell عن قصد.** الشاشة الرئيسية و`Order-Printer.html` بيقروا **نفس**
//    رد `/orders` (ونفس الكاش `ECO_CACHE_PRINT`)، فلازم يعدّوا الأوردرات
//    بنفس القاعدة بالحرف. نسخة في كل صفحة = الرئيسية تقول ٦٦ والصفحة تفتح
//    على ٦ — وده بالظبط اللي حصل في v1.11.0 (درس R1).

// تاج «اترفع على داشبورد بوسطة». الرفع **بوابة إلزامية قبل الطباعة**
// (`ecommoda-order-lifecycle` → `zone-routing.md` §2.2)، والتاج ده أثرها
// الوحيد على شوبيفاي: غايب = مفيش شحنة = مستحيل تتطبع بوليصة.
//
// 🔴 **تاج لكل ماكينة — مش تاج واحد** (v1.24.0). الأوردر بياخد شحنة على
//    بوسطة **لكل دورة**: `Bosta_Uploaded_S1` لشحنة الشحن،
//    و`Bosta_Uploaded_S2` لشحنة الاسترجاع/الاستبدال. متأكَّد حيًا على
//    `#53822` (13-09-2026): التاجان الاتنين عليه، و
//    `bosta_tracking_number_s1 ≠ …_s2` — يعني **شحنتين مختلفتين فعلاً**.
// ⛔ **وممنوع صف S2 يعدّي بتاج S1.** ده بالظبط الفشل اللي الحارس موجود
//    عشانه: `#54244` عليه `Bosta_Uploaded_S1` بس وحالته
//    `Confirmed + EXCHANGE` — يعني شحنة الاستبدال **لسه ما اترفعتش**،
//    والطباعة عليه بترجّع بوليصة الشحنة الأصلية أو لا شيء.
const BOSTA_UPLOADED_TAGS = { S1: 'Bosta_Uploaded_S1', S2: 'Bosta_Uploaded_S2' };
function ecoBostaUploaded(o) {
  return (o.tags || []).includes(BOSTA_UPLOADED_TAGS[ecoMachineByType(o)]);
}

// القناة المعروضة. **الـ Worker هو مصدر قرار الطباعة** (`o.channel` =
// 'invoice' · 'awb' · null) — وده بيزوّد تفرقة **عرض** واحدة بس: الشو روم
// بيتفصل عن قاهرة+جيزة عشان العدّ والفلترة، والاتنين بيطبعوا نفس الفاتورة.
// ⛔ ممنوع أي خريطة زون→قناة تانية في أي صفحة.
const ZONE_SHOWROOM = 'Show_Room';
function ecoChannelOf(o) {
  if (o.zone === ZONE_SHOWROOM && o.channel === 'invoice') return 'showroom';
  if (o.channel === 'awb')     return 'awb';
  if (o.channel === 'invoice') return 'invoice';
  return 'none';
}

// «الصف ده بيتعرض في القناة دي ولا لأ؟» — بترجّع `null` = معروض، أو **سبب
// الاستبعاد بالاسم**. السبب مش رفاهية: كل مستبعَد بيتعدّ وبيتقال للموظف،
// عشان الغياب يبقى **معلوم** مش خفي.
function ecoChannelGate(o, chan) {
  if (ecoChannelOf(o) !== chan) return 'other-channel';
  if (chan === 'awb') {
    // 🔴 **بند `s2` اتشال في v1.24.0** (قرار أحمد 14-09-2026). كان: «S2 على
    //    بوسطة مخفية مؤقتًا» (أحمد 07-09-2026) — والإخفاء ده كان **حارس
    //    بالنيابة**: الـ Worker وقتها كان بيفلتر شحنات بوسطة على `Send` بس،
    //    فصف S2 كان هياخد بوليصة شحنة الشحن. الحارس الحقيقي بقى في مكانه
    //    (`MACHINE_TYPE_CODES` في Worker v2.8.0 — فلترة على نوع الشحنة)،
    //    فالإخفاء بقى منع لشغل مشروع.
    //    ⚠️ والدليل إنه كان بيمنع شغل حقيقي: `#53822` اتطبعت بوليصة S2
    //    بتاعته و`printing_time_s2` اتكتب **بالإيد** يوم 13-09-2026.
    // لسه ما اترفعش على داشبورد بوسطة — مفيش شحنة، فمفيش بوليصة.
    // ⚠️ والتاج **بتاع ماكينة الصف** مش تاج S1 دايمًا — فوق في §BOSTA-GATE.
    if (!ecoBostaUploaded(o)) return 'not-uploaded';
  }
  return null;
}

// ══════════════════════════════════════════════════════════════
// 🏢 §OFFICE-GATE — «الأوردر ده جاهز للتسليم للمكتب؟»
// ══════════════════════════════════════════════════════════════
//
// 🔴 **الفلترة في الواجهة بقرار، والمصدر واحد** (قرار أحمد 15-09-2026).
//    السبب مش تفضيل معماري — `custom.package_whereabouts_s1` **مش قابل
//    للفلترة** في بحث شوبيفاي: الفلتر عليه بيتجاهَل **في صمت** ويرجّع المتجر
//    كله (١٠٬٠٠٠ صف — مقيس 15-09-2026). فالـ Worker بيجيب اللي حالته `Ready`
//    بس، والأهلية بتتحسب هنا.
//
// ⛔ **وعشان كده مكانها الـ shell مش الصفحة.** `Package-Transfer-To-Office.html`
//    و`index.html` بينادوا **نفس الدالة** على **نفس الرد**. نسخة تانية في
//    صفحة = درس R1 بالحرف (v1.11.0: الرئيسية قالت «بوسطة ٦٦» والصفحة فتحت
//    على ٦، لأن البوابة كانت في `Order-Printer.html` لوحدها). ممنوع أي صفحة تعرّفهم
//    تاني — تعريف في صفحة بيغلب الـ shell (بيتحمّل قبلها) والقاعدتين
//    هيفترقوا **في صمت**.
//
// 🔴 **ودي بوابة عرض — مش حارس كتابة.** الحارس الحقيقي في الـ Worker
//    (`?action=scan`)، وهو اللي بيقرا الأوردر **حيًّا** وقت الضغطة. الجدول
//    ده لقطة عمرها لحد ١٥ دقيقة، وحارس في الواجهة بس **مش حارس**
//    (`ecommoda-order-lifecycle` §1.5 — نفس درس §ELIGIBILITY في التغليف).

// عهدة الطرد — القيم حرفية (`ecommoda-constants` §1)
const ECO_WHEREABOUTS = { WAREHOUSE: 'Warehouse', OFFICE: 'Office', COURIER: 'Courier' };

// 🔴 نطاق المكتب: قاهرة+جيزة والشو روم بس. `Other_Regions` (بوسطة) **خارج
//    النطاق بالكامل** — بوسطة بتستلم من المخزن نفسه، وطردها عمره ما بيعدّي
//    على المكتب، وتتبّعه بييجي من بوسطة (`ecommoda-order-lifecycle` قاعدة ١٧).
//    ⚠️ من غير الشرط ده الطابور كان هيعرض **٤٠ أوردر بوسطة** (تلت الـ Ready
//       يوم القياس 15-09-2026)، ونفس الأوردر يتعدّ في صفّين على الشاشة
//       الرئيسية: «جاهز لتسليم بوسطة» و«جاهز للتسليم للمكتب».
const ECO_OFFICE_ZONES = ['Cairo+Giza', 'Show_Room'];

// بيرجّع { eligible, machine, code, reason }:
//   machine: 's1' | 's2' | null — أنهي عهدة هتتكتب (`_s1` ولا `_s2`)
//   code:    سبب الاستبعاد — للتشخيص، والواجهة مابتعرضهوش في الطابور
function ecoOfficeGate(o) {
  if (!o) return { eligible: false, machine: null, code: 'none', reason: 'مفيش أوردر' };

  // ① ملغي — **قبل كل حاجة**: أوردر ملغي متغلّف لازم يتقال عنه «ملغي» مش
  //    «مش في الطابور». ده بالظبط السيناريو اللي الحقل اتعمل عشانه: أوردر
  //    اتغلّف وبعدين اتلغى، والموظف خده المكتب مع الدفعة وفضل هناك.
  if (o.cancelledAt || o.s1 === 'Cancelled')
    return { eligible: false, machine: null, code: 'cancelled', reason: 'الأوردر ملغي' };

  // ② خارج النطاق — بوسطة
  if (o.courier === 'Bosta' || o.zone === 'Other_Regions')
    return { eligible: false, machine: null, code: 'bosta', reason: 'الشحنة مع بوسطة' };
  if (!ECO_OFFICE_ZONES.includes(o.zone || ''))
    return { eligible: false, machine: null, code: 'zone', reason: `زون «${o.zone || 'فاضي'}» مش من نطاق المكتب` };

  // ③ الماكينة — S1 الأول، و S2 **بشرط** إن S1 وصل Delivered (نفس شرط سكانر
  //    بوسطة بالحرف). أوردر عليه S2 = Ready و S1 لسه Shipped حالة شاذة —
  //    بتترفض هنا، والـ Worker بيسمّي السبب وقت السكان.
  let machine = null;
  if (o.s1 === 'Ready') machine = 's1';
  else if (o.s2 === 'Ready' && o.s1 === 'Delivered') machine = 's2';
  if (!machine)
    return { eligible: false, machine: null, code: 'status', reason: 'الحالة مش Ready' };

  // ④ متغلّف فعلاً — **بميتافيلد الماكينة بتاعتها**
  // 🔴 صف S2 بيتفحص بـ`s2_packing_date_time` مش `s1_…`. الفحص بـ`s1_…` على
  //    صف S2 بيعدّي على طرد **ما اتغلّفش**: مقيس حيًا 15-09-2026 — ٦ من ٦
  //    صفوف S2 كانت هتعدّي، والصح **٢**.
  const packedAt = machine === 's1' ? o.packedAtS1 : o.packedAtS2;
  if (!packedAt)
    return { eligible: false, machine, code: 'not_packed', reason: 'ما اتغلّفش لسه' };

  // ⑤ العهدة الحالية — `Warehouse` أو فاضية بس
  // ⚠️ الفاضية مقبولة **عن قصد**: أداة التغليف هي اللي المفروض تكتب
  //    `Warehouse` وقت التغليف، ولسه ما اتعدّلتش (بند مفتوح). يوم 15-09-2026
  //    الحقل **فاضي على كل أوردر في المتجر**، فلو الفاضي اترفض الطابور كان
  //    هيفتح **فاضي**.
  const cur = machine === 's1' ? o.whereaboutsS1 : o.whereaboutsS2;
  if (cur === ECO_WHEREABOUTS.OFFICE)
    return { eligible: false, machine, code: 'already_office', reason: 'في المكتب خلاص' };
  if (cur === ECO_WHEREABOUTS.COURIER)
    return { eligible: false, machine, code: 'at_courier', reason: 'مع المندوب' };
  if (cur && cur !== ECO_WHEREABOUTS.WAREHOUSE)
    return { eligible: false, machine, code: 'unknown_whereabouts', reason: `عهدة غير معروفة: «${cur}»` };

  return { eligible: true, machine, code: 'ok', reason: '' };
}

// بيرجّع المؤهلين بس، بترتيب **الأقدم تغليفًا الأول** — الطرد اللي قاعد من
// الصبح هو اللي المفروض يتنقل الأول، والترتيب بتاريخ الأوردر كان هيحط طرد
// اتغلّف دلوقتي فوق طرد قاعد من امبارح.
// ⚠️ **و`whereabouts` بيتلزق على الصف زي `ecoWarehouseQueue` بالظبط** —
//    عمود «موقع الشحنة» في `Package-Transfer-To-Office.html` بيقرا منه. والقيم اللي
//    ممكن توصل هنا **اتنين بس** (`Warehouse` أو فاضي)، لأن البوابة فوق
//    بتستبعد `Office` و`Courier` وأي قيمة بره القايمة قبل ما يوصل الصف.
//    🔴 يعني العمود ده **مش تكرار لعمود المرتجعات** — هناك بيفرّق بين تلات
//       مصادر رجوع، وهنا بيجاوب سؤال واحد: «إحنا مسجّلين إن الطرد في المخزن
//       ولا لسه ما اتسجّلش؟».
function ecoOfficeQueue(orders) {
  const out = [];
  for (const o of orders || []) {
    const g = ecoOfficeGate(o);
    if (g.eligible) out.push({ ...o, machine: g.machine,
                               packedAt: o.packedAtS1 || null,
                               packedBy: o.packedByS1 || null,
                               whereabouts: (g.machine === 's1' ? o.whereaboutsS1 : o.whereaboutsS2) || null });
  }
  out.sort((a, b) => String(a.packedAt || '').localeCompare(String(b.packedAt || '')));
  return out;
}

// ══════════════════════════════════════════════════════════════
// 🏭 §WAREHOUSE-GATE — «الطرد ده راجع للمخزن؟»
// ══════════════════════════════════════════════════════════════
//
// 🔴 **دي معكوس §OFFICE-GATE فوق على نفس الحقل بالظبط.** هناك الطرد **خارج**
//    (`Ready` → `Office`)؛ هنا الطرد **راجع** (`Returned`/`Cancelled` →
//    `Warehouse`). الاتنين بيقروا نفس الميتافيلدات من نفس شكل الرد، والفرق
//    كله في شرط الأهلية وفي القيمة.
//
// ⛔ **وأخطر حاجة ممكن تحصل هنا: نسخ حارس الإلغاء من §OFFICE-GATE.** هناك
//    `cancelledAt` **أول سبب رفض**؛ هنا هو **شرط أهلية**. النسخة الغلط
//    بتخلّي الطابور يستبعد أكبر شريحة عنده — **وصفر خطأ في الكونسول**.
//
// 🔴 **ومكانها الـ shell مش الصفحة** — نفس سبب §OFFICE-GATE بالحرف:
//    `Package-Transfer-To-Warehouse.html` و`index.html` بينادوا **نفس الدالة** على **نفس
//    الرد**. نسخة تانية في صفحة = درس R1 بالحرف (v1.11.0: الرئيسية قالت
//    «بوسطة ٦٦» والصفحة فتحت على ٦). ممنوع أي صفحة تعرّفهم تاني — تعريف في
//    صفحة بيغلب الـ shell (بيتحمّل قبلها) والقاعدتين هيفترقوا **في صمت**.
//
// 🔴 **ودي بوابة عرض — مش حارس كتابة.** الحارس الحقيقي في الـ Worker
//    (`?action=scan`)، وهو اللي بيقرا الأوردر **حيًّا** وقت الضغطة.

// 🔴 الحالات المؤهلة — الفرق الجوهري عن بوابة المكتب
const ECO_WH_S1_ELIGIBLE = ['Returned', 'Cancelled'];
const ECO_WH_S2_ELIGIBLE = ['Returned'];

// 🔴 نفس نطاق المكتب بالحرف: قاهرة+جيزة والشو روم بس.
// ⚠️ **والاستبعاد هنا أضعف من نظيره في المكتب ولازم يتقال:** مرتجع بوسطة
//    **بيرجع المخزن فعلاً**، بخلاف طرد بوسطة الخارج اللي عمره ما بيعدّي على
//    المكتب. اللي بيبرّره إن `package_whereabouts` مش بيتتبع لطرود بوسطة
//    أصلاً (`ecommoda-order-lifecycle` قاعدة ١٧) وإن مرتجعاتها ليها أداتها
//    («قسم مرتجعات بوسطة»). التحفّظ الكامل في
//    `Package-Transfer-To-Warehouse/CLAUDE.md` §النطاق.
// ⛔ لو اتغيّر، يتغيّر **هنا وفي `ZONE_IN_SCOPE` في الـ Worker** في نفس
//    التمريرة (درس R1).
const ECO_WAREHOUSE_ZONES = ['Cairo+Giza', 'Show_Room'];

// بيرجّع { eligible, machine, code, reason }:
//   machine: 's1' | 's2' | null — أنهي عهدة هتتكتب (`_s1` ولا `_s2`)
//   code:    سبب الاستبعاد — للتشخيص، والواجهة مابتعرضهوش في الطابور
function ecoWarehouseGate(o) {
  if (!o) return { eligible: false, machine: null, code: 'none', reason: 'مفيش أوردر' };

  // ① خارج النطاق — بوسطة (نفس ترتيب الـ Worker بالحرف)
  if (o.courier === 'Bosta' || o.zone === 'Other_Regions')
    return { eligible: false, machine: null, code: 'bosta', reason: 'مرتجع بوسطة — ليه أداته' };
  if (!ECO_WAREHOUSE_ZONES.includes(o.zone || ''))
    return { eligible: false, machine: null, code: 'zone', reason: `زون «${o.zone || 'فاضي'}» مش من نطاق الأداة` };

  // ② الماكينة — S1 الأول (زي بوابة المكتب)، و S2 بعده
  // ⚠️ `cancelledAt` مؤهل زي `Cancelled` بالظبط — الطرد راجع سواء الإلغاء
  //    اتكتب في الميتافيلد ولا لأ.
  const s1Eligible = ECO_WH_S1_ELIGIBLE.includes(o.s1 || '') || !!o.cancelledAt;
  const s2Eligible = ECO_WH_S2_ELIGIBLE.includes(o.s2 || '');
  let machine = null;
  if (s1Eligible)      machine = 's1';
  else if (s2Eligible) machine = 's2';
  if (!machine)
    return { eligible: false, machine: null, code: 'status', reason: 'لا مرتجع ولا ملغي' };

  // ③ متغلّف فعلاً — **وقت تغليف الشحنة الأصلية (S1)** على الماكينتين
  // 🔴 **v1.52.0 (قرار أحمد 22-10-2026):** الشرط كان بيفحص `s2_packing_date_time`
  //    على صف S2، فكل **استرجاع خالص** (`#53764`) كان بيترفض ومش بيظهر في
  //    الطابور — مع إن الطرد الراجع هو الشحنة الأصلية اللي اتغلّفت وخرجت، ومفيش
  //    طرد S2 اتغلّف أصلاً. فحص `s2_…` صح في بوابة المكتب (الطرد **الخارج**)،
  //    **غلط هنا** (الطرد **الراجع**). ⛔ ممنوع الرجوع لـ`machine === 's1' ? …S1 : …S2`.
  // ⚠️ ومش بنفرّق بين استرجاع واستبدال: `exchangeLineItems` الفاضي مش دليل إنها
  //    استرجاع (`ecommoda-order-lifecycle` قاعدة ٨).
  // ⚠️ **ومعنى الشرط هنا أقوى:** أوردر اتلغى قبل ما يتغلّف **مفيهوش طرد أصلاً**
  //    — مفيش حاجة ترجع على الرف.
  // ⛔ نفس الشرط في `evaluate` بتاع الـ Worker (`packedAtOf`) في نفس التمريرة.
  if (!o.packedAtS1)
    return { eligible: false, machine, code: 'not_packed', reason: 'ما اتغلّفش — مفيش طرد يرجع' };

  // ④ العهدة الحالية — **`Office` وبس** (قرار أحمد 19-09-2026)
  // 🔴 البوابة دي كانت بتقبل `Office` و`Courier` **والفاضي**، وبقت بتقبل
  //    **`Office` لوحدها**. الطابور دلوقتي بيجاوب سؤال واحد بالظبط:
  //    «أنهي طرد **مسجّل إنه في المكتب** ولسه ما رجعش؟» — وهي الفجوة اللي
  //    الأداة دي اتعملت عشانها أصلاً (`known-gaps.md` G-17: قيمة `Office`
  //    كانت **بلا طريق رجوع**).
  // 🔴 **والفاضي بقى مستبعَد عن قصد — وده أكبر أثر في التغيير.** الفاضي
  //    معناه **«إحنا مش عارفين الطرد ده كان فين»**، وقايمة مبنية على «مش
  //    عارفين» مش طابور شغل — دي كل المرتجعات والملغيات في النطاق.
  // ⛔ **وده فلتر عرض بس — مش شرط أهلية.** `evaluate` في الـ Worker **ما
  //    اتلمستش**: الأوردر اللي عهدته `Courier` أو فاضية **بيتسكن ويتسجّل
  //    عادي**، هو مش في القايمة وبس. نفس قاعدة §ORDERS-SINCE بالحرف
  //    («القايمة عرض والـ Worker مرجع»).
  // ⚠️ **والثمن لازم يتقال:** `Office` مابيكتبهاش غير «قسم تسليمات المكتب»،
  //    وهو **لسه ما اتنشرش**. يعني الطابور هيفتح **فاضي** لحد ما الأداة دي
  //    تشتغل وتبدأ تكتب — وده **السلوك الصح** (مفيش طرد مسجّل في المكتب
  //    فعلاً)، بس لازم يكون متوقّع.
  const cur = machine === 's1' ? o.whereaboutsS1 : o.whereaboutsS2;
  if (cur === ECO_WHEREABOUTS.WAREHOUSE)
    return { eligible: false, machine, code: 'already_warehouse', reason: 'في المخزن خلاص' };
  if (cur !== ECO_WHEREABOUTS.OFFICE)
    return { eligible: false, machine, code: 'not_in_office',
             reason: cur ? `عهدة «${cur}» — الطابور بيعرض اللي في المكتب بس`
                         : 'العهدة مش مسجّلة — الطابور بيعرض اللي في المكتب بس' };

  return { eligible: true, machine, code: 'ok', reason: '' };
}

// بيرجّع المؤهلين بس، بترتيب **الأقدم تغليفًا الأول** — نفس ترتيب
// `ecoOfficeQueue` بالحرف.
// 🔴 **كان بترتيب `updatedAt`، واتشال بقرار أحمد 19-09-2026 مع العمود نفسه.**
//    `updatedAt` كان **تقريب مش تسجيل**: شوبيفاي مالهاش حقل بيقول «الطرد رجع
//    إمتى»، والقيمة بتتحرّك مع أي تعديل — وعملية جماعية واحدة كانت بتخلّي
//    صفوف كتير تقول نفس التاريخ، فالترتيب نفسه كان مبني على رقم مش بيقيس
//    الانتظار. وقت التغليف **مش مثالي هنا** (الطرد ممكن يكون اتغلّف من شهر)،
//    بس هو **وقت مسجّل فعلاً** بدل تقريب بيتحرّك لوحده.
// ⛔ ممنوع الرجوع لـ`updatedAt` — لا كترتيب ولا كعمود — إلا لما يبقى فيه
//    تسجيل حقيقي لوقت الرجوع.
function ecoWarehouseQueue(orders) {
  const out = [];
  for (const o of orders || []) {
    const g = ecoWarehouseGate(o);
    if (g.eligible) out.push({ ...o, machine: g.machine,
                               packedAt: o.packedAtS1 || null,
                               packedBy: o.packedByS1 || null,
                               whereabouts: (g.machine === 's1' ? o.whereaboutsS1 : o.whereaboutsS2) || null });
  }
  out.sort((a, b) => String(a.packedAt || '').localeCompare(String(b.packedAt || '')));
  return out;
}
