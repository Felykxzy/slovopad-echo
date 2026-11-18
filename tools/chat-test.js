/* Проверка чата в приложении ЭХО: node tools/chat-test.js [папка_для_скриншотов]
   Настоящий код сервера из игры (../slovopad.game/backend/worker.js, или путь в WORKER) работает в памяти, браузер открывает ЭХО и общается с ним. */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), shots = process.argv[2] || '/tmp';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f));
});
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
(async () => {
  const { DatabaseSync } = require('node:sqlite'), db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...x) => stmt(sql, x), first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { last_row_id: Number(r.lastInsertRowid) } } } });
  const worker = (await import(require('url').pathToFileURL(process.env.WORKER || path.join(root, '../slovopad.game/backend/worker.js')).href)).default;
  const env = { DB: { prepare: s => stmt(s) }, JWT_SECRET: 'x'.repeat(32) };
  let ip = 0;
  const api = async (p, body, token) => { const r = await worker.fetch(new Request('https://api.test' + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '10.1.1.' + ((++ip % 200) + 1), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }), env); return r.json(); };
  const reg = async n => { const r = await api('/api/register', { username: n, password: 'password123' }); return { token: r.token, code: r.spCode || r.sp_code, name: n }; };
  const A = await reg('Alice'), B = await reg('Bobby'), C = await reg('Carol');
  for (const X of [B, C]) { await api('/api/friends/request', { q: X.code }, A.token); await api('/api/friends/respond', { code: A.code, accept: true }, X.token) }
  await api('/api/chat/send', { to: A.code, text: 'Привет! Го сыграем?' }, B.token);
  await api('/api/chat/send', { to: B.code, text: 'Давай, только позже' }, A.token);
  const tiny = 'data:image/jpeg;base64,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';
  const sent = await api('/api/chat/send', { to: A.code, img: tiny, text: 'смотри' }, B.token);
  const first = (await api('/api/chat?with=' + B.code, null, A.token)).messages[0];
  await api('/api/chat/react', { to: B.code, id: first.id, emo: '🔥' }, A.token);
  await api('/api/chat/send', { to: A.code, text: '😂' }, B.token);
  await api('/api/chat/send', { to: A.code, text: 'ответ тебе', reply: first.id }, B.token);
  await api('/api/chat/typing', { to: A.code }, B.token);
  await api('/api/chat?with=' + A.code, null, B.token);   // Боб прочитал
  const rid = (await api('/api/echo/room', { name: 'Словари' }, A.token)).id;
  for (const X of [B, C]) await api('/api/echo/room/invite', { room: rid, code: X.code }, A.token);
  await api('/api/echo/room/send', { room: rid, text: 'Всем привет! Сегодня заезд в 20:00' }, A.token);
  await api('/api/echo/room/send', { room: rid, text: '@Alice буду!', reply: 1 }, B.token);
  await api('/api/echo/room/send', { room: rid, text: 'Я тоже, @Bobby не опаздывай' }, C.token);
  await api('/api/echo/room/pin', { room: rid, id: 1 }, A.token);
  await api('/api/echo/room/about', { room: rid, about: 'Тренируемся и играем заезды по вечерам' }, A.token);
  await api('/api/echo/room/react', { room: rid, id: 1, emo: '❤️' }, B.token);
  await api('/api/echo/room/mod', { room: rid, code: B.code, on: true }, A.token);
  await api('/api/echo/room/send', { room: rid, text: 'вот', img: tiny }, C.token);
  await api('/api/echo/room/typing', { room: rid }, B.token);

  await new Promise(r => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +process.env.W || 430, height: +process.env.H || 900 }, deviceScaleFactor: 1, isMobile: !!process.env.W, hasTouch: !!process.env.W }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(a => { localStorage.setItem('echoToken', a.t) }, { t: A.token, c: A.code });
  await p.route(/workers\.dev/, async r => { const u = new URL(r.request().url()); const body = r.request().postData(); const res = await worker.fetch(new Request('https://api.test' + u.pathname + u.search, { method: r.request().method(), headers: { ...r.request().headers(), 'cf-connecting-ip': '10.2.2.2' }, body: body || undefined }), env); r.fulfill({ status: res.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: await res.text() }) });
  await p.route(/telegram\.org|github\.io/, r => r.abort());
  await p.goto(base + '/index.html'); await p.waitForTimeout(2600);
  console.log('Личный чат');
  await p.click('[data-chat="' + B.code + '"]'); await p.waitForTimeout(1500);
  const q = s => p.evaluate(s2 => !!document.querySelector(s2), s);
  const txt = () => p.evaluate(() => document.getElementById('msgs').innerText);
  let t1 = await txt();
  ok(/Привет! Го сыграем/.test(t1), 'сообщения видны'); ok(/ответ тебе/.test(t1), 'есть ответ');
  ok(await q('#msgs .mq'), 'у ответа есть цитата'); ok(await q('#msgs .mimg img'), 'картинка загрузилась');
  ok(await q('#msgs .mt.big'), 'смайлик крупно (стикер)'); ok(await q('#msgs .rxc'), 'реакция видна');
  ok(/печатает/.test(t1), 'видно «печатает…»');
  ok(/✓✓/.test(t1), 'отметка «прочитано»');
  { const bb = await p.locator('#msgs .mimg img').first().boundingBox(); const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
    await p.mouse.move(cx, cy); await p.mouse.down(); await p.waitForTimeout(650); await p.mouse.up(); await p.waitForTimeout(250);
    ok(await q('.eksh .esre'), 'долгое нажатие по фото открывает меню');
    ok(!(await q('.ekview')), 'при этом фото во весь экран не открылось');
    await p.click('.eksh', { position: { x: 20, y: 20 } }); await p.waitForTimeout(200);
    await p.mouse.click(cx, cy); await p.waitForTimeout(250);
    ok(await q('.ekview'), 'обычное нажатие по фото открывает его на весь экран'); await p.click('.ekview'); await p.waitForTimeout(150); }
  await p.screenshot({ path: shots + '/echo-dm.png' });
  // меню сообщения, ответ, правка, удаление, стикер, реакция
  await p.click('#msgs .msg.me >> nth=0'); await p.waitForTimeout(300);
  ok(await q('.eksh .esre'), 'меню сообщения открылось');
  await p.screenshot({ path: shots + '/echo-sheet.png' });
  await p.click('.eksh .esa:has-text("Изменить")'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.getElementById('chIn').value.length > 0), 'правка: текст в поле');
  await p.fill('#chIn', 'Давай, но чуть позже'); await p.click('#chSend'); await p.waitForTimeout(1200);
  ok(/изм\./.test(await txt()), 'после правки есть «изм.»');
  await p.click('#msgs .msg:not(.me) >> nth=0'); await p.waitForTimeout(200); await p.click('.eksh .esa:has-text("Ответить")'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !document.getElementById('chQp').hidden), 'панель ответа показана');
  await p.fill('#chIn', 'мой ответ'); await p.click('#chSend'); await p.waitForTimeout(1300);
  ok(await p.evaluate(() => [...document.querySelectorAll('#msgs .mq')].length >= 2), 'ответ с цитатой отправлен');
  await p.click('#chRx'); await p.waitForTimeout(200); await p.click('#chSk .stk >> nth=0'); await p.waitForTimeout(1200);
  ok(await q('#msgs .msg.stk'), 'стикер отправлен');
  await p.click('#msgs .msg:not(.me) >> nth=0'); await p.waitForTimeout(200); await p.click('.eksh .esre button >> nth=2'); await p.waitForTimeout(1300);
  ok(await p.evaluate(() => [...document.querySelectorAll('#msgs .rxc')].some(x => x.textContent.includes('😂'))), 'реакция поставилась');
  await p.click('#msgs .msg.me >> nth=-1'); await p.waitForTimeout(200); await p.click('.eksh .esa.bad'); await p.waitForTimeout(1300);
  ok(/Сообщение удалено/.test(await txt()), 'удаление работает');
  await p.click('#chBack'); await p.waitForTimeout(600);
  console.log('Комната');
  await p.click('nav [data-tab=rooms]'); await p.waitForTimeout(800);
  await api('/api/echo/room/typing', { room: rid }, B.token);
  await p.click('[data-room="' + rid + '"]'); await p.waitForTimeout(1500);
  t1 = await txt();
  ok(/Всем привет/.test(t1), 'сообщения комнаты видны'); ok(await q('#msgs .mq'), 'в комнате есть цитата');
  ok(await q('#msgs .men'), 'ник с @ подсвечен'); ok(await q('#msgs .mimg img'), 'картинка в комнате');
  ok(await q('#msgs .rxc'), 'реакция в комнате'); ok(await p.evaluate(() => !document.getElementById('chPin').hidden), 'закреп виден');
  ok(await p.evaluate(() => /Тренируемся/.test(document.getElementById('chAb').textContent)), 'описание комнаты видно');
  ok(/печатает/.test(t1), 'в комнате видно «печатает…»');
  await p.screenshot({ path: shots + '/echo-room.png' });
  await p.fill('#chIn', 'сообщение из ЭХО'); await p.click('#chSend'); await p.waitForTimeout(1300);
  ok(/сообщение из ЭХО/.test(await txt()), 'отправка в комнату работает');
  ok(errs.length === 0, 'нет ошибок в консоли' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); console.log(fails ? '\nПровалено проверок: ' + fails : '\nВсё хорошо'); process.exit(fails ? 1 : 0);
})();
