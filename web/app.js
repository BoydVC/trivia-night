(function(){
'use strict';
const DATA = window.TN_DATA;
const HOST = /[?&]host=1/.test(location.search);
const TEAM_COLORS = ['#22c55e', '#a78bfa', '#f472b6', '#38bdf8'];
const PRESETS = {
  'Everyone (4)': ['Boyd', 'Miranda', 'Char', 'Vic'],
  'Kids vs Parents': ['Parents', 'Kids'],
  'Boyd+Vic vs Miranda+Char': ['Boyd & Vic', 'Miranda & Char'],
  '3 teams': ['Team 1', 'Team 2', 'Team 3'],
};
const LS = 'boyd-trivia-v1';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const money = v => (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US');
const catName = k => DATA.categories.find(c => c.key === k).name;

// ---------- state
let S = load() || fresh(1, PRESETS['Everyone (4)']);
function fresh(boardId, names){
  const b = DATA.boards.find(x => x.id === boardId);
  // two Daily Doubles in different categories, never on the $200 row (deterministic per new game, random seed)
  const pool = b.cells.filter(c => c.value >= 600);
  const dd = []; const seen = new Set();
  const shuffled = pool.map(c => [Math.random(), c]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  for (const c of shuffled){ if (!seen.has(c.cat)) { dd.push(c.id); seen.add(c.cat); } if (dd.length === 2) break; }
  return {screen: 'setup', board: boardId, teams: names.map((n, i) => ({name: n, score: 0, color: TEAM_COLORS[i]})), used: {}, dd, cur: 0,
          open: null, final: null, log: [], mute: false, peek: false, started: false};
}
function save(){ if (window.__noSave) return; try { localStorage.setItem(LS, JSON.stringify(S)); } catch(e){} broadcast(); }
function load(){ try { return JSON.parse(localStorage.getItem(LS)); } catch(e){ return null; } }
const board = () => DATA.boards.find(x => x.id === S.board);

// ---------- host sync (BroadcastChannel when served over http; localStorage events as backup)
let bc = null; try { bc = new BroadcastChannel('boyd-trivia'); } catch(e){}
function broadcast(){ if (bc) try { bc.postMessage(S); } catch(e){} }
if (bc) bc.onmessage = e => { if (HOST) { S = e.data; render(); } };
window.addEventListener('storage', e => { if (HOST && e.key === LS) { S = load(); render(); } });

// ---------- sound (Web Audio, synthesized; nothing downloaded)
let AC = null;
function ac(){ if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} } return AC; }
function tone(f, t0, d, type = 'square', g = .08){
  const a = ac(); if (!a || S.mute || HOST) return;
  const o = a.createOscillator(), v = a.createGain(); o.type = type; o.frequency.value = f;
  v.gain.setValueAtTime(0, a.currentTime + t0); v.gain.linearRampToValueAtTime(g, a.currentTime + t0 + .01);
  v.gain.exponentialRampToValueAtTime(.0001, a.currentTime + t0 + d); o.connect(v).connect(a.destination); o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + d + .05);
}
const SFX = {
  pick(){ tone(660, 0, .08, 'triangle', .1); tone(990, .06, .1, 'triangle', .08); },
  reveal(){ [523, 659, 784].forEach((f, i) => tone(f, i * .07, .25, 'sine', .12)); },
  right(){ [523, 659, 784, 1046].forEach((f, i) => tone(f, i * .08, .3, 'triangle', .12)); },
  wrong(){ tone(140, 0, .45, 'sawtooth', .09); tone(110, .05, .45, 'sawtooth', .07); },
  dd(){ for (let i = 0; i < 14; i++) tone(300 + i * 60, i * .045, .12, 'square', .05); [784, 988, 1175, 1568].forEach((f, i) => tone(f, .7 + i * .12, .35, 'triangle', .12)); },
  win(){ [523, 523, 523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, i * .14, .3, 'triangle', .13)); },
  tick(){ tone(1200, 0, .03, 'square', .03); },
  think(){ // a short original "thinking" loop
    const m = [392, 523, 392, 262, 392, 523, 392, 0, 392, 523, 392, 523, 659, 0, 587, 523, 494, 440, 392];
    m.forEach((f, i) => f && tone(f, i * .25, .22, 'triangle', .06));
  }
};

// ---------- confetti (canvas)
const cv = document.createElement('canvas'); cv.id = 'confetti'; document.body.appendChild(cv);
const cx = cv.getContext('2d'); let parts = [], raf = 0;
function confetti(n = 220){
  if (HOST) return;
  cv.width = innerWidth; cv.height = innerHeight;
  const cols = ['#ffcc33', '#22c55e', '#f472b6', '#38bdf8', '#a78bfa', '#ffffff', '#c8102e'];
  for (let i = 0; i < n; i++) parts.push({x: innerWidth * (.2 + .6 * Math.random()), y: innerHeight * .35, vx: (Math.random() - .5) * 18, vy: -Math.random() * 18 - 6,
    w: 6 + Math.random() * 8, h: 8 + Math.random() * 12, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[i % cols.length], life: 0});
  if (!raf) raf = requestAnimationFrame(step);
}
function step(){
  cx.clearRect(0, 0, cv.width, cv.height);
  parts = parts.filter(p => p.y < cv.height + 40 && p.life < 400);
  for (const p of parts){ p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life++;
    cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.life / 9))); cx.restore(); }
  raf = parts.length ? requestAnimationFrame(step) : 0;
}

// ---------- scoring
function award(ti, delta, why){
  const t = S.teams[ti]; if (!t) return;
  t.score += delta; S.log.push({ti, delta, why});
  const el = document.querySelectorAll('.team')[ti];
  if (el) { el.classList.remove('flash', 'flashbad'); void el.offsetWidth; el.classList.add(delta >= 0 ? 'flash' : 'flashbad'); }
  delta >= 0 ? SFX.right() : SFX.wrong();
}
function undo(){ const l = S.log.pop(); if (!l) return; S.teams[l.ti].score -= l.delta; save(); render(); }

// ---------- flow
function openCell(i){
  const b = board(), cats = DATA.categories; const col = i % 6, row = Math.floor(i / 6);
  const c = b.cells.find(x => x.cat === cats[col].key && x.value === DATA.values[row]);
  if (!c || S.used[c.id]) return;
  S.cur = i; const isDD = S.dd.includes(c.id);
  S.open = {id: c.id, stage: isDD ? 'dd' : 'clue', dd: isDD, wager: c.value, ddTeam: null, marks: {}};
  isDD ? SFX.dd() : SFX.pick(); save(); render();
}
function cellById(id){ return board().cells.find(c => c.id === id); }
function reveal(){ if (!S.open) return; if (S.open.stage === 'clue') { S.open.stage = 'answer'; SFX.reveal(); save(); render(); } }
function mark(ti, ok){
  const o = S.open; if (!o || o.stage !== 'answer') return;
  const c = cellById(o.id); const v = o.dd ? o.wager : c.value;
  if (o.dd && ti !== o.ddTeam) return;
  const prev = o.marks[ti];
  if (prev === ok) return;
  if (prev !== undefined) award(ti, prev ? -v : v, 'undo mark');
  o.marks[ti] = ok; award(ti, ok ? v : -v, `${catName(c.cat)} ${c.value}`);
  if (ok && o.dd) confetti(160);
  save(); render();
}
function closeClue(){
  if (!S.open) return; S.used[S.open.id] = Object.keys(S.open.marks).find(k => S.open.marks[k]) ?? 'x';
  S.open = null; save(); render();
}
function startFinal(){
  const f = board().final;
  S.final = {stage: 'cat', wagers: S.teams.map(() => ''), marks: {}, timer: 30};
  S.screen = 'final'; SFX.dd(); save(); render();
}
let timerId = 0;
function finalNext(){
  const F = S.final; if (!F) return;
  if (F.stage === 'cat') F.stage = 'wager';
  else if (F.stage === 'wager') { F.wagers = F.wagers.map((w, i) => Math.max(0, Math.min(Math.max(0, S.teams[i].score), parseInt(w || 0, 10) || 0))); F.stage = 'clue'; F.timer = 30; runTimer(); SFX.think(); setTimeout(() => !S.mute && S.final && S.final.stage === 'clue' && SFX.think(), 4800); }
  else if (F.stage === 'clue') { clearInterval(timerId); F.stage = 'answer'; SFX.reveal(); }
  else if (F.stage === 'answer') { F.stage = 'winner'; SFX.win(); setTimeout(() => confetti(320), 100); setTimeout(() => confetti(200), 900); }
  save(); render();
}
function runTimer(){ clearInterval(timerId); timerId = setInterval(() => { const F = S.final; if (!F || F.stage !== 'clue') return clearInterval(timerId);
  F.timer = Math.max(0, F.timer - 1); if (F.timer <= 5 && F.timer > 0) SFX.tick(); if (!F.timer) { clearInterval(timerId); finalNext(); return; }
  const el = $('#ftimer'); if (el) { el.firstChild.textContent = F.timer; $('#ftimer i').style.width = (F.timer / 30 * 100) + '%'; } broadcast(); }, 1000); }
function finalMark(ti, ok){
  const F = S.final; if (!F || F.stage !== 'answer') return;
  const w = F.wagers[ti] || 0, prev = F.marks[ti];
  if (prev === ok) return;
  if (prev !== undefined) award(ti, prev ? -w : w, 'undo final');
  F.marks[ti] = ok; award(ti, ok ? w : -w, 'Final'); save(); render();
}
function newGame(boardId){ const names = S.teams.map(t => t.name); S = fresh(boardId || S.board, names); save(); render(); }

// ---------- render
function scoresBar(){
  return `<div class="scores">${S.teams.map((t, i) => `<div class="team" style="--tc:${t.color}"><div class="sw"></div><div><div class="nm">${esc(t.name)}</div><div class="key">key ${i + 1} ✓ · shift+${i + 1} ✗</div></div><div class="sc ${t.score < 0 ? 'neg' : ''}">${t.score < 0 ? '−$' + Math.abs(t.score).toLocaleString() : '$' + t.score.toLocaleString()}</div></div>`).join('')}</div>`;
}
function header(){
  const b = board(); const left = b.cells.length - Object.keys(S.used).length;
  return `<div class="mdstripe"></div><div class="hdr"><div class="logo">BOYD FAMILY TRIVIA NIGHT<small>${esc(b.name)} · ${left} clues left</small></div><span class="sp"></span>
   <span class="pill" data-act="host">⧉ Host window (H)</span><span class="pill" data-act="peek">${S.peek ? '🙈 Hide answers' : '👁 Answer peek (A)'}</span>
   <span class="pill" data-act="final">★ Final (F)</span><span class="pill" data-act="undo">↶ Undo (U)</span><span class="pill" data-act="mute">${S.mute ? '🔇' : '🔊'} (M)</span><span class="pill" data-act="setup">⚙ Setup</span></div>`;
}
function boardView(){
  const b = board(), cats = DATA.categories;
  let h = cats.map(c => `<div class="cat">${esc(c.name)}</div>`).join('');
  DATA.values.forEach((v, r) => cats.forEach((c, ci) => {
    const cell = b.cells.find(x => x.cat === c.key && x.value === v), i = r * 6 + ci, used = S.used[cell.id] !== undefined;
    const who = used && S.used[cell.id] !== 'x' ? S.teams[+S.used[cell.id]] : null;
    h += `<div class="cell ${used ? 'used' : ''} ${S.cur === i ? 'cur' : ''}" data-i="${i}">${used ? (who ? `<span class="who" style="color:${who.color}">${esc(who.name)}</span>` : '') : '$' + v}</div>`;
  }));
  return `<div class="board">${h}</div>`;
}
function srcLine(srcs){ return srcs.map(s => `Source: <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.publisher)} · ${esc(s.title)}</a>`).join(' &nbsp;·&nbsp; '); }
function clueView(){
  const o = S.open, c = cellById(o.id);
  if (o.stage === 'dd') {
    return `<div class="ov"><div class="dd">DAILY<br>DOUBLE!</div><div class="meta" style="margin-top:3vh">${esc(catName(c.cat))}</div>
     <div class="tscore">${S.teams.map((t, i) => `<div class="t" style="--tc:${t.color}"><div class="nm">${esc(t.name)}</div><div class="sc">${money(t.score)}</div>
       <div class="row"><button class="${o.ddTeam === i ? 'y on' : 'y'}" data-ddteam="${i}">Pick</button></div></div>`).join('')}</div>
     <div class="btns" style="align-items:center"><span class="cond" style="font-size:2.6vh">Wager $</span><input id="wager" type="number" min="0" step="100" value="${o.wager}" style="font-family:'TN Display';font-size:3.4vh;width:14vw;text-align:center;border-radius:1vh;border:0;padding:.6vh">
     <button class="b gold" data-act="ddgo">Show the clue ▶</button></div>
     <div class="hint">Pick the team in control, enter a wager (up to their score, or up to $1,000 if their score is lower), then show the clue</div></div>`;
  }
  const ans = o.stage === 'answer';
  const v = o.dd ? o.wager : c.value;
  return `<div class="ov"><div class="meta">${esc(catName(c.cat))} · ${o.dd ? 'Daily Double · $' + v + ' · ' + esc(S.teams[o.ddTeam].name) : '$' + c.value}</div>
    <div class="clue">${esc(c.clue)}</div>
    ${ans ? `<div class="ans"><small>Correct response</small>${esc(c.answer)}</div><div class="src">${srcLine(c.sources)}</div>` : ''}
    ${ans ? `<div class="tscore">${S.teams.map((t, i) => (o.dd && i !== o.ddTeam) ? '' : `<div class="t" style="--tc:${t.color}"><div class="nm">${esc(t.name)}</div><div class="sc">${money(t.score)}</div>
       <div class="row"><button class="y ${o.marks[i] === true ? 'on' : ''}" data-mark="${i}:1">✓ +${v}</button><button class="n ${o.marks[i] === false ? 'on' : ''}" data-mark="${i}:0">✗ −${v}</button></div></div>`).join('')}</div>
      <div class="btns"><button class="b gold" data-act="close">Back to board ⏎</button></div>`
      : `<div class="btns"><button class="b gold" data-act="reveal">Reveal answer ␣</button><button class="b" data-act="close">Nobody / skip</button></div>`}
    ${S.peek && !ans ? `<div class="peek"><small>Host peek</small>${esc(c.answer)}</div>` : ''}
    <div class="hint">${ans ? '1–4 = correct · Shift+1–4 = wrong · Enter = back to board' : 'Space = reveal · Esc = skip'}</div></div>`;
}
function finalView(){
  const F = S.final, f = board().final;
  const head = `<div class="meta">Final Trivia · ${esc(f.category)}</div>`;
  if (F.stage === 'cat') return `<div class="ov">${head}<div class="dd" style="font-size:12vh">FINAL<br>ROUND</div><div class="clue" style="margin-top:3vh;font-size:6vh">Category: ${esc(f.category)}</div>
     <div class="btns"><button class="b gold" data-act="fnext">Make your wagers ▶</button></div><div class="hint">Enter = next</div></div>`;
  if (F.stage === 'wager') return `<div class="ov">${head}<div class="clue" style="font-size:5vh">Secret wagers! Write them down, then the host types them in.</div>
     <div class="tscore">${S.teams.map((t, i) => `<div class="t" style="--tc:${t.color}"><div class="nm">${esc(t.name)}</div><div class="sc">${money(t.score)}</div><div class="row">
       <input type="number" min="0" max="${Math.max(0, t.score)}" step="100" data-fw="${i}" value="${esc(F.wagers[i])}" placeholder="0–${Math.max(0, t.score)}"></div></div>`).join('')}</div>
     <div class="btns"><button class="b gold" data-act="fnext">Show the Final clue ▶</button></div><div class="hint">Wagers are capped at each team's score (teams at $0 or below wager $0)</div></div>`;
  if (F.stage === 'clue') return `<div class="ov">${head}<div class="clue">${esc(f.clue)}</div>
     <div class="timer" id="ftimer">${F.timer}<div class="bar"><i style="width:${F.timer / 30 * 100}%"></i></div></div>
     <div class="btns"><button class="b gold" data-act="fnext">Reveal answer ␣</button></div>${S.peek ? `<div class="peek"><small>Host peek</small>${esc(f.answer)}</div>` : ''}</div>`;
  if (F.stage === 'answer') return `<div class="ov">${head}<div class="clue" style="font-size:4.6vh">${esc(f.clue)}</div><div class="ans"><small>Correct response</small>${esc(f.answer)}</div><div class="src">${srcLine(f.sources)}</div>
     <div class="tscore">${S.teams.map((t, i) => `<div class="t" style="--tc:${t.color}"><div class="nm">${esc(t.name)}</div><div class="sc">${money(t.score)} · wagered $${F.wagers[i]}</div>
       <div class="row"><button class="y ${F.marks[i] === true ? 'on' : ''}" data-fmark="${i}:1">✓</button><button class="n ${F.marks[i] === false ? 'on' : ''}" data-fmark="${i}:0">✗</button></div></div>`).join('')}</div>
     <div class="btns"><button class="b gold" data-act="fnext">Crown the champion 🏆</button></div></div>`;
  const ranked = S.teams.map((t, i) => ({...t, i})).sort((a, b) => b.score - a.score);
  const top = ranked.filter(t => t.score === ranked[0].score);
  return `<div class="ov"><div class="meta">Tonight's champion${top.length > 1 ? 's' : ''}</div><div class="champ">${top.map(t => esc(t.name)).join(' & ')}</div>
    <div class="tscore">${ranked.map((t, r) => `<div class="t" style="--tc:${t.color}"><div class="nm">${r + 1}. ${esc(t.name)}</div><div class="sc">${money(t.score)}</div></div>`).join('')}</div>
    <div class="btns"><button class="b gold" data-act="again">Play another board ▶</button><button class="b" data-act="toboard">Back to board</button></div></div>`;
}
function setupView(){
  const b = S.board;
  return `<div class="mdstripe"></div><div class="setup"><div class="title"><small>THE BOYDS PRESENT</small>FAMILY TRIVIA NIGHT</div>
   <div class="boards">${DATA.boards.map(x => `<div class="bcard ${x.id === b ? 'on' : ''}" data-board="${x.id}"><h3>${esc(x.name.split(' · ')[0])}</h3><p>${esc(x.name.split(' · ')[1] || '')}</p><p style="color:#9fb0ff">30 clues · 2 Daily Doubles · Final: ${esc(x.final.category)}</p></div>`).join('')}</div>
   <div class="presets">${Object.keys(PRESETS).map(p => `<button class="b" data-preset="${esc(p)}">${esc(p)}</button>`).join('')}
     <button class="b" data-act="addteam" ${S.teams.length >= 4 ? 'disabled' : ''}>+ team</button><button class="b" data-act="rmteam" ${S.teams.length <= 2 ? 'disabled' : ''}>− team</button></div>
   <div class="teamsetup">${S.teams.map((t, i) => `<input style="--tc:${t.color}" data-tname="${i}" value="${esc(t.name)}" maxlength="18">`).join('')}</div>
   <div class="cats">${DATA.categories.map(c => esc(c.name)).join(' · ')}</div>
   <div class="btns"><button class="b gold" data-act="start" style="font-size:3.4vh;padding:1.8vh 3vw">${S.started && Object.keys(S.used).length ? 'Resume game ▶' : 'Start the game ▶'}</button>${S.started ? '<button class="b" data-act="restart">New game on this board</button>' : ''}</div>
   <div class="cond" style="color:#ffffff70;font-size:1.8vh">Arrows + Enter or tap a square · Space reveals · 1–4 / Shift+1–4 score teams · H host window · A answer peek · F final · U undo · M mute · Z fullscreen</div></div>`;
}
function hostView(){
  const b = board(); let card = '';
  if (S.screen === 'final' && S.final) { const f = b.final;
    card = `<div class="card"><div class="acc">FINAL · ${esc(f.category)} · stage: ${esc(S.final.stage)}</div><div class="q">${esc(f.clue)}</div><div class="a">${esc(f.answer)}</div>
     <div class="acc">Also accept: ${esc(f.accept.join(', ') || '—')}</div>${f.sources.map(s => `<div class="qt">“${esc(s.quote)}”<br><a href="${esc(s.url)}" style="color:#9fb0ff">${esc(s.title)} (Wikipedia, rev ${s.revid})</a></div>`).join('')}</div>`;
  } else if (S.open) { const c = cellById(S.open.id);
    card = `<div class="card"><div class="acc">${esc(catName(c.cat))} · $${c.value}${S.open.dd ? ' · DAILY DOUBLE' : ''} · stage: ${esc(S.open.stage)}</div><div class="q">${esc(c.clue)}</div><div class="a">${esc(c.answer)}</div>
     <div class="acc">Also accept: ${esc(c.accept.join(', ') || '—')}</div>${c.sources.map(s => `<div class="qt">“${esc(s.quote)}”<br><a href="${esc(s.url)}" style="color:#9fb0ff">${esc(s.title)} (Wikipedia, rev ${s.revid})</a></div>`).join('')}</div>`;
  } else card = `<div class="card"><div class="q">Waiting for a square to be picked…</div><div class="acc">Daily Doubles this game: ${S.dd.map(id => { const c = cellById(id); return esc(catName(c.cat)) + ' $' + c.value; }).join(' · ')}</div></div>`;
  return `<div class="hostv"><h1>HOST VIEW · ${esc(b.name)}</h1>${card}
   <div class="card"><table>${S.teams.map(t => `<tr><td style="color:${t.color};font-weight:700">${esc(t.name)}</td><td style="text-align:right;font-family:'TN Display';font-size:3vh">${money(t.score)}</td></tr>`).join('')}</table></div>
   <div class="acc">Keep this window on your laptop or phone; the TV shows the game. Updates live when the game is served from http://127.0.0.1:4253 (in the offline file, use A for answer peek instead).</div></div>`;
}
function render(){
  document.body.classList.toggle('host', HOST);
  const app = $('#app');
  if (HOST) { app.innerHTML = hostView(); return; }
  if (S.screen === 'setup') { app.innerHTML = setupView(); return; }
  let h = header() + boardView() + scoresBar();
  if (S.screen === 'final' && S.final) h += finalView();
  else if (S.open) h += clueView();
  app.innerHTML = h;
}

// ---------- input
document.addEventListener('click', e => {
  ac();
  const t = e.target.closest('[data-i],[data-act],[data-board],[data-preset],[data-mark],[data-fmark],[data-ddteam]'); if (!t) return;
  if (t.dataset.i !== undefined && !S.open) return openCell(+t.dataset.i);
  if (t.dataset.board) { S.board = +t.dataset.board; const names = S.teams.map(x => x.name); S = fresh(S.board, names); save(); return render(); }
  if (t.dataset.preset) { const n = PRESETS[t.dataset.preset]; S = fresh(S.board, n); save(); return render(); }
  if (t.dataset.mark) { const [i, ok] = t.dataset.mark.split(':'); return mark(+i, ok === '1'); }
  if (t.dataset.fmark) { const [i, ok] = t.dataset.fmark.split(':'); return finalMark(+i, ok === '1'); }
  if (t.dataset.ddteam !== undefined) { S.open.ddTeam = +t.dataset.ddteam; const tm = S.teams[S.open.ddTeam]; const w = $('#wager'); if (w) w.max = Math.max(tm.score, 1000); save(); return render(); }
  act(t.dataset.act);
});
document.addEventListener('input', e => {
  if (e.target.dataset.tname !== undefined) { S.teams[+e.target.dataset.tname].name = e.target.value; save(); }
  if (e.target.dataset.fw !== undefined) { S.final.wagers[+e.target.dataset.fw] = e.target.value; save(); }
  if (e.target.id === 'wager') { S.open.wager = e.target.value; }
});
function act(a){
  switch (a) {
    case 'start': S.screen = 'board'; S.started = true; SFX.reveal(); save(); return render();
    case 'restart': return newGame(S.board);
    case 'setup': S.screen = 'setup'; S.open = null; save(); return render();
    case 'addteam': if (S.teams.length < 4) S.teams.push({name: 'Team ' + (S.teams.length + 1), score: 0, color: TEAM_COLORS[S.teams.length]}); save(); return render();
    case 'rmteam': if (S.teams.length > 2) S.teams.pop(); save(); return render();
    case 'reveal': return reveal();
    case 'close': return closeClue();
    case 'undo': return undo();
    case 'mute': S.mute = !S.mute; save(); return render();
    case 'peek': S.peek = !S.peek; save(); return render();
    case 'host': window.open(location.pathname + '?host=1', 'trivia-host', 'width=900,height=800'); return;
    case 'final': if (!S.open) startFinal(); return;
    case 'fnext': return finalNext();
    case 'again': { const nb = S.board % DATA.boards.length + 1; S = fresh(nb, S.teams.map(t => t.name)); S.screen = 'setup'; save(); return render(); }
    case 'toboard': S.screen = 'board'; save(); return render();
    case 'ddgo': {
      const o = S.open; if (o.ddTeam == null) { alert('Pick the team that chose the Daily Double first.'); return; }
      const tm = S.teams[o.ddTeam], max = Math.max(tm.score, 1000), c = cellById(o.id);
      o.wager = Math.max(5, Math.min(max, parseInt(o.wager, 10) || c.value)); o.stage = 'clue'; SFX.pick(); save(); return render();
    }
  }
}
document.addEventListener('keydown', e => {
  if (HOST) return; ac();
  if (e.target.tagName === 'INPUT') { if (e.key === 'Enter') { e.target.blur(); if (S.final && S.final.stage === 'wager') finalNext(); else if (S.open && S.open.stage === 'dd') act('ddgo'); } return; }
  const k = e.key;
  if (k === 'm' || k === 'M') return act('mute');
  if (k === 'h' || k === 'H') return act('host');
  if (k === 'a' || k === 'A') return act('peek');
  if (k === 'z' || k === 'Z') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); return; }
  if (S.screen === 'setup') { if (k === 'Enter') act('start'); if (k >= '1' && k <= '3') { S.board = +k; S = fresh(S.board, S.teams.map(t => t.name)); save(); render(); } return; }
  if (k === 'u' || k === 'U') return act('undo');
  const num = e.code && e.code.startsWith('Digit') ? +e.code.slice(5) : NaN;
  if (S.screen === 'final' && S.final) {
    if (k === 'Enter' || k === ' ') { e.preventDefault(); return finalNext(); }
    if (num >= 1 && num <= S.teams.length) return finalMark(num - 1, !e.shiftKey);
    if (k === 'Escape' && S.final.stage === 'winner') return act('toboard');
    return;
  }
  if (S.open) {
    if (S.open.stage === 'dd') { if (num >= 1 && num <= S.teams.length) { S.open.ddTeam = num - 1; save(); render(); } if (k === 'Enter') act('ddgo'); return; }
    if (k === ' ' ) { e.preventDefault(); return S.open.stage === 'clue' ? reveal() : null; }
    if (k === 'Enter') return S.open.stage === 'clue' ? reveal() : closeClue();
    if (k === 'Escape') return closeClue();
    if (num >= 1 && num <= S.teams.length) return mark(num - 1, !e.shiftKey);
    return;
  }
  if (k === 'f' || k === 'F') return act('final');
  const mv = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -6, ArrowDown: 6}[k];
  if (mv) { e.preventDefault(); S.cur = (S.cur + mv + 30) % 30; render(); return; }
  if (k === 'Enter' || k === ' ') { e.preventDefault(); return openCell(S.cur); }
  if (k === 'Escape') return act('setup');
});
window.addEventListener('resize', () => { cv.width = innerWidth; cv.height = innerHeight; });
// test hooks for the smoke test / screenshots
window.TN = {state: () => S, openCell, reveal, mark, closeClue, startFinal, finalNext, newGame, act, render, setState: x => { S = x; render(); }};
const pre = new URLSearchParams(location.search);
if (pre.get('demo')) { document.body.classList.add('demo'); // ?demo=board|clue|answer|dd|final|winner (for screenshots only; does not touch saved games)
  S = fresh(+(pre.get('b') || 1), PRESETS['Everyone (4)']); S.screen = 'board'; S.started = true; S.mute = true;
  [380, 1200, 600, 800].forEach((v, i) => S.teams[i].score = v);
  ['md-1', 'bal-1', 'space-2', 'sci-1', 'word-3', 'soc-2'].forEach(x => S.used[`b${S.board}-${x}`] = String(Math.floor(Math.random() * 4)));
  S.cur = 14; const d = pre.get('demo');
  const save0 = save; window.__noSave = true;
  if (d === 'clue' || d === 'answer') { const c = board().cells.find(c => c.cat === 'space' && c.value === 600); S.dd = S.dd.filter(x => x !== c.id); S.open = {id: c.id, stage: d, dd: false, wager: 0, ddTeam: null, marks: d === 'answer' ? {2: true} : {}}; }
  if (d === 'dd') { const c = board().cells.find(c => c.cat === 'bal' && c.value === 800); S.open = {id: c.id, stage: 'dd', dd: true, wager: 800, ddTeam: 1, marks: {}}; }
  if (d === 'final') { S.screen = 'final'; S.final = {stage: 'clue', wagers: [300, 1000, 600, 800], marks: {}, timer: 22}; }
  if (d === 'winner') { S.screen = 'final'; S.teams[1].score = 2200; S.final = {stage: 'winner', wagers: [0, 1000, 0, 0], marks: {}, timer: 0}; setTimeout(() => confetti(300), 50); }
  if (d === 'setup') S.screen = 'setup';
  render(); return;
}
render();
})();
