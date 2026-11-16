/* Проверка звонка вдвоём: node tools/call-test.js (нужен playwright). Сервер подменён, камера и микрофон фальшивые. */
const http=require('http'),fs=require('fs'),path=require('path');const root=path.join(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/json','.png':'image/png'};
const srv=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.statusCode=404;return r.end()}r.setHeader('content-type',types[path.extname(f)]||'application/octet-stream');r.end(fs.readFileSync(f))});
let fails=0;const ok=(c,m)=>{console.log((c?'  ok   ':'  FAIL ')+m);if(!c)fails++};
const {chromium}=require('playwright');
(async()=>{
await new Promise(r=>srv.listen(0,r));const BASE='http://localhost:'+srv.address().port+'/';
const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const users={tA:{username:'Я',spCode:'SP-ME0000'},tB:{username:'Аня',spCode:'SP-ANYA11'}};
const S={rooms:{},members:{},parts:{},sigs:[],sid:0};
async function mk(tok){
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await ctx.grantPermissions(['camera','microphone']);
 const p=await ctx.newPage();p.on('pageerror',e=>console.log(tok,'ERR',e.message));p.on('console',m=>{if(m.type()==='error')console.log(tok,'CONSOLE',m.text())});
 const u=users[tok],other=tok==='tA'?users.tB:users.tA;
 await p.route('**/*',async r=>{const url=r.request().url();if(!url.includes('slovopad-api'))return r.continue();
  const path=new URL(url).pathname,q=new URL(url).searchParams;let body={};try{body=JSON.parse(r.request().postData()||'{}')}catch(e){}
  let d={};const now=Date.now();
  if(path==='/api/me')d=u;
  else if(path==='/api/friends')d={friends:[{...other,online:true,unread:0}]};
  else if(path==='/api/echo/rooms')d={rooms:Object.values(S.rooms).filter(x=>S.members[x.id].includes(u.username)).map(x=>({...x,members:S.members[x.id].length,unread:0,last:''}))};
  else if(path==='/api/echo/room'){const id='r'+Object.keys(S.rooms).length;S.rooms[id]={id,name:body.name};S.members[id]=[u.username];d={ok:1,id,name:body.name}}
  else if(path==='/api/echo/room/invite'){const m=S.members[body.room];if(m.includes(other.username)){await r.fulfill({status:409,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify({error:'Он уже в комнате.'})});return}m.push(other.username);d={ok:1}}
  else if(path==='/api/echo/call/who'){d={parts:Object.keys(S.parts[q.get('room')]||{})}}
  else if(path==='/api/echo/call/join'){(S.parts[body.room]=S.parts[body.room]||{})[u.username]=now;d={ok:1,me:u.username,parts:Object.entries(S.parts[body.room]).map(([name,j])=>({name,j})),ice:[],turn:false}}
  else if(path==='/api/echo/call/leave'){delete (S.parts[body.room]||{})[u.username];d={ok:1}}
  else if(path==='/api/echo/call/poll'){const after=+q.get('after');const room=q.get('room');d={parts:Object.entries(S.parts[room]||{}).map(([name,j])=>({name,j})),sigs:S.sigs.filter(s=>s.room===room&&s.to===u.username&&s.id>after).map(s=>({id:s.id,from:s.from,data:s.data}))}}
  else if(path==='/api/echo/call/sig'){S.sigs.push({id:++S.sid,room:body.room,from:u.username,to:body.to,data:body.data});d={ok:1}}
  else if(path.startsWith('/api/chat'))d={messages:[]};
  await r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(d)})});
 await p.route('**/felykxzy.github.io/**',r=>r.abort());
 await p.addInitScript(t=>{localStorage.setItem('echoToken',t)},tok);
 await p.goto(BASE);await p.waitForTimeout(2200);return p}
const A=await mk('tA'),B=await mk('tB');
await A.click('[data-chat=SP-ANYA11]');await A.waitForTimeout(600);
await A.click('#chCall');await A.waitForTimeout(1500);
ok(await A.evaluate(()=>EchoCall.active()),'звонящий вошёл в звонок');

await B.waitForTimeout(11000);
ok(await B.evaluate(()=>document.getElementById('ring').classList.contains('on')),'второму пришла плашка входящего звонка');

await B.click('#ringYes');await B.waitForTimeout(6000);
for(const [n,P] of [['A',A],['B',B]]){ok(await P.evaluate(()=>document.querySelectorAll('#clG .ctile').length)===2,n+': в звонке два участника')}
await A.click('#clCam');await A.waitForTimeout(2500);

ok(await B.evaluate(()=>!document.querySelector('#clG .ctile:not(.self)').classList.contains('nocam')),'второй видит камеру первого');
await A.click('#clEnd');await A.waitForTimeout(500);ok(!(await A.evaluate(()=>EchoCall.active())),'после выхода звонок закончен');
await b.close();srv.close();console.log(fails?'\nПровалено проверок: '+fails:'\nВсё хорошо');process.exit(fails?1:0)})();
