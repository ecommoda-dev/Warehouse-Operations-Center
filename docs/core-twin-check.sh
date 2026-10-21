#!/usr/bin/env bash
# docs/core-twin-check.sh — `shared/core.js` لازم يبقى متطابق بالبايت في الهبّين.
#
# 🔴 مفيش ريبو «أصل»: الملف نسختين متطابقتين، والسكربت ده **بيقارن ويقول الفرق بس**.
#    ⛔ **مابينسخش ولا بيعدّل أي ملف** — أحمد هو اللي بيقرر أنهي نسخة الصح، وبعدها
#    التعديل بيتعمل بالإيد في الاتنين في نفس التمريرة.
#
# الاستخدام:  bash docs/core-twin-check.sh [مسار-الريبو-التاني]
#   من غير باراميتر بيدوّر على الريبو التاني جنب الريبو ده.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "$(basename "$HERE")" in
  Warehouse-Operations-Center)         OTHER_NAME=Delivery-COD-Operations-Center ;;
  Delivery-COD-Operations-Center)      OTHER_NAME=Warehouse-Operations-Center ;;
  *) echo "🔴 اسم الريبو مش معروف: $(basename "$HERE")"; exit 2 ;;
esac
OTHER="${1:-$HERE/../$OTHER_NAME}"
A="$HERE/shared/core.js"; B="$OTHER/shared/core.js"
[ -f "$A" ] || { echo "🔴 مش لاقي $A"; exit 2; }
[ -f "$B" ] || { echo "🔴 مش لاقي $B — الريبو التاني لازم يكون جنب ده أو تمرّر مساره"; exit 2; }
if cmp -s "$A" "$B"; then
  echo "✅ shared/core.js متطابق في الريبوهين ($(wc -l < "$A") سطر)"
  exit 0
fi
echo "🔴 shared/core.js مختلف بين الريبوهين — الفرق (< ده الريبو ده · > الريبو التاني):"
diff "$A" "$B"
echo
echo "⛔ السكربت ده مابينسخش ولا بيعدّل — اعرض الفرق على أحمد واستنى قراره."
exit 1
