#!/usr/bin/env bash
# docs/bosta-upload-twin-check.sh — `Bosta-Orders-Upload.html` لازم تبقى متطابقة بالبايت في الهبّين
# (الشحن والتحصيل · المخزن) — نفس نمط `core-twin-check.sh`.
#
# 🔴 مفيش ريبو «أصل»: الملف نسختين، والسكربت ده **بيقارن ويقول الفرق بس**.
#    ⛔ **مابينسخش ولا بيعدّل أي ملف** — أحمد هو اللي بيقرر أنهي نسخة الصح، وبعدها
#    التعديل بيتعمل بالإيد في الاتنين في نفس التمريرة.
# كمان بيتأكد إن كل هب فيه اللي الصفحة بتنده عليه برّاها (من غير ما الصفحة نفسها تختلف):
#   · `ECO_WORKERS.bostaUpload` و`ECO_HUB.name` في `shared/hub-config.js`
#   · `ECO_CACHE_BOSTA_UPLOAD` في `shared/hub-config.js` و`bostaCacheSet`/`bostaCacheGet` في `shared/core.js`
#   · إن الصفحة مابتحمّلش ملف مجال (`dco-rules.js` · `gates.js`) — مش موجود في الهبّين بنفس الاسم
#
# الاستخدام:  bash docs/bosta-upload-twin-check.sh [مسار-الريبو-التاني]
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "$(basename "$HERE")" in
  Warehouse-Operations-Center)         OTHER_NAME=Delivery-COD-Operations-Center ;;
  Delivery-COD-Operations-Center)      OTHER_NAME=Warehouse-Operations-Center ;;
  *) echo "🔴 اسم الريبو مش معروف: $(basename "$HERE")"; exit 2 ;;
esac
OTHER="${1:-$HERE/../$OTHER_NAME}"
PAGE=Bosta-Orders-Upload.html
rc=0
if grep -qE "src=\"shared/(dco-rules|gates)\.js\"" "$HERE/$PAGE"; then echo "🔴 $PAGE بتحمّل ملف مجال — مش موجود في الهبّين بنفس الاسم"; rc=1; fi
A="$HERE/$PAGE"; B="$OTHER/$PAGE"
[ -f "$A" ] || { echo "🔴 مش لاقي $A"; exit 2; }
[ -f "$B" ] || { echo "🔴 مش لاقي $B — الريبو التاني لازم يكون جنب ده أو تمرّر مساره"; exit 2; }
if cmp -s "$A" "$B"; then
  echo "✅ $PAGE متطابقة في الريبوهين ($(wc -l < "$A") سطر)"
else
  echo "🔴 $PAGE مختلفة بين الريبوهين — الفرق (< ده الريبو ده · > الريبو التاني):"
  diff "$A" "$B"; echo; rc=1
fi
for R in "$HERE" "$OTHER"; do
  N="$(basename "$R")"
  grep -q "bostaUpload *:" "$R/shared/hub-config.js" && echo "✅ $N: ECO_WORKERS.bostaUpload" || { echo "🔴 $N: ECO_WORKERS.bostaUpload ناقصة في hub-config.js"; rc=1; }
  grep -qE "^ *name *:" "$R/shared/hub-config.js" && echo "✅ $N: ECO_HUB.name" || { echo "🔴 $N: ECO_HUB.name ناقصة في hub-config.js"; rc=1; }
  grep -qE "^const ECO_CACHE_BOSTA_UPLOAD *=" "$R/shared/hub-config.js" && echo "✅ $N: ECO_CACHE_BOSTA_UPLOAD" || { echo "🔴 $N: ECO_CACHE_BOSTA_UPLOAD ناقص في hub-config.js"; rc=1; }
  for f in bostaCacheSet bostaCacheGet; do
    grep -qE "^function $f\(" "$R/shared/core.js" && echo "✅ $N: $f (core.js)" || { echo "🔴 $N: $f مش معرّفة في core.js"; rc=1; }
  done
done
[ $rc -ne 0 ] && echo "⛔ السكربت ده مابينسخش ولا بيعدّل — اعرض الفرق على أحمد واستنى قراره."
exit $rc
