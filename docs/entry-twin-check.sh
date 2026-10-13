#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# docs/entry-twin-check.sh — كاشف انحراف «قاعدة مهلة السكانر»
# ══════════════════════════════════════════════════════════════
#
# مهلة السكانر (سكانة ١٥٠ms · كتابة ٤٠٠ms) لازم تفضل **واحدة** في:
#   · Orders-Packing-Checker.html     — مربعات التغليف
#   · Order-SKU-Barcode-Printer.html  — شريط الإدخال الموحّد (v1.37.0)
#
# 🔴 الموظف بيتنقّل بين الصفحتين والسكانر في إيده، ومهلة مختلفة = «سكنت
#    وماحصلش حاجة» (أو سكانة اتقطعت في نصها). الفشل **مالوش صوت**.
#
# ⚠️ **التوأمة بقت على القاعدة مش على الكود كله**: `bindScannerInput` ما
#    بقتش في صفحة الباركود (الحقل الموحّد محتاج المهلة مشروطة بالمسار)،
#    فالملف ده بيقارن **تعبير المهلة** نفسه — مش دالة بعينها.
#
# الاستخدام من جذر الريبو:  bash docs/entry-twin-check.sh
set -u
cd "$(dirname "$0")/.."

A=Orders-Packing-Checker.html
B=Order-SKU-Barcode-Printer.html
fail=0
PAT='gap < [0-9]+ \? [0-9]+ : [0-9]+'

exprs() { grep -Eo "setTimeout\([A-Za-z]+, $PAT\)" "$1" | sed -E 's/setTimeout\([A-Za-z]+, //; s/\)$//' | sort -u; }

ea=$(exprs "$A"); eb=$(exprs "$B")

if [ -z "$ea" ] || [ -z "$eb" ]; then
  echo "❌ تعبير المهلة مش موجود في أحد الملفين (A: '${ea}' · B: '${eb}')"; fail=1
elif [ "$ea" != "$eb" ]; then
  echo "❌ المهلة افترقت — $A: [$ea] · $B: [$eb]"; fail=1
elif [ "$(printf '%s\n' "$ea" | wc -l)" -ne 1 ]; then
  echo "❌ أكتر من تعبير مهلة واحد في $A: [$ea]"; fail=1
else
  echo "✅ المهلة واحدة في الصفحتين: $ea"
fi

exit $fail
