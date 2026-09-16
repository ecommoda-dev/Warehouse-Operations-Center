#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# docs/label-twin-check.sh — كاشف انحراف «ماكينة الليبل»
# ══════════════════════════════════════════════════════════════
#
# ماكينة الليبل المطبوع (2×1 إنش) **مكرّرة عن قصد** في ملفين:
#   · pack.html         — زرار «🏷️ باركود المنتجات» في شاشة التغليف
#   · sku-barcode.html  — أداة باركود SKU
#
# 🔴 الكتلتان لازم يفضلوا **متطابقين بايت ببايت**. الفشل لو افترقوا
#    **مالوش صوت**: الليبل بيتقص من تحت في صمت (`overflow:hidden`)،
#    وبياكل من خطوط الباركود نفسها، والسكانر بيبطّل يقرا — وصفر خطأ
#    في الكونسول. الملف ده بيحوّل الانحراف الصامت ده لفشل معلن.
#
# ✅ والمكسب التاني: `docs/sku-barcode-check.mjs` بيقيس النسخة اللي في
#    `sku-barcode.html` في متصفح حقيقي. فطول ما الفحص ده عدّى **والتوأمان
#    متطابقين**، النسخة اللي في `pack.html` متغطية **بالوراثة**.
#
# ⚠️ اللي الفحص ده **مابيمسكهوش**: سطر `<script src="…jsbarcode@3.11.6…">`
#    في `<head>` — بره العلامتين في الملفين. نسخة مختلفة = عرض خطوط مختلف
#    من غير أي فرق في الـ diff. البند ده متحقّق تحت بفحص منفصل.
#
# الاستخدام من جذر الريبو:  bash docs/label-twin-check.sh
set -u
cd "$(dirname "$0")/.."

A=pack.html
B=sku-barcode.html
fail=0

extract() {   # extract <file> <bloc-index 1|2>
  awk -v want="$2" '
    /§LABEL-MACHINE — ماكينة الليبل المطبوع/ { n++; if (n==want) grab=1 }
    grab { print }
    grab && /§LABEL-END — آخر ماكينة الليبل/ { grab=0 }
  ' "$1"
}

for i in 1 2; do
  case $i in
    1) what="كتلة CSS" ;;
    2) what="كتلة JS"  ;;
  esac
  a=$(extract "$A" $i)
  b=$(extract "$B" $i)
  if [ -z "$a" ] || [ -z "$b" ]; then
    echo "❌ $what — العلامتان مش موجودين في أحد الملفين (أو الترتيب اتغيّر)"
    fail=1
    continue
  fi
  if [ "$a" = "$b" ]; then
    echo "✅ $what — التوأمان متطابقان ($(printf '%s' "$a" | wc -l) سطر)"
  else
    echo "❌ $what — التوأمان افترقوا:"
    diff <(printf '%s\n' "$a") <(printf '%s\n' "$b") | sed 's/^/    /'
    fail=1
  fi
done

# نسخة JsBarcode — بره العلامتين، فمحتاجة فحص خاص بيها
va=$(grep -o 'jsbarcode@[0-9.]*' "$A" | head -1)
vb=$(grep -o 'jsbarcode@[0-9.]*' "$B" | head -1)
if [ -n "$va" ] && [ "$va" = "$vb" ]; then
  echo "✅ نسخة JsBarcode واحدة في الملفين ($va)"
else
  echo "❌ نسخة JsBarcode مختلفة أو ناقصة — $A: '${va:-مفقودة}' · $B: '${vb:-مفقودة}'"
  fail=1
fi

[ $fail -eq 0 ] && echo "── التوأمان سليمان ──" || echo "── فيه انحراف، صلّحه في نفس التمريرة ──"
exit $fail
