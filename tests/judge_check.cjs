// 判定ラベルの検査。実行：node tests/judge_check.cjs
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fns=html.split('\n').filter(l=>/^function (judgeValue|pctClass|badgeClass|badgeText)\(/.test(l)).join('\n');
const c={};vm.createContext(c);vm.runInContext(fns,c);
const J=(a,d)=>c.badgeText(a/d*100);
const cases=[
 [1200,1000,'過大'],[1101,1000,'過大'],
 [3960,3600,'適正'],[1100,1000,'適正'],[110,100,'適正'],
 [1000,1000,'適正'],[950,1000,'適正'],
 [949,1000,'やや不足'],[850,1000,'やや不足'],
 [849,1000,'要確認'],[0,1000,'要確認'],
];
let ng=0;
for(const [a,d,want] of cases){const got=J(a,d);const ok=got===want;if(!ok)ng++;console.log(`${ok?'合':'否'} 実測${a}/設計${d} → ${got}（期待 ${want}）`);}
// 110% ちょうどが小数の誤差で外れないことを全数で確かめる
let miss=0;for(let d=1;d<=10000;d++){if(d%10===0){if(J(d*11/10,d)!=='適正')miss++;}}
console.log(`110%ちょうどの誤判定 ${miss}件`);
// 色の分類も文字と揃っていること
assert.strictEqual(c.badgeClass(120),'badge-warn');assert.strictEqual(c.pctClass(120),'pct-amber');
assert.strictEqual(c.badgeClass(100),'badge-ok');assert.strictEqual(c.pctClass(50),'pct-red');
if(ng||miss){console.log('不合格');process.exit(1);}console.log('合格');
