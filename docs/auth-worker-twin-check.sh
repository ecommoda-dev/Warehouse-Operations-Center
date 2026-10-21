#!/usr/bin/env bash
# docs/auth-worker-twin-check.sh — `index.js` (Worker الدخول) لازم يبقى متطابق في الهبّين
# **خارج** كتلة `HUB_CONFIG` (بين `§HUB-CONFIG-BEGIN` و`§HUB-CONFIG-END`).
#
# 🔴 مفيش ريبو «أصل»: الملف نسختين، والسكربت ده **بيقارن ويقول الفرق بس**.
#    ⛔ **مابينسخش ولا بيعدّل أي ملف** — أحمد هو اللي بيقرر أنهي نسخة الصح.
# كمان بيتأكد إن كتلة الإعداد فيها نفس المفاتيح، وإن `wrangler.toml` لسه
# بيذكر `index.js` و`wrangler.toml` في `Build watch paths`.
#
# الاستخدام:  bash docs/auth-worker-twin-check.sh [مسار-الريبو-التاني]
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "$(basename "$HERE")" in
  Warehouse-Operations-Center)    OTHER_NAME=Delivery-COD-Operations-Center ;;
  Delivery-COD-Operations-Center) OTHER_NAME=Warehouse-Operations-Center ;;
  *) echo "🔴 اسم الريبو مش معروف: $(basename "$HERE")"; exit 2 ;;
esac
OTHER="${1:-$HERE/../$OTHER_NAME}"
rc=0
for d in "$HERE" "$OTHER"; do
  [ -f "$d/index.js" ] || { echo "🔴 مش لاقي $d/index.js"; exit 2; }
  grep -q '§HUB-CONFIG-BEGIN' "$d/index.js" && grep -q '§HUB-CONFIG-END' "$d/index.js" \
    || { echo "🔴 كتلة HUB_CONFIG ناقصة في $d/index.js"; exit 2; }
done
strip() { awk '/^\/\/ §HUB-CONFIG-BEGIN/{skip=1} !skip{print} /^\/\/ §HUB-CONFIG-END/{skip=0}' "$1"; }
keys()  { awk '/^\/\/ §HUB-CONFIG-BEGIN/{k=1} k && /^  [A-Z_]+:/{sub(/:.*/,""); gsub(/ /,""); print} /^\/\/ §HUB-CONFIG-END/{k=0}' "$1"; }
if diff <(strip "$HERE/index.js") <(strip "$OTHER/index.js") >/tmp/auth-twin.$$ 2>&1; then
  echo "✅ index.js متطابق خارج HUB_CONFIG ($(strip "$HERE/index.js" | wc -l) سطر)"
else
  echo "🔴 index.js مختلف خارج HUB_CONFIG — الفرق (< ده الريبو ده · > الريبو التاني):"; cat /tmp/auth-twin.$$; rc=1
fi
rm -f /tmp/auth-twin.$$
if [ "$(keys "$HERE/index.js")" = "$(keys "$OTHER/index.js")" ]; then
  echo "✅ HUB_CONFIG فيها نفس المفاتيح: $(keys "$HERE/index.js" | tr '\n' ' ')"
else
  echo "🔴 مفاتيح HUB_CONFIG مختلفة بين الريبوهين"; rc=1
fi
va=$(grep -oE "WORKER_VERSION: *'[^']+'" "$HERE/index.js"); vb=$(grep -oE "WORKER_VERSION: *'[^']+'" "$OTHER/index.js")
if [ "$va" = "$vb" ]; then echo "✅ WORKER_VERSION واحد في الاتنين ($va)"; else echo "🔴 WORKER_VERSION مختلف: $va ≠ $vb"; rc=1; fi
for d in "$HERE" "$OTHER"; do
  if grep -E 'Include paths|watch' "$d/wrangler.toml" >/dev/null && grep -q 'index.js' "$d/wrangler.toml" && grep -q 'wrangler.toml' "$d/wrangler.toml"; then
    echo "✅ $(basename "$d")/wrangler.toml بيذكر Build watch paths (index.js · wrangler.toml)"
  else echo "🔴 $(basename "$d")/wrangler.toml مابيذكرش Build watch paths"; rc=1; fi
done
[ $rc -ne 0 ] && echo "⛔ السكربت ده مابينسخش ولا بيعدّل — اعرض الفرق على أحمد واستنى قراره."
exit $rc
