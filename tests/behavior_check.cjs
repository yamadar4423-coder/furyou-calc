// 計算ボタンから結果表示までの検査。実行：node tests/behavior_check.cjs
const fs=require('fs'),path=require('path'),vm=require('vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=html.match(/<script>(?![\s\S]*<script>)([\s\S]*?)<\/script>/)[1];
// index.html をそのまま動かす最小の代用品
function app(design,rows){
  const els={};
  const inputs={floor:[],ceil:[],wall:[],fan:[]};
  const el=id=>els[id]||(els[id]={id,value:'',textContent:'',innerHTML:'',style:{},
    classList:{s:new Set(),add(c){this.s.add(c)},remove(c){this.s.delete(c)},contains(c){return this.s.has(c)}},
    addEventListener(t,f){(this['on'+t]=this['on'+t]||[]).push(f)},querySelectorAll:()=>[],scrollIntoView(){}});
  const document={getElementById:el,addEventListener(){},querySelectorAll(s){
    const m=s.match(/^#rows-(\w+) \.q-inp$/);return m?inputs[m[1]]:[];},querySelector:()=>null};
  const ctx=vm.createContext({document,window:{scrollTo(){}},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    setTimeout(){},confirm:()=>true,console});
  vm.runInContext(script,ctx);
  el('design-q').value=String(design);
  for(const t in rows)inputs[t]=rows[t].map(v=>({value:String(v)}));
  return {calc(){el('calc-btn').onclick.forEach(f=>f());return this;},el,
    set(t,vals){inputs[t]=vals.map(v=>({value:String(v)}));}};
}
let ng=0;
const check=(name,ok)=>{if(!ok)ng++;console.log(`${ok?'合':'否'} ${name}`);};
const typeRows=html=>html.split('</tr>').filter(r=>/吹き出し/.test(r));

// 種別行に判定を付けない（設計風量は系統全体の値で、種別ごとの設計値は無い）
{const a=app(3600,{floor:[1200],ceil:[1200],wall:[1200]}).calc();
 const body=a.el('r-gari-body').innerHTML;
 check('種別の3行があり、どれにも判定が付かない',typeRows(body).length===3&&typeRows(body).every(r=>!/class="badge/.test(r)));
 check('合計の判定は 100.0% 適正のまま',/設計比（ガラリ）<span class="badge badge-ok">適正/.test(body)&&body.includes('100.0%'));
 check('種別の合計値は出ている',typeRows(body).every(r=>r.includes('1,200')));}

// 負の風量は結果を出さず、どの欄かを伝える
{const a=app(1000,{floor:[600,-500,900]}).calc();
 check('負の風量で誤りを表示',a.el('err').classList.contains('show'));
 check('誤りの文に場所が入る',/床/.test(a.el('err').textContent)&&/2/.test(a.el('err').textContent));
 check('結果を表示しない',!a.el('results').classList.contains('show'));}
{const a=app(1000,{fan:[-1]}).calc();
 check('ファンの負の風量でも誤りを表示',a.el('err').classList.contains('show')&&/ファン/.test(a.el('err').textContent));}
// 直前の合格の結果を残さない
{const a=app(1000,{floor:[1000]}).calc();
 check('正しい入力では結果を表示',a.el('results').classList.contains('show')&&!a.el('err').classList.contains('show'));
 a.set('floor',[1500,-500]);a.calc();
 check('負の入力に直すと前の結果を消す',!a.el('results').classList.contains('show'));
 a.set('floor',[1000]);a.calc();
 check('直すと誤りが消えて結果が出る',a.el('results').classList.contains('show')&&!a.el('err').classList.contains('show'));}
// 0 と空欄は誤りにせず結果を出す（測定の途中でも見られるように）
{const a=app(1000,{floor:[1000,0,'']}).calc();
 check('0 と空欄は誤りにしない',!a.el('err').classList.contains('show')&&a.el('results').classList.contains('show'));}

// 空欄（R-1）：測り忘れに気づけるよう、場所を伝え、台数は「入力済み/設定台数」で出す
{const a=app(1000,{floor:[500,'',400],fan:['',300]}).calc();
 const body=a.el('r-gari-body').innerHTML, warn=a.el('r-warn');
 check('空欄の警告を表示',warn.classList.contains('show'));
 check('警告に場所が入る',/床 2/.test(warn.textContent)&&/ファン 1/.test(warn.textContent));
 check('警告に件数が入る',/2 か所/.test(warn.textContent));
 check('種別の台数は 入力済み/設定台数',typeRows(body)[0].includes('<td>2/3</td>'));
 check('ガラリ合計の台数も 入力済み/設定台数',/ガラリ 合計<\/td><td>2\/3<\/td>/.test(body));
 check('合計は入力済みの分',typeRows(body)[0].includes('900'));
 a.set('floor',[500,300,400]);a.set('fan',[200,300]);a.calc();
 check('埋めると警告が消える',!a.el('r-warn').classList.contains('show'));
 const body2=a.el('r-gari-body').innerHTML;
 check('全部入力済みなら台数は数字だけ',typeRows(body2)[0].includes('<td>3</td>'));}
{const a=app(1000,{floor:[1000,0]}).calc();
 check('0 は入力済みなので警告しない',!a.el('r-warn').classList.contains('show'));}
check('警告は保存する画像の範囲に入っている',
  html.indexOf('id="capture-target"')<html.indexOf('id="r-warn"')&&html.indexOf('id="r-warn"')<html.indexOf('id="r-gari-card"'));

// 入力の読み違い（R-5）：読めないものは黙って別の数にせず止める
for(const bad of ['12,5','1,20','1.2.3','abc','1e400','1e3','12a','1,2,3']){
 const a=app(1000,{floor:[500,bad]}).calc();
 check(`「${bad}」は誤り・場所を伝える・結果を出さない`,a.el('err').classList.contains('show')&&/床 2/.test(a.el('err').textContent)&&!a.el('results').classList.contains('show'));
}
for(const [text,shown] of [['1,200','1,200'],['１２００','1,200'],['12,500','12,500'],[' 800 ','800'],['1200.5','1,201'],['１，２００','1,200']]){
 const a=app(1000,{floor:[text]}).calc();
 check(`「${text}」は ${shown} と読む`,!a.el('err').classList.contains('show')&&typeRows(a.el('r-gari-body').innerHTML)[0].includes(`>${shown}<`));
}
for(const bad of ['12,5','1.2.3','1e3']){
 const a=app(bad,{floor:[500]}).calc();
 check(`設計風量「${bad}」は誤り`,a.el('err').classList.contains('show')&&!a.el('results').classList.contains('show'));
}
{const a=app('3,600',{floor:[3600]}).calc();
 check('設計風量「3,600」は 3600 と読む',a.el('r-design').textContent==='3,600'&&a.el('r-gari-body').innerHTML.includes('100.0%'));}
{const a=app(1000,{floor:[1000]}).calc();
 a.set('floor',['12,5']);a.calc();
 check('読めない入力に直すと前の結果を消す',!a.el('results').classList.contains('show'));}
// 検査の前提：実際の入力欄が文字をそのまま渡す形か（数値欄だとブラウザが先に書き換える）
check('風量欄と設計風量は文字の欄',/<input type="text" inputmode="decimal"[^>]*class="q-inp"/.test(html)&&/<input type="text" id="design-q"/.test(html));

if(ng){console.log(`不合格 ${ng}件`);process.exit(1);}console.log('合格');
