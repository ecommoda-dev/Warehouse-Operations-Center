// فحص CSS بـ parser حقيقي — مش grep. بيتأكد إن كتلة التوكنز موجودة **كقاعدة**
// مش مبلوعة جوّه selector غلط، وإن كل var(--x) مستخدمة معرّفة فعلاً.
const postcss = require('postcss')   // ثبّته بـ npm i postcss --no-save قبل الفحص;
const fs = require('fs');
const path = require('path');

function blocks(file) {
  const src = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.css')) return [{ css: src, where: file }];
  return [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m, i) => ({ css: m[1], where: `${file} <style#${i}>` }));
}

let bad = 0;
const defined = new Set();
const used = [];

for (const file of process.argv.slice(2)) {
  for (const { css, where } of blocks(file)) {
    let root;
    try { root = postcss.parse(css, { from: where }); }
    catch (e) { console.log(`❌ ${where}: parse error — ${e.message}`); bad++; continue; }

    let rootRules = 0;
    root.walkRules(rule => {
      // كتلة التوكنز لازم تكون selector نضيف
      if (rule.selector.includes(':root')) {
        rootRules++;
        if (rule.selector.trim() !== ':root') {
          console.log(`❌ ${where}: كتلة التوكنز اتبلعت جوّه selector غلط →`);
          console.log(`   ${JSON.stringify(rule.selector.slice(0, 120))}`);
          bad++;
        }
        rule.walkDecls(d => { if (d.prop.startsWith('--')) defined.add(d.prop); });
      }
      rule.walkDecls(d => {
        for (const m of d.value.matchAll(/var\(\s*(--[\w-]+)/g)) used.push([m[1], where, rule.selector.slice(0,60)]);
      });
    });
    // ستراي */ أو /* مش مقفول
    const stray = css.replace(/\/\*[\s\S]*?\*\//g, '');
    if (stray.includes('*/') || stray.includes('/*')) {
      console.log(`❌ ${where}: علامة تعليق شاردة (تعليق مقفول بدري أو مش مقفول)`);
      bad++;
    }
    console.log(`   ${where}: ${rootRules} كتلة توكنز · ${root.nodes.length} عقدة`);
  }
}

const missing = [...new Set(used.filter(([v]) => !defined.has(v)).map(([v, w, s]) => `${v}  (${w} · ${s})`))];
if (missing.length) { console.log(`\n❌ متغيّرات مستخدمة ومش معرّفة (${missing.length}):`); missing.slice(0,25).forEach(m => console.log('   ' + m)); bad++; }
console.log(bad ? `\n❌ فشل — ${bad} مشكلة` : `\n✅ عدّى — ${defined.size} توكن معرّف · ${used.length} استخدام`);
process.exit(bad ? 1 : 0);
