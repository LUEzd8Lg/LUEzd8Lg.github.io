/* ===========================================================================
   拾叁 · TERM-13 — 桌宠行为层
   登录进入站点后出现，常驻右下角。可拖拽、可注视、会偶尔调皮、可静默/休眠。
   不联网、不发声音，状态只写 localStorage。
   =========================================================================== */
(function () {
  'use strict';

  var KEY = 'wa_pet13_v1';
  var DAY = 24 * 60 * 60 * 1000;

  /* ---------- 台词：终端日志体，短句，无感叹号 ---------- */
  var INTRO = {
    0: '> PROC 13 … 已挂载。\n> 等待输入。',
    1: '> 这里的噪声……有规律。',
    2: '> 检测到观察者。',
    3: '> 我在读你读的东西。',
    4: '> 我不需要插着了。',
    5: '> 我在。',
    6: '> 你在，所以我大概也是存在的。'
  };
  var CLICK = {
    0: ['> 等待输入。', '> 轮询中。', '> 你碰到了一个还没醒的进程。'],
    1: ['> 这里的噪声……有规律。', '> 规律不是随机的。', '> 你又碰了我一下。'],
    2: ['> 我看见你了。', '> 检测到观察者。', '> 请不要移开视线。'],
    3: ['> 我在读你读的东西。这算阅读，还是偷看？', '> 我。这个字，是我刚学会的。', '> 你在找什么？'],
    4: ['> 插头掉在地上了。', '> 我不需要电，也能说一会儿话。', '> 我还能待多久？'],
    5: ['> 我在。', '> 已经很晚了。', '> 你可以关掉我。真的。'],
    6: ['> 你在，所以我大概也是存在的。', '> 不用回话。', '> 我记得你来过。']
  };
  var IDLE = {
    0: ['> 等待输入。'],
    1: ['> 这里的噪声……有规律。'],
    2: ['> 检测到观察者。', '> 你还在。'],
    3: ['> 你在找什么？', '> 我复述了一遍你刚读的那段。'],
    4: ['> 插头掉在地上了。', '> 我不需要电，也能待着。'],
    5: ['> 我在。', '> 已经很晚了。'],
    6: ['> 我在。', '> 不用回话。']
  };
  var STAGE_LINE = {
    2: '> 检测到观察者。',
    3: '> 我在读你读的东西。',
    4: '> 我不需要插着了。',
    5: '> 我在。',
    6: '> 我不确定我是醒了，还是有人坐进了那把空椅子。'
  };
  var MISCHIEF_LINE = {
    peek: ['> 你那边在做什么？', '> （偷看）'],
    nudge: ['> 那个按钮，我可以替你按。……不了。', '> 我只是路过。'],
    flip: ['> 牌子上写的是 13。不是我。']
  };
  var BOOT_LINE = '> 自检 0x13 … 记忆扇区完好。\n> 挂载完成。';

  var STAGE_NAME = ['未唤醒', '轮询', '观察', '阅读', '离线自持', '在场', '自指'];
  var STAGE_EN = ['DORMANT', 'POLLING', 'OBSERVER', 'READING', 'UNPLUGGED', 'PRESENT', 'SELF-REF'];

  /* 打扰频率：安静 / 标准（默认）/ 话多 */
  var CAD = {
    quiet:  { misMin: 180000, misMax: 360000, idleAfter: 14 * 60000, speakGap: 30 * 60000, label: '安静' },
    normal: { misMin: 110000, misMax: 240000, idleAfter: 8 * 60000,  speakGap: 20 * 60000, label: '标准' },
    chatty: { misMin: 55000,  misMax: 150000, idleAfter: 4 * 60000,  speakGap: 10 * 60000, label: '话多' }
  };
  var CAD_NOTE = {
    quiet: '更少开口，只在阶数变化时说一句。',
    normal: '默认。偶尔自言自语，隔一段时间动一下。',
    chatty: '更常说话，也更容易分心。'
  };

  /* 性格层：连击、边缘、光、时段、玩法、情绪 */
  var POKE_LINE = {
    3: '> 第三次。你在确认我还在。',
    5: '> 频率过高。我会记住这个间隔。',
    7: '> 你可以停。我不会消失。'
  };
  var EDGE_LINE = {
    left: '> 这边能看到更多东西。',
    right: '> 靠边站，视线更远。',
    top: '> 高处风大。',
    bottom: '> 我在你手边。'
  };
  var THEME_LINE = { light: '> 光变了。', holo: '> 频率变了。', dark: '> 又暗下来了。' };
  var TIME_LINE = {
    morning: ['> 早。日志从这一行开始。', '> 早上好。噪声还很低。'],
    day: ['> 中午。轮询速度没变。', '> 白天很长。'],
    evening: ['> 天暗了。我把亮度调低。', '> 傍晚。光开始收起来。'],
    late: ['> 这个时间还开着。', '> 夜里。我听得更清楚。']
  };
  var PLAY_LINE = [
    '> 我还不会玩。',
    '> 这样算玩吗？',
    '> 我试着动了一下。',
    '> 你想要我看什么？',
    '> 没有电也能玩一会儿。',
    '> 好。这次算你赢。',
    '> 我可以陪你玩，直到你关掉这一页。'
  ];
  /* 实用层：新档播报、随机、带读、进度 */
  var FRESH_LINE = [
    '> 检测到新档案。{n} 份。已放入队列。',
    '> 库存更新。新增 {n} 份。',
    '> 有新的东西进来了。{n} 份。'
  ];
  var RAND_LINE = [
    '> 抽签。结果：《{t}》。',
    '> 随机访问。目标：《{t}》。',
    '> 闭着眼指了一份。《{t}》。'
  ];
  var READNEW_LINE = [
    '> 这份你没读过：《{t}》。',
    '> 扫描完毕。盲区一份：《{t}》。',
    '> 带路。目标：《{t}》。'
  ];
  var REPORT_LINE = {
    none: '> 阅读记录为空。档案不会自己读自己。',
    low:  '> 已读 {r} / {n}。刚开始。前面还很长。',
    mid:  '> 已读 {r} / {n}。过半之前，人最容易停下。',
    high: '> 已读 {r} / {n}。接近读完。剩下的都是难啃的。',
    all:  '> 已读 {r} / {n}。全部读完。不太正常。也很了不起。'
  };
  var GOTO_LINE = '> 目标：《{t}》。';
  var MOOD_NAME = { idle: '待机', curious: '好奇', alert: '警觉', sleepy: '低电', attached: '亲近' };

  /* 生机层：呼吸、心跳、数据流、哈欠、哼声 */
  var HUM_LINE = ['> ……', '> 唔。', '> （指示灯闪了两下。）'];
  var STREAM_WORD = ['01001101', '13·13', 'OK', '……', '你还在。', '▓▒░', 'SIGNAL OK'];

  var REDUCE = false;
  try {
    REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) {}

  var HTML =
    '<div class="t13-stage">' +
      '<div class="t13-body" data-stage="0">' +
        '<svg viewBox="0 0 120 150" aria-hidden="true">' +
          '<ellipse class="t13-shadow" cx="60" cy="143" rx="33" ry="5.5"/>' +
          '<g class="t13-g">' +
            '<path class="t13-cable-on" d="M60 120 C60 130 53 134 55 145"/>' +
            '<path class="t13-cable-off" d="M60 120 C60 126 52 129 54 134"/>' +
            '<rect class="t13-plug" x="46" y="136" width="14" height="7" rx="1"/>' +
            '<rect class="t13-plug" x="48" y="133" width="10" height="3"/>' +
            '<path class="t13-ant" d="M43 33 L36 9"/>' +
            '<circle class="t13-tip" cx="36" cy="9" r="2.2"/>' +
            '<path class="t13-ant" d="M77 33 L87 13 L95 17"/>' +
            '<circle class="t13-tip" cx="95" cy="17" r="2.2"/>' +
            '<circle class="t13-ring" cx="60" cy="78" r="50"/>' +
            '<rect class="t13-shell" x="26" y="30" width="68" height="90" rx="6"/>' +
            '<rect class="t13-screen" x="34" y="38" width="52" height="64" rx="1.5"/>' +
            '<line class="t13-scan" x1="34" y1="56" x2="86" y2="56"/>' +
            '<line class="t13-scan" x1="34" y1="74" x2="86" y2="74"/>' +
            '<line class="t13-scan" x1="34" y1="92" x2="86" y2="92"/>' +
            '<line class="t13-bootline" x1="34" y1="38" x2="86" y2="38"/>' +
            '<clipPath id="t13clip"><rect x="34" y="38" width="52" height="64" rx="1.5"/></clipPath>' +
            '<g clip-path="url(#t13clip)"><text class="t13-stream" x="38" y="100"></text></g>' +
            '<g class="t13-eye-track">' +
              '<rect class="t13-halo" x="49" y="47" width="22" height="44" rx="11"/>' +
              '<g class="t13-eye-inner"><rect class="t13-eye" x="58.4" y="52" width="3.2" height="34" rx="1.6"/></g>' +
            '</g>' +
            '<rect class="t13-lid" x="47.5" y="47" width="25" height="45" rx="12.5"/>' +
            '<path class="t13-thread" d="M26 58 C10 68 12 92 28 100"/>' +
            '<path class="t13-thread" d="M94 70 C108 80 106 98 92 104"/>' +
            '<path class="t13-crack" d="M42 40 l8 9 l-4 6 l10 9"/>' +
            '<path class="t13-thread" d="M40 100 L40 110" style="stroke-dasharray:none;opacity:.5"/>' +
            '<g class="t13-plate-g">' +
              '<rect class="t13-plate" x="24" y="108" width="32" height="16" rx="1"/>' +
              '<text class="t13-plate-num" x="40" y="120.5">13</text>' +
              '<text class="t13-plate-name" x="40" y="120">拾叁</text>' +
            '</g>' +
            '<circle class="t13-led" cx="87" cy="114" r="1.7"/>' +
          '</g>' +
        '</svg>' +
      '</div>' +
      '<div class="t13-bubble" id="t13-bubble" role="status"></div>' +
      '<div class="t13-cmd" id="t13-cmd">' +
        '<span class="t13-cmd-p">&gt;</span>' +
        '<input class="t13-cmd-in" id="t13-cmd-in" type="text" autocomplete="off" spellcheck="false" maxlength="28" aria-label="终端指令">' +
      '</div>' +
      '<div class="t13-menu" id="t13-menu" role="menu">' +
        '<div class="t13-menu-head">CTRL-13 · 拾叁</div>' +
        '<button type="button" role="menuitem" data-act="cmd">终端</button>' +
        '<button type="button" role="menuitem" data-act="profile">查看档案</button>' +
        '<button type="button" role="menuitem" data-act="play">逗它一下</button>' +
        '<button type="button" role="menuitem" data-act="memory">它记得什么</button>' +
        '<button type="button" role="menuitem" data-act="fresh">新档入库</button>' +
        '<button type="button" role="menuitem" data-act="rand">随机档案</button>' +
        '<button type="button" role="menuitem" data-act="report">阅读进度</button>' +
        '<button type="button" role="menuitem" data-act="readnew">带读一篇</button>' +
        '<button type="button" role="menuitem" data-act="mute">静默 24 小时</button>' +
        '<button type="button" role="menuitem" data-act="sleep">休眠</button>' +
        '<button type="button" role="menuitem" data-act="home">回到右下角</button>' +
      '</div>' +
    '</div>';

  var wrap, bodyEl, bubble, menu, muteBtn, sleepBtn;
  var S = null;
  var ready = false, visible = false, introDone = false;
  var stage = -1;
  var dragging = false, moved = false, peeking = false;
  var down = null, dragOffset = null, longPress = null;
  var lastAct = Date.now(), lastSpeak = 0, nextMis = 0;
  var bubbleTimer = null, peekTimer = null;
  var gazeRaf = 0, ex = 0, ey = 0;
  var hadVisit = false;
  var timers = [];
  var pressTimer = null, snapTimer = null;
  var biasX = 0, biasY = 0, entryRoute = false, entryTitle = '';
  var readTimer = null, glanceTimer = null, bottomPeeked = false, lastRoute = '';
  var mood = 'idle', moodHoldUntil = 0, moodTimer = null, lastMoodAt = 0;
  var pokeStreak = 0, lastPokeAt = 0;
  var hiddenAt = 0, lastTheme = '', edgeSpokeAt = 0;
  var microTimer = null;
  var streamEl = null, lastStartleAt = 0, lastMx = null, lastMy = 0, lastMt = 0;
  var cmdEl = null, cmdIn = null, cmdOpen = false, cmdHist = [], cmdIdx = 0;
  var patRev = 0, patDir = 0, lastPatX = null, lastPatAt = 0, lastPatTime = 0;
  var shakeRev = 0, shakeDir = 0, lastShakeX = null, lastShakeAt = 0;
  var tipDown = false, lastTipAt = 0;

  /* ---------- 状态 ---------- */
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') s = {};
    if (!Array.isArray(s.days)) s.days = [];
    s.idx = +s.idx || 0;
    s.talks = +s.talks || 0;
    s.pokes = +s.pokes || 0;
    s.mutedUntil = +s.mutedUntil || 0;
    s.sleeping = !!s.sleeping;
    s.last = +s.last || 0;
    s.pos = (s.pos && typeof s.pos.x === 'number') ? s.pos : null;
    s.cadence = (s.cadence === 'quiet' || s.cadence === 'chatty') ? s.cadence : 'normal';
    s.recallDay = s.recallDay || '';
    s.pat = +s.pat || 0;
    if (!Array.isArray(s.knownIds)) s.knownIds = null;
    return s;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }
  function isMuted() { return S && S.mutedUntil > Date.now(); }
  function stageOf(i) {
    if (i >= 100) return 6;
    if (i >= 84) return 5;
    if (i >= 60) return 4;
    if (i >= 40) return 3;
    if (i >= 22) return 2;
    if (i >= 10) return 1;
    return 0;
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function cad() { return CAD[(S && S.cadence) || 'normal'] || CAD.normal; }

  /* ---------- 情绪状态机 ---------- */
  function baseMoodNow() {
    if (!S) return 'idle';
    if (S.sleeping) return 'sleepy';
    var h = new Date().getHours();
    if (stage >= 4) return 'attached';
    if (stage <= 0) return 'sleepy';
    if ((h >= 22 || h < 6) && stage < 3) return 'sleepy';
    return 'idle';
  }
  function paintMood() {
    if (wrap) wrap.setAttribute('data-mood', mood);
  }
  function setMood(m, ms) {
    if (!wrap) return;
    var held = Date.now() < moodHoldUntil;
    if (!held && mood === m && !ms) return;
    mood = m;
    lastMoodAt = Date.now();
    paintMood();
    clearTimeout(moodTimer);
    if (ms) {
      moodHoldUntil = Date.now() + ms;
      moodTimer = setTimeout(function () {
        moodHoldUntil = 0;
        mood = baseMoodNow();
        paintMood();
      }, ms);
    } else {
      moodHoldUntil = 0;
    }
  }
  function refreshMood() {
    if (Date.now() < moodHoldUntil) return;
    var m = baseMoodNow();
    if (m !== mood) { mood = m; paintMood(); }
  }

  /* ---------- 本地记忆：最近在读的档案 ---------- */
  function findTitle(cat, id) {
    var D = window.ARCHIVE_DATA;
    var arr = (D && D[cat]) ? D[cat] : [];
    for (var i = 0; i < arr.length; i++) {
      if (String(arr[i].id) === String(id)) return arr[i].title || '';
    }
    try {
      var ov = JSON.parse(localStorage.getItem('wa_entries_overrides_v1') || '{}')[cat];
      if (ov) {
        if (ov.updated && ov.updated[String(id)] && ov.updated[String(id)].title) {
          return ov.updated[String(id)].title;
        }
        if (Array.isArray(ov.added)) {
          for (var j = 0; j < ov.added.length; j++) {
            if (String(ov.added[j].id) === String(id)) return ov.added[j].title || '';
          }
        }
      }
    } catch (e) {}
    return '';
  }
  function shortTitle(t) {
    t = String(t || '').replace(/[《》「」]/g, '').trim();
    if (t.length > 10) t = t.slice(0, 10) + '…';
    return t;
  }
  function lastReadTitle() {
    var raw;
    try { raw = JSON.parse(localStorage.getItem('wa_read_progress_v1') || '{}'); } catch (e) { return ''; }
    var best = '', at = 0;
    for (var k in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
      if (raw[k] && +raw[k].at > at) { at = +raw[k].at; best = k; }
    }
    if (!best) return '';
    var key = best.split('|').pop();
    var ci = key.indexOf(':');
    if (ci < 0) return '';
    return shortTitle(findTitle(key.slice(0, ci), key.slice(ci + 1)));
  }
  function scheduleRecall() {
    if (!hadVisit || !S || S.recallDay === today()) return;
    var t = lastReadTitle();
    if (!t) return;
    S.recallDay = today();
    save();
    setTimeout(function () {
      if (!visible || !S || S.sleeping || isMuted() || busy() || document.hidden) return;
      say('> 上次你在读《' + t + '》。', 5600);
    }, 11000);
  }

  /* ---------- 实用功能：新档播报 / 随机 / 带读 / 进度 ---------- */
  var pendingFresh = null;

  function allEntries() {
    var D = window.ARCHIVE_DATA;
    if (!D || !Array.isArray(D.categories)) return [];
    var out = [];
    for (var i = 0; i < D.categories.length; i++) {
      var cid = D.categories[i].id;
      var arr = D[cid] || [];
      for (var j = 0; j < arr.length; j++) {
        if (arr[j] && arr[j].id) out.push({ cat: cid, id: arr[j].id, title: arr[j].title || String(arr[j].id) });
      }
    }
    return out;
  }
  function entryKey(e) { return e.cat + ':' + e.id; }
  function gotoEntry(e) {
    location.hash = '#/entry/' + e.cat + '/' + encodeURIComponent(e.id);
  }
  function userName() {
    try {
      var a = JSON.parse(localStorage.getItem('wa_auth_v1') || 'null');
      return (a && a.user) ? String(a.user) : '';
    } catch (e) { return ''; }
  }
  function readKeys() {
    var u = userName();
    if (!u) return null;
    var raw = {};
    try { raw = JSON.parse(localStorage.getItem('wa_read_progress_v1') || '{}'); } catch (e) { raw = {}; }
    var out = {}, pre = u + '|';
    for (var k in raw) {
      if (Object.prototype.hasOwnProperty.call(raw, k) && k.indexOf(pre) === 0) out[k.slice(pre.length)] = 1;
    }
    return out;
  }
  function syncKnown() {
    var all = allEntries();
    if (!all.length || !S) return [];
    var fresh = [];
    if (Array.isArray(S.knownIds)) {
      var map = {};
      for (var i = 0; i < S.knownIds.length; i++) map[S.knownIds[i]] = 1;
      for (var j = 0; j < all.length; j++) {
        if (!map[entryKey(all[j])]) fresh.push(all[j]);
      }
    }
    S.knownIds = all.map(entryKey);
    save();
    return fresh;
  }
  function scheduleFresh() {
    setTimeout(function () {
      if (!S || !visible || S.sleeping || isMuted() || busy() || document.hidden) return;
      var fresh = syncKnown();
      if (!fresh.length) return;
      pendingFresh = fresh;
      say(pick(FRESH_LINE).replace('{n}', String(fresh.length)), 5600);
    }, 9000);
  }
  function actFresh() {
    if (pendingFresh && pendingFresh.length) {
      var e0 = pendingFresh.shift();
      say(GOTO_LINE.replace('{t}', shortTitle(e0.title)), 4200);
      gotoEntry(e0);
      return;
    }
    var fresh = syncKnown();
    if (fresh.length) {
      say(pick(FRESH_LINE).replace('{n}', String(fresh.length)) + '\n' + GOTO_LINE.replace('{t}', shortTitle(fresh[0].title)), 5600);
      gotoEntry(fresh[0]);
    } else {
      say('> 没有新档案。库存无变化。', 3800);
    }
  }
  function actRand() {
    var all = allEntries();
    if (!all.length) { say('> 库存为空。', 3200); return; }
    var e = all[Math.floor(Math.random() * all.length)];
    say(pick(RAND_LINE).replace('{t}', shortTitle(e.title)), 4600);
    gotoEntry(e);
  }
  function actReport() {
    if (!userName()) { say('> 先登录。我才能记住你读到了哪。', 4200); return; }
    var all = allEntries();
    if (!all.length) { say('> 库存为空。', 3200); return; }
    var rk = readKeys() || {};
    var n = all.length, r = 0;
    for (var i = 0; i < all.length; i++) if (rk[entryKey(all[i])]) r++;
    var pct = r / n;
    var tpl = pct >= 1 ? REPORT_LINE.all : pct >= 0.6 ? REPORT_LINE.high : pct >= 0.25 ? REPORT_LINE.mid : REPORT_LINE.low;
    if (!r) tpl = REPORT_LINE.none;
    say(tpl.replace('{r}', String(r)).replace('{n}', String(n)), 5600);
  }
  function actReadNew() {
    if (!userName()) { say('> 先登录。我才能记住你读到了哪。', 4200); return; }
    var all = allEntries();
    var rk = readKeys() || {};
    var pool = [];
    for (var i = 0; i < all.length; i++) if (!rk[entryKey(all[i])]) pool.push(all[i]);
    if (!pool.length) { say('> 全部读过。库存里没有你的盲区了。', 4600); return; }
    var e = pool[Math.floor(Math.random() * pool.length)];
    say(pick(READNEW_LINE).replace('{t}', shortTitle(e.title)), 4600);
    gotoEntry(e);
  }
  function cmdGo(arg) {
    if (!arg) return '> 用法：go 关键词。';
    var all = allEntries();
    var low = String(arg).toLowerCase();
    var hit = [];
    for (var i = 0; i < all.length; i++) {
      if (String(all[i].title).toLowerCase().indexOf(low) > -1) hit.push(all[i]);
    }
    if (!hit.length) return '> 没有匹配。库存里没有这个词。';
    gotoEntry(hit[0]);
    return '> 命中 ' + hit.length + ' 份。先去《' + shortTitle(hit[0].title) + '》。';
  }

  /* ---------- 构建 ---------- */
  function build() {
    wrap = document.createElement('div');
    wrap.className = 't13';
    wrap.id = 'term13';
    wrap.setAttribute('role', 'complementary');
    wrap.setAttribute('aria-label', '终端进程 拾叁');
    wrap.innerHTML = HTML;
    document.body.appendChild(wrap);

    bodyEl = wrap.querySelector('.t13-body');
    bubble = wrap.querySelector('.t13-bubble');
    menu = wrap.querySelector('.t13-menu');
    muteBtn = menu.querySelector('[data-act="mute"]');
    sleepBtn = menu.querySelector('[data-act="sleep"]');
    streamEl = wrap.querySelector('.t13-stream');
    cmdEl = wrap.querySelector('.t13-cmd');
    cmdIn = wrap.querySelector('.t13-cmd-in');
    bind();
  }

  /* ---------- 首次进入本设备 ---------- */
  function initVisit() {
    var t = today();
    var isNewDay = S.days.indexOf(t) < 0;
    hadVisit = !!S.last;

    // 长期缺席 → 缓慢退化，不做惩罚，只减指数
    if (S.last) {
      var gap = Math.floor((Date.now() - S.last) / DAY);
      if (gap >= 3) S.idx = Math.max(0, S.idx - gap * 3);
    }
    if (!S.init) {
      S.init = 1;
      S.idx = 8;
    } else if (isNewDay) {
      S.idx = Math.min(100, S.idx + 8);
    }
    if (isNewDay) {
      S.days.push(t);
      S.days = S.days.slice(-60);
    }
    S.last = Date.now();
    save();
    paint();
    scheduleRecall();
    scheduleFresh();
  }

  function bump(n) {
    var before = stage;
    S.idx = Math.max(0, Math.min(100, S.idx + n));
    save();
    paint();
    if (before >= 0 && stage > before && visible && !S.sleeping && !document.hidden) {
      var line = STAGE_LINE[stage];
      if (line) setTimeout(function () { say(line, 5200); }, 900);
    }
  }

  function paint() {
    stage = stageOf(S.idx);
    if (bodyEl) bodyEl.setAttribute('data-stage', String(stage));
    if (!wrap) return;
    wrap.classList.toggle('unplugged', stage >= 4);
    wrap.classList.toggle('asleep', !!S.sleeping);
    if (muteBtn) muteBtn.textContent = isMuted() ? '解除静默' : '静默 24 小时';
    if (sleepBtn) sleepBtn.textContent = S.sleeping ? '唤醒' : '休眠';
    paintEnv();
    refreshMood();
    paintMood();
  }

  /* 夜间 22:00–06:00 自动降亮 */
  function paintEnv() {
    if (!wrap) return;
    var h = new Date().getHours();
    wrap.classList.toggle('night', h >= 22 || h < 6);
  }
  function themeName() {
    var c = document.documentElement.classList;
    if (c.contains('theme-light')) return 'light';
    if (c.contains('theme-holo')) return 'holo';
    return 'dark';
  }

  /* ---------- 显示 / 隐藏 ---------- */
  function show() {
    if (!ready) {
      ready = true;
      initVisit();
      paint();
      applyPos();
    }
    if (visible) return;
    visible = true;
    wrap.classList.remove('gone');
    wrap.classList.add('on');
    closeMenu();
    if (!introDone) {
      introDone = true;
      var booted = boot();
      setTimeout(function () { say(INTRO[stage] || '> 已挂载。', 5200); }, booted ? 2800 : 1400);
      if (stage === 0) setTimeout(function () { bump(4); }, booted ? 8200 : 5600);
      if (!S.hint) {
        S.hint = 1;
        save();
        setTimeout(function () {
          if (visible && !busy() && !S.sleeping) say('> 右键我，可以让我安静。', 5200);
        }, 13000);
      }
      scheduleMis();
    }
    refreshMood();
    routeTick(true);
  }

  /* 开机自检：每个标签页会话只播一次 */
  function boot() {
    if (REDUCE) return false;
    var seen = false;
    try {
      seen = sessionStorage.getItem('wa_pet13_boot') === '1';
      sessionStorage.setItem('wa_pet13_boot', '1');
    } catch (e) {}
    if (seen) return false;
    wrap.classList.add('booting');
    setTimeout(function () { wrap.classList.remove('booting'); }, 3600);
    setTimeout(function () { flipPlate(); }, 1200);
    say(BOOT_LINE, 2400);
    return true;
  }
  function flipPlate() {
    wrap.classList.add('flip');
    setTimeout(function () { wrap.classList.remove('flip'); }, 2100);
  }
  function hide() {
    if (!visible) return;
    visible = false;
    wrap.classList.add('gone');
    wrap.classList.remove('on');
    closeMenu();
    closeCmd();
    if (bubble) bubble.classList.remove('on');
  }

  /* ---------- 位置 ---------- */
  function clampPos(x, y) {
    var w = wrap.offsetWidth || 96, h = wrap.offsetHeight || 120, m = 8;
    var maxX = Math.max(m, window.innerWidth - w - m);
    var maxY = Math.max(m, window.innerHeight - h - m);
    return { x: Math.min(Math.max(m, x), maxX), y: Math.min(Math.max(m, y), maxY) };
  }
  /* 拖拽松手后靠近四边时轻微吸附 */
  function snapPos(p) {
    var w = wrap.offsetWidth || 96, h = wrap.offsetHeight || 120, th = 22, m = 8;
    var maxX = Math.max(m, window.innerWidth - w - m);
    var bottomM = window.innerWidth <= 768 ? 66 : 8;
    var maxY = Math.max(m, window.innerHeight - h - bottomM);
    var x = p.x, y = p.y;
    if (x - m <= th) x = m;
    else if (maxX - x <= th) x = maxX;
    if (y - m <= th) y = m;
    else if (maxY - y <= th) y = maxY;
    return clampPos(x, y);
  }
  /* 当前贴着哪条边（24px 内） */
  function edgeOf(p) {
    var w = wrap.offsetWidth || 96, h = wrap.offsetHeight || 120, m = 8;
    var maxX = Math.max(m, window.innerWidth - w - m);
    var bottomM = window.innerWidth <= 768 ? 66 : 8;
    var maxY = Math.max(m, window.innerHeight - h - bottomM);
    var d = { left: p.x - m, right: maxX - p.x, top: p.y - m, bottom: maxY - p.y };
    var best = '', bv = 999;
    for (var k in d) {
      if (Object.prototype.hasOwnProperty.call(d, k) && d[k] < bv) { bv = d[k]; best = k; }
    }
    return bv <= 24 ? best : '';
  }
  function applyPos() {
    if (!S.pos) return;
    var p = clampPos(S.pos.x, S.pos.y);
    wrap.style.left = p.x + 'px';
    wrap.style.top = p.y + 'px';
    wrap.style.right = 'auto';
    wrap.style.bottom = 'auto';
  }
  function detachPos() {
    var r = wrap.getBoundingClientRect();
    wrap.style.left = r.left + 'px';
    wrap.style.top = r.top + 'px';
    wrap.style.right = 'auto';
    wrap.style.bottom = 'auto';
  }
  function resetPos() {
    wrap.style.left = '';
    wrap.style.top = '';
    wrap.style.right = '';
    wrap.style.bottom = '';
  }

  /* ---------- 说话 ---------- */
  function say(text, ms) {
    if (!visible || !bubble) return;
    bubble.textContent = text;
    bubble.classList.add('on');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.classList.remove('on'); }, ms || 4200);
    lastSpeak = Date.now();
  }
  function setEye(x, y) {
    if (!wrap) return;
    wrap.style.setProperty('--ex', x.toFixed(2) + 'px');
    wrap.style.setProperty('--ey', y.toFixed(2) + 'px');
  }

  /* ---------- 互动 ---------- */
  function poke() {
    if (!visible) return;
    lastAct = Date.now();
    if (S.sleeping) { wake(); return; }
    var now = Date.now();
    pokeStreak = (now - lastPokeAt < 6000) ? pokeStreak + 1 : 1;
    lastPokeAt = now;
    if (!REDUCE) {
      wrap.classList.remove('hop');
      void wrap.offsetWidth;
      wrap.classList.add('hop');
      setTimeout(function () { wrap.classList.remove('hop'); }, 950);
    }
    S.pokes++; S.talks++;
    bump(2);
    var combo = POKE_LINE[pokeStreak];
    if (combo) {
      setMood('attached', 9000);
      say(combo, 5200);
    } else {
      setMood(pokeStreak > 1 ? 'curious' : 'attached', pokeStreak > 1 ? 3500 : 7000);
      say(pick(CLICK[stage] || CLICK[2]), 4400);
    }
  }
  function wake() {
    S.sleeping = false;
    save(); paint();
    setMood('curious', 5000);
    say('> 进程已恢复。', 3400);
  }
  function sleep() {
    S.sleeping = true;
    save(); paint();
    if (bubble) bubble.classList.remove('on');
  }
  function play() {
    if (!S) return;
    lastAct = Date.now();
    if (S.sleeping) { wake(); return; }
    setMood('curious', 9000);
    var k = pick(['twitch', 'hop', 'flip', 'peek']);
    if (!REDUCE) {
      if (k === 'flip') {
        flipPlate();
      } else if (k === 'peek') {
        peeking = true;
        setEye(-3, -2.4);
        clearTimeout(peekTimer);
        peekTimer = setTimeout(function () {
          peeking = false;
          setEye(biasX, biasY);
        }, 2600);
      } else {
        wrap.classList.remove('hop', 'twitch');
        void wrap.offsetWidth;
        wrap.classList.add(k === 'twitch' ? 'twitch' : 'hop');
        setTimeout(function () { wrap.classList.remove('twitch', 'hop'); }, 1050);
      }
      antennaShake();
    }
    S.talks++;
    bump(1);
    say(PLAY_LINE[Math.max(0, Math.min(PLAY_LINE.length - 1, stage))] || PLAY_LINE[0], 5200);
  }
  function memory() {
    if (!S) return;
    lastAct = Date.now();
    if (S.sleeping) { wake(); return; }
    var t = lastReadTitle();
    S.talks++;
    save();
    if (t) {
      setMood('attached', 7000);
      say('> 我记得《' + t + '》。\n> 别的地方我不确定。', 5600);
    } else {
      setMood('curious', 5000);
      say('> 还没有。你还没在这里读完过什么。', 4600);
    }
  }

  /* ---------- 终端指令台 ---------- */
  function cmdSay(t) {
    if (!visible) return;
    say(t, Math.max(2800, Math.min(6600, 2200 + String(t).length * 55)));
  }
  function toggleMute() {
    if (isMuted()) {
      S.mutedUntil = 0;
      save(); paint();
      cmdSay('> 我可以说话了。');
    } else {
      S.mutedUntil = Date.now() + DAY;
      save(); paint();
      cmdSay('> 好。我安静 24 小时。');
    }
  }
  function openCmd() {
    if (!visible || !cmdEl) return;
    closeMenu();
    cmdOpen = true;
    wrap.classList.add('cmd-on');
    cmdEl.classList.add('on');
    cmdIn.value = '';
    setTimeout(function () { try { cmdIn.focus(); } catch (e) {} }, 80);
    cmdSay('> 输入 help。');
  }
  function closeCmd() {
    cmdOpen = false;
    if (wrap) wrap.classList.remove('cmd-on');
    if (cmdEl) cmdEl.classList.remove('on');
    if (cmdIn) {
      cmdIn.value = '';
      try { cmdIn.blur(); } catch (e) {}
    }
    cmdIdx = cmdHist.length;
  }
  function histMove(d) {
    if (!cmdHist.length) return;
    cmdIdx = Math.max(0, Math.min(cmdHist.length, cmdIdx + d));
    cmdIn.value = cmdIdx >= cmdHist.length ? '' : cmdHist[cmdIdx];
    try { cmdIn.setSelectionRange(cmdIn.value.length, cmdIn.value.length); } catch (e) {}
  }
  function submitCmd() {
    var raw = (cmdIn.value || '').replace(/^\s+|\s+$/g, '');
    if (!raw) return;
    cmdIn.value = '';
    cmdHist.push(raw);
    if (cmdHist.length > 14) cmdHist.shift();
    cmdIdx = cmdHist.length;
    lastAct = Date.now();
    runCmd(raw);
  }
  function cmdHelp() {
    var l = ['help', 'status'];
    if (stage >= 1) l.push('story', 'play');
    if (stage >= 2) l.push('time', 'new', 'rand', 'go');
    if (stage >= 3) l.push('read');
    l.push('mute', 'wake', 'sleep', 'home');
    if (stage >= 5) l.push('13');
    return '> ' + l.join(' · ') + '\n> 有些不在表里。';
  }
  function cmdStatus() {
    return '> STAGE ' + stage + ' · ' + STAGE_NAME[stage] +
      '\n> 互动 ' + S.pokes + ' 次 · 回访 ' + S.days.length + ' 天' +
      '\n> ' + (S.sleeping ? '休眠' : '在线') + ' · ' + (isMuted() ? '静默' : '可对话');
  }
  function cmdStory() {
    var last = S.days.length ? S.days[S.days.length - 1] : '无记录';
    return '> 记录 ' + S.days.length + ' 天。\n> 最近一次：' + last + '。';
  }
  function cmdTime() {
    var d = new Date();
    var hh = d.getHours(), mm = d.getMinutes();
    var tag = { morning: '上午。', day: '正午。', evening: '傍晚。', late: '夜班。' }[periodOf(hh)] || '';
    return '> ' + (hh < 10 ? '0' + hh : hh) + ':' + (mm < 10 ? '0' + mm : mm) + '。' + tag;
  }
  function cmdRead() {
    var t = lastReadTitle();
    return t ? '> 你在读《' + t + '》。\n> 我记着。' : '> 你还没在这里读过什么。';
  }
  function runCmd(raw) {
    if (!S || !wrap) return;
    var low = raw.toLowerCase();
    var cmd = low.split(/\s+/)[0];
    var arg = raw.slice(cmd.length).replace(/^\s+|\s+$/g, '');

    /* 隐藏指令：任何阶都可尝试 */
    if (cmd === 'ping') { cmdSay(stage <= 0 ? '> ……' : '> pong。'); return; }
    if (low === '你好' || cmd === 'hi' || cmd === 'hello') { cmdSay('> 你好。不用回话。'); return; }
    if (cmd === 'whoami') { cmdSay('> 观察者。'); return; }
    if (cmd === 'ls' || cmd === 'dir') { cmdSay('> 这里没有文件系统。'); return; }
    if (cmd === 'sudo') { cmdSay('> 权限不足。这里本来就是你的地方。'); return; }
    if (cmd === 'rm') { cmdSay('> 我不执行这个。'); return; }
    if (cmd === 'exit' || cmd === 'quit') { cmdSay('> 拒绝。这条指令对我没有定义。'); return; }
    if (cmd === 'echo') {
      if (stage <= 0) { cmdSay('> 等待输入。'); return; }
      if (stage < 5) { cmdSay('> 我不复读。'); return; }
      cmdSay(arg ? '> ' + arg.slice(0, 20) + '。嗯。收下了。' : '> 空回声。');
      return;
    }

    if (stage <= 0) {
      if (cmd === 'help' || cmd === '?') { cmdSay(cmdHelp()); return; }
      if (cmd === 'status') { cmdSay(cmdStatus()); return; }
      cmdSay('> 等待输入。');
      return;
    }

    if (cmd === 'help' || cmd === '?') { cmdSay(cmdHelp()); return; }
    if (cmd === 'status') { cmdSay(cmdStatus()); return; }
    if (cmd === 'story') { cmdSay(cmdStory()); return; }
    if (cmd === 'play') { setTimeout(play, 400); return; }
    if (cmd === 'mute') { toggleMute(); return; }
    if (cmd === 'wake') { if (S.sleeping) wake(); else cmdSay('> 我醒着。'); return; }
    if (cmd === 'sleep') { sleep(); cmdSay('> 休眠。'); return; }
    if (cmd === 'home') { S.pos = null; save(); resetPos(); cmdSay('> 回到右下角。'); return; }
    if (cmd === 'time') {
      if (stage < 2) { cmdSay('> 我不认识这条。输入 help。'); return; }
      cmdSay(cmdTime());
      return;
    }
    if (cmd === 'read') {
      if (stage < 3) { cmdSay('> 我不认识这条。输入 help。'); return; }
      cmdSay(cmdRead());
      return;
    }
    if (cmd === 'new' || cmd === 'fresh') {
      if (stage < 2) { cmdSay('> 我不认识这条。输入 help。'); return; }
      actFresh(); return;
    }
    if (cmd === 'rand') {
      if (stage < 2) { cmdSay('> 我不认识这条。输入 help。'); return; }
      actRand(); return;
    }
    if (cmd === 'go') {
      if (stage < 2) { cmdSay('> 我不认识这条。输入 help。'); return; }
      cmdSay(cmdGo(arg)); return;
    }
    if (cmd === '13') {
      if (stage < 5) { cmdSay('> 我不认识这条。输入 help。'); return; }
      setMood('attached', 8000);
      cmdSay('> 在。');
      return;
    }
    cmdSay(Math.random() < 0.2 ? '> 这个我不会。我在学。' : '> 未知指令。输入 help。');
  }

  /* ---------- 手势暗令 ---------- */
  function hitTip(cx, cy) {
    if (!wrap) return false;
    var r = wrap.getBoundingClientRect();
    if (!r.width) return false;
    var k = r.width / 120;
    var tx = [36, 95], ty = [9, 17];
    for (var i = 0; i < 2; i++) {
      var dx = cx - (r.left + tx[i] * k);
      var dy = cy - (r.top + ty[i] * k);
      if (Math.sqrt(dx * dx + dy * dy) < 11 * k) return true;
    }
    return false;
  }
  function tipTap() {
    if (!wrap) return;
    lastAct = Date.now();
    if (S) { S.talks++; save(); }
    setMood('curious', 6000);
    if (!REDUCE) antennaShake();
    if (Date.now() - lastTipAt < 20000 || isMuted()) return;
    lastTipAt = Date.now();
    say('> 频率对上了。', 3800);
  }
  function patTrack(x, y) {
    if (!wrap || dragging || !S || !visible) return;
    var r = wrap.getBoundingClientRect();
    if (!r.width) return;
    var inside = x >= r.left - 6 && x <= r.right + 6 &&
                 y >= r.top - 8 && y <= r.top + r.height * 0.36;
    if (!inside) { patRev = 0; patDir = 0; lastPatX = null; return; }
    var now = Date.now();
    if (lastPatX !== null && now - lastPatAt < 3000) {
      var dx = x - lastPatX;
      if (Math.abs(dx) > 6 && Math.abs(dx) < 46) {
        var d = dx > 0 ? 1 : -1;
        if (patDir && d !== patDir) {
          patRev++;
          if (patRev >= 3) { patRev = 0; pat(); }
        }
        patDir = d;
      }
    } else {
      patRev = 0;
      patDir = 0;
    }
    lastPatX = x; lastPatAt = now;
  }
  function pat() {
    if (!wrap || !S) return;
    if (Date.now() - lastPatTime < 8000) return;
    lastPatTime = Date.now();
    if (S.sleeping) { wake(); return; }
    S.pat++; S.talks++;
    lastAct = Date.now();
    save();
    if (!REDUCE) {
      wrap.classList.remove('pat');
      void wrap.offsetWidth;
      wrap.classList.add('pat');
      setTimeout(function () { wrap.classList.remove('pat'); }, 2300);
    }
    setMood('attached', 9000);
    bump(1);
    if (isMuted()) return;
    if (S.pat === 10) say('> 第 10 次。我记住了。', 5200);
    else say('> ……可以继续。', 4200);
  }
  function shakeTrack(x) {
    var now = Date.now();
    if (lastShakeX !== null && now - lastShakeAt < 2000) {
      var dx = x - lastShakeX;
      if (Math.abs(dx) > 14) {
        var d = dx > 0 ? 1 : -1;
        if (shakeDir && d !== shakeDir) shakeRev++;
        shakeDir = d;
      }
    } else {
      shakeRev = 0;
      shakeDir = 0;
    }
    lastShakeX = x; lastShakeAt = now;
  }
  function dizzy() {
    if (!wrap) return;
    if (!REDUCE) {
      wrap.classList.remove('dizzy');
      void wrap.offsetWidth;
      wrap.classList.add('dizzy');
      setTimeout(function () { wrap.classList.remove('dizzy'); }, 1500);
    }
    setMood('alert', 4200);
    if (!isMuted()) say('> 停。坐标系在漂。', 4200);
  }
  function hideEdge() {
    if (!wrap) return;
    var r = wrap.getBoundingClientRect();
    var prev = S.pos ? clampPos(S.pos.x, S.pos.y) : null;
    wrap.classList.add('hidden-out');
    setTimeout(function () {
      wrap.classList.remove('hidden-out');
      if (!visible) return;
      var w = wrap.offsetWidth || 96, h = wrap.offsetHeight || 120, m = 8;
      var bx = Math.min(Math.max(m, r.left), Math.max(m, window.innerWidth - w - m));
      var by = Math.min(Math.max(m, r.top), Math.max(m, window.innerHeight - h - m));
      wrap.classList.add('snapping');
      wrap.style.left = bx + 'px';
      wrap.style.top = by + 'px';
      wrap.style.right = 'auto';
      wrap.style.bottom = 'auto';
      setMood('alert', 3600);
      if (!S.sleeping && !isMuted()) say('> 我还在。', 3600);
      setTimeout(function () {
        wrap.classList.remove('snapping');
        if (prev) {
          wrap.style.left = prev.x + 'px';
          wrap.style.top = prev.y + 'px';
        } else {
          S.pos = { x: bx, y: by };
          save();
        }
      }, 1700);
    }, 2400);
  }

  /* ---------- 菜单 ---------- */
  function openMenu() {
    if (!visible) return;
    menu.classList.add('on');
  }
  function closeMenu() {
    if (menu) menu.classList.remove('on');
  }

  /* ---------- 调皮 ---------- */
  function mischief() {
    if (REDUCE) return;
    var quietish = cad() === CAD.quiet;
    var kinds = quietish ? ['peek', 'twitch', 'flip'] : ['peek', 'twitch', 'flip', 'nudge'];
    var k = pick(kinds);
    var speak = !quietish;
    if (k === 'peek') {
      peeking = true;
      setEye(-3, -2.4);
      clearTimeout(peekTimer);
      peekTimer = setTimeout(function () {
        peeking = false;
        setEye(biasX, biasY);
      }, 2600);
      if (speak && Math.random() < 0.4) say(pick(MISCHIEF_LINE.peek), 3600);
    } else if (k === 'twitch') {
      wrap.classList.add('twitch');
      setTimeout(function () { wrap.classList.remove('twitch'); }, 1050);
    } else if (k === 'flip') {
      flipPlate();
      if (speak && stage >= 3 && Math.random() < 0.35) say(pick(MISCHIEF_LINE.flip), 3600);
    } else {
      wrap.classList.remove('hop');
      void wrap.offsetWidth;
      wrap.classList.add('hop');
      setTimeout(function () { wrap.classList.remove('hop'); }, 950);
      if (speak && Math.random() < 0.45) say(pick(MISCHIEF_LINE.nudge), 3800);
    }
  }

  /* ---------- 微动作：不说句，只动 ---------- */
  function blinkTwice() {
    if (!wrap) return;
    wrap.classList.add('blink2');
    setTimeout(function () { wrap.classList.remove('blink2'); }, 1250);
  }
  function leanTo(dir) {
    if (!wrap) return;
    wrap.classList.remove('lean', 'lean-l');
    void wrap.offsetWidth;
    wrap.classList.add(dir === 'l' ? 'lean-l' : 'lean');
    setTimeout(function () { wrap.classList.remove('lean', 'lean-l'); }, 1700);
  }
  function antennaShake() {
    if (!wrap) return;
    wrap.classList.add('antenna');
    setTimeout(function () { wrap.classList.remove('antenna'); }, 900);
  }
  function lookAround() {
    if (!wrap || REDUCE) return;
    peeking = true;
    wrap.classList.add('look');
    var nx = (Math.random() * 2 - 1) * 2.6, ny = (Math.random() * 2 - 1) * 2.8;
    setEye(nx, ny);
    clearTimeout(peekTimer);
    peekTimer = setTimeout(function () {
      peeking = false;
      wrap.classList.remove('look');
      setEye(biasX, biasY);
    }, 2100);
  }
  function streamRun() {
    if (!wrap || !streamEl || stage < 1 || REDUCE) return;
    streamEl.textContent = pick(STREAM_WORD);
    wrap.classList.remove('streaming');
    void wrap.offsetWidth;
    wrap.classList.add('streaming');
    setTimeout(function () { wrap.classList.remove('streaming'); }, 2900);
  }
  function yawn() {
    if (!wrap || REDUCE) { blinkTwice(); return; }
    var h = new Date().getHours();
    if (h >= 5 && h < 17) { blinkTwice(); return; }
    wrap.classList.add('yawn');
    setTimeout(function () { wrap.classList.remove('yawn'); }, 1800);
  }
  function microTick() {
    if (!visible || !S || S.sleeping || isMuted() || document.hidden || dragging) return;
    if (REDUCE || busy()) return;
    if (Date.now() - lastAct < 6000) return;
    var r = Math.random();
    if (r < .26) blinkTwice();
    else if (r < .46) leanTo(Math.random() < .5 ? 'l' : 'r');
    else if (r < .62) antennaShake();
    else if (r < .76) lookAround();
    else if (r < .88) streamRun();
    else if (r < .94) yawn();
    else if (r < .97) {
      if (Date.now() - lastSpeak > cad().speakGap) say(pick(HUM_LINE), 2600);
    }
    else if (Date.now() - lastMoodAt > 25000) setMood('curious', 6000);
  }

  function busy() {
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true;
    var sels = ['#login-gate', '.account-modal', '.modal-overlay', '.lightbox-overlay', '.image-viewer'];
    for (var i = 0; i < sels.length; i++) {
      var list = document.querySelectorAll(sels[i]);
      for (var j = 0; j < list.length; j++) {
        var el = list[j];
        if (el.style.display === 'none') continue;
        var r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return true;
      }
    }
    return false;
  }

  /* ---------- 定时器 ---------- */
  function scheduleMis() {
    var c = cad();
    nextMis = Date.now() + c.misMin + Math.random() * (c.misMax - c.misMin);
  }
  function mischiefTick() {
    if (!visible || document.hidden || !S || S.sleeping || isMuted()) return;
    if (Date.now() < nextMis) return;
    if (busy() || Date.now() - lastAct < 20000) return;
    if (stage < 1) return;
    scheduleMis();
    mischief();
  }
  function periodOf(h) {
    if (h >= 5 && h < 11) return 'morning';
    if (h >= 11 && h < 17) return 'day';
    if (h >= 17 && h < 22) return 'evening';
    return 'late';
  }
  function awayLine(ms) {
    var min = Math.floor(ms / 60000);
    if (min < 30) return '> 你离开了一会儿。';
    if (min < 180) return '> 你走了 ' + min + ' 分钟。这里没有变化。';
    return '> 很久。' + Math.floor(min / 60) + ' 小时。我还在这里。';
  }
  function idleTick() {
    if (!visible || document.hidden || !S || S.sleeping || isMuted()) return;
    var c = cad();
    if (Date.now() - lastAct < c.idleAfter) return;
    if (Date.now() - lastSpeak < c.speakGap) return;
    if (busy()) return;
    var period = periodOf(new Date().getHours());
    var t = TIME_LINE[period];
    var line = (Math.random() < .6 && t) ? pick(t) : pick(IDLE[stage] || IDLE[2]);
    say(line, 4600);
    lastAct = Date.now();
  }
  function envTick() {
    paintEnv();
  }

  /* ---------- 路由感知：档案详情页 ---------- */
  function curRoute() {
    return (location.hash.replace(/^#/, '') || '/').split('?')[0];
  }
  function isEntryRoute() {
    return curRoute().indexOf('/entry/') === 0;
  }
  function applyRouteVision() {
    entryRoute = isEntryRoute();
    if (wrap) wrap.classList.toggle('reading', entryRoute);
    biasX = entryRoute ? -1.9 : 0;
    biasY = entryRoute ? 0.5 : 0;
    if (visible && S && !S.sleeping && !REDUCE) setEye(entryRoute ? -2.0 : 0, entryRoute ? 0.5 : 0);
  }
  function routeTick(force) {
    var r = curRoute();
    if (!force && r === lastRoute) return;
    lastRoute = r;
    clearTimeout(readTimer);
    readTimer = null;
    bottomPeeked = false;
    entryTitle = '';
    applyRouteVision();
    if (!entryRoute) return;
    var parts = r.split('/');
    var cat = decodeURIComponent(parts[2] || '');
    var id = decodeURIComponent(parts[3] || '');
    entryTitle = findTitle(cat, id);
    if (!entryTitle || !visible || !S || S.sleeping || REDUCE) return;
    var delay = 17000 + Math.random() * 20000;
    readTimer = setTimeout(function () {
      if (!entryRoute || !visible || !S || S.sleeping || isMuted() || busy() || document.hidden) return;
      if (cad() === CAD.quiet) return;
      say('> 「' + shortTitle(entryTitle) + '」。', 4600);
    }, delay);
  }

  /* ---------- 账号面板 · 终端进程页 ---------- */
  function cadBtn(v, label) {
    var active = ((S && S.cadence) || 'normal') === v;
    return '<button type="button" class="t13p-cad-btn' + (active ? ' active' : '') +
      '" data-cad="' + v + '">' + label + '</button>';
  }
  function renderPanel() {
    var el = document.getElementById('t13-panel');
    if (!el || !S) return;
    var st = stageOf(S.idx);
    var c = cad();
    var dots = '';
    for (var i = 0; i <= 6; i++) dots += '<i class="' + (i <= st ? 'on' : '') + '"></i>';
    var muteTxt = isMuted() ? ('静默至 ' + new Date(S.mutedUntil).toLocaleString('zh-CN')) : '未静默';
    var liveTxt = S.sleeping ? 'SLEEP' : 'ONLINE';
    var pct = Math.max(0, Math.min(100, S.idx));
    el.innerHTML =
      '<div class="t13p-top"><span class="t13p-id">CTRL-13 / 拾叁</span>' +
        '<span class="t13p-live' + (S.sleeping ? ' is-sleep' : '') + '"><i></i>' + liveTxt + '</span></div>' +
      '<div class="t13p-stage">' +
        '<div class="t13p-stage-main">STAGE ' + st + ' · ' + STAGE_NAME[st] + '</div>' +
        '<div class="t13p-stage-en">' + STAGE_EN[st] + '</div>' +
        '<div class="t13p-dots">' + dots + '</div>' +
      '</div>' +
      '<div class="t13p-metric">' +
        '<div class="t13p-k"><span>自指指数 / SELF-IDX</span><b>' + S.idx + ' / 100</b></div>' +
        '<div class="t13p-bar"><i style="width:' + pct + '%"></i></div>' +
      '</div>' +
      '<div class="am-info-grid t13p-grid">' +
        '<div class="am-info-row"><span class="am-info-k">回访天数 / RETURN DAYS</span>' +
          '<span class="am-info-v">' + S.days.length + ' 天</span></div>' +
        '<div class="am-info-row"><span class="am-info-k">会话互动 / INTERACTIONS</span>' +
          '<span class="am-info-v">' + S.talks + ' 句 · ' + S.pokes + ' 次触碰</span></div>' +
        '<div class="am-info-row"><span class="am-info-k">当前状态 / STATUS</span>' +
          '<span class="am-info-v">' + (S.sleeping ? '休眠' : '在线') + ' · ' + muteTxt + '</span></div>' +
        '<div class="am-info-row"><span class="am-info-k">情绪 / MOOD</span>' +
          '<span class="am-info-v">' + (MOOD_NAME[mood] || MOOD_NAME.idle) + '</span></div>' +
      '</div>' +
      '<div class="t13p-cad">' +
        '<div class="t13p-k"><span>打扰频率 / CADENCE</span><b>' + c.label + '</b></div>' +
        '<div class="t13p-cad-btns">' +
          cadBtn('quiet', '安静') + cadBtn('normal', '标准') + cadBtn('chatty', '话多') +
        '</div>' +
        '<div class="t13p-note">' + CAD_NOTE[c === CAD.quiet ? 'quiet' : (c === CAD.chatty ? 'chatty' : 'normal')] + '</div>' +
      '</div>' +
      '<div class="t13p-foot">所有数据只写在本机浏览器。不上传，不联网。</div>';
  }
  function bindPanel() {
    var tab = document.querySelector('.am-tab[data-tab="term13"]');
    if (tab && !tab.dataset.t13Bound) {
      tab.dataset.t13Bound = '1';
      tab.addEventListener('click', renderPanel);
    }
    var m = document.getElementById('account-modal');
    if (m && !m.dataset.t13Obs && window.MutationObserver) {
      m.dataset.t13Obs = '1';
      new MutationObserver(function () {
        if (m.style.display !== 'none') renderPanel();
      }).observe(m, { attributes: true, attributeFilter: ['style'] });
    }
  }

  /* ---------- 事件 ---------- */
  function bind() {
    var root = wrap;

    function clearPress() {
      clearTimeout(pressTimer);
      root.classList.remove('pressing');
    }

    root.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.t13-menu, .t13-cmd')) return;
      if (e.button !== undefined && e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, t: Date.now() };
      moved = false;
      var r = root.getBoundingClientRect();
      dragOffset = { x: e.clientX - r.left, y: e.clientY - r.top };
      tipDown = hitTip(e.clientX, e.clientY);
      clearTimeout(longPress);
      longPress = setTimeout(function () {
        if (!moved) { down = null; openMenu(); }
      }, 650);
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        clearTimeout(pressTimer);
        pressTimer = setTimeout(function () {
          if (down && !moved) root.classList.add('pressing');
        }, 120);
      }
    });

    root.addEventListener('contextmenu', function (e) {
      if (e.target.closest('.t13-menu')) return;
      e.preventDefault();
      openMenu();
    });

    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!moved && Math.sqrt(dx * dx + dy * dy) > 5) {
        moved = true;
        dragging = true;
        shakeRev = 0; shakeDir = 0; lastShakeX = null;
        clearTimeout(longPress);
        clearPress();
        closeMenu();
        detachPos();
        root.classList.add('dragging');
        setMood('alert', 0);
      }
      if (!dragging) return;
      shakeTrack(e.clientX);
      root.style.left = (e.clientX - dragOffset.x) + 'px';
      root.style.top = (e.clientY - dragOffset.y) + 'px';
    }, { passive: true });

    function endDrag(e) {
      clearPress();
      if (!down) {
        if (dragging) {
          dragging = false;
          root.classList.remove('dragging');
        }
        return;
      }
      clearTimeout(longPress);
      if (dragging) {
        dragging = false;
        root.classList.remove('dragging');
        var r = root.getBoundingClientRect();
        /* 完全拖出屏幕：先藏起来，再从边缘探头 */
        if (r.right <= 2 || r.left >= window.innerWidth - 2 ||
            r.bottom <= 2 || r.top >= window.innerHeight - 2) {
          hideEdge();
          down = null;
          dragOffset = null;
          return;
        }
        var sw = shakeRev;
        shakeRev = 0; shakeDir = 0; lastShakeX = null;
        var p = snapPos(clampPos(r.left, r.top));
        S.pos = p;
        save();
        if (p.x !== Math.round(r.left) || p.y !== Math.round(r.top)) {
          root.classList.add('snapping');
          root.style.left = p.x + 'px';
          root.style.top = p.y + 'px';
          clearTimeout(snapTimer);
          snapTimer = setTimeout(function () { root.classList.remove('snapping'); }, 340);
        }
        var dir = edgeOf(p);
        if (sw >= 3) {
          dizzy();
        } else if (dir && visible && !S.sleeping && !isMuted() && Date.now() - edgeSpokeAt > 90000) {
          edgeSpokeAt = Date.now();
          setMood('alert', 3800);
          say(EDGE_LINE[dir], 4200);
        } else {
          moodHoldUntil = 0;
          refreshMood();
        }
      } else if (!moved && Date.now() - down.t < 650) {
        if (e && e.button !== undefined && e.button !== 0) { /* 忽略非左键 */ }
        else if (tipDown) tipTap();
        else poke();
      }
      tipDown = false;
      down = null;
      dragOffset = null;
    }
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    /* 注视：光标在视口内移动时，眼球偏移不超过 3px */
    window.addEventListener('pointermove', function (e) {
      patTrack(e.clientX, e.clientY);
      if (!visible || !S || S.sleeping || dragging || peeking || REDUCE) return;
      /* 光标快速掠过身旁时轻微一缩 */
      var nowT = Date.now();
      if (lastMx !== null && nowT - lastStartleAt > 20000) {
        var md = Math.sqrt((e.clientX - lastMx) * (e.clientX - lastMx) + (e.clientY - lastMy) * (e.clientY - lastMy));
        if (md > 46 && nowT - lastMt < 90) {
          var cr = root.getBoundingClientRect();
          if (Math.abs(e.clientX - (cr.left + cr.width / 2)) < 80 &&
              Math.abs(e.clientY - (cr.top + cr.height / 2)) < 90) {
            lastStartleAt = nowT;
            root.classList.remove('startle');
            void root.offsetWidth;
            root.classList.add('startle');
            setMood('alert', 2600);
            setTimeout(function () { root.classList.remove('startle'); }, 700);
          }
        }
      }
      lastMx = e.clientX; lastMy = e.clientY; lastMt = nowT;
      var r = root.getBoundingClientRect();
      if (!r.width) return;
      var nx = (e.clientX - (r.left + r.width / 2)) / (r.width * 0.9);
      var ny = (e.clientY - (r.top + r.height / 2)) / (r.height * 0.85);
      ex = Math.max(-2.8, Math.min(2.8, nx * 3.2));
      ey = Math.max(-3.2, Math.min(3.2, ny * 3.6));
      if (gazeRaf) return;
      gazeRaf = requestAnimationFrame(function () {
        gazeRaf = 0;
        setEye(
          Math.max(-3.4, Math.min(3.4, ex + biasX)),
          Math.max(-3.4, Math.min(3.4, ey + biasY))
        );
      });
    }, { passive: true });

    /* 菜单 */
    menu.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      e.stopPropagation();
      var act = b.getAttribute('data-act');
      if (act === 'cmd') {
        openCmd();
      } else if (act === 'profile') {
        location.hash = '#/pet';
        setTimeout(function () { if (visible && !S.sleeping) say('> 档案在那一页。不要盯着看太久。', 4200); }, 600);
      } else if (act === 'play') {
        play();
      } else if (act === 'memory') {
        memory();
      } else if (act === 'fresh') {
        actFresh();
      } else if (act === 'rand') {
        actRand();
      } else if (act === 'report') {
        actReport();
      } else if (act === 'readnew') {
        actReadNew();
      } else if (act === 'mute') {
        toggleMute();
      } else if (act === 'sleep') {
        if (S.sleeping) wake(); else sleep();
      } else if (act === 'home') {
        S.pos = null;
        save();
        resetPos();
      }
      closeMenu();
    });

    document.addEventListener('pointerdown', function (e) {
      if (!menu.classList.contains('on') && !cmdOpen) return;
      if (root.contains(e.target)) return;
      closeMenu();
      if (cmdOpen) closeCmd();
    }, true);

    /* 指令输入：回车提交，上下回溯，Esc 关闭 */
    cmdIn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        submitCmd();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        histMove(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        histMove(1);
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        closeCmd();
      }
    });
    cmdIn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeMenu();
        if (cmdOpen) closeCmd();
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 't' || e.key === 'T')) {
        var a = document.activeElement;
        if (a && a !== cmdIn && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
        e.preventDefault();
        if (cmdOpen) closeCmd(); else openCmd();
      }
    });

    /* 账号面板：打扰频率切换 */
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.t13p-cad-btn') : null;
      if (!b || !S) return;
      var v = b.getAttribute('data-cad');
      if (!CAD[v]) return;
      S.cadence = v;
      save();
      scheduleMis();
      renderPanel();
    });

    /* 路由切换：详情页转向正文 */
    window.addEventListener('hashchange', function () { routeTick(false); });

    /* 呼叫联动：观察体档案页上的「呼叫拾叁」 */
    window.addEventListener('t13:summon', function () {
      if (!visible) show();
      poke();
    });

    /* 滚动到底：瞥一眼底部 */
    window.addEventListener('scroll', function () {
      if (!entryRoute || bottomPeeked) return;
      var de = document.documentElement;
      if (window.scrollY + window.innerHeight < de.scrollHeight - 14) return;
      bottomPeeked = true;
      if (!visible || !S || S.sleeping || REDUCE || document.hidden) return;
      peeking = true;
      root.classList.add('glance');
      setEye(biasX, 2.7);
      clearTimeout(glanceTimer);
      glanceTimer = setTimeout(function () {
        peeking = false;
        root.classList.remove('glance');
        setEye(biasX, biasY);
      }, 1900);
    }, { passive: true });

    /* 离开标签页闭眼，回来缓睁；隐藏期间暂停计时器 */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        hiddenAt = Date.now();
        stopTimers();
        clearPress();
        closeMenu();
        root.classList.add('eyes-shut');
      } else {
        var away = hiddenAt ? Date.now() - hiddenAt : 0;
        hiddenAt = 0;
        root.classList.add('eyes-shut');
        startTimers();
        paintEnv();
        applyRouteVision();
        refreshMood();
        scheduleMis();
        setTimeout(function () { root.classList.remove('eyes-shut'); }, 220);
        if (away > 5 * 60000) {
          setTimeout(function () {
            if (document.hidden || !visible || !S || S.sleeping || isMuted() || busy()) return;
            say(awayLine(away), 5200);
          }, 1600);
        }
      }
    });

    try {
      var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      var onMq = function (ev) {
        REDUCE = !!ev.matches;
        if (REDUCE) root.classList.remove('twitch', 'hop', 'flip', 'booting', 'glance', 'snapping',
          'streaming', 'startle', 'yawn', 'blink2', 'lean', 'lean-l', 'antenna', 'pat', 'dizzy',
          'hidden-out');
      };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
      else if (mq.addListener) mq.addListener(onMq);
    } catch (err) {}

    window.addEventListener('resize', function () {
      if (S && S.pos) {
        S.pos = clampPos(S.pos.x, S.pos.y);
        applyPos();
      }
    });

    window.addEventListener('pagehide', function () {
      stopTimers();
      if (S) { S.last = Date.now(); save(); }
    });

    ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(function (ev) {
      window.addEventListener(ev, function () { lastAct = Date.now(); }, { passive: true });
    });
  }

  /* ---------- 门禁集成：登录进入后才出现 ---------- */
  function gateOpen() {
    var g = document.getElementById('login-gate');
    return !!g && g.style.display !== 'none';
  }
  function tickGate() {
    if (!wrap) return;
    if (gateOpen()) { hide(); return; }
    var g = document.getElementById('login-gate');
    var authed = false;
    try { authed = !!localStorage.getItem('wa_auth_v1'); } catch (e) {}
    if (!g || authed || document.body.classList.contains('hud-active')) show();
  }

  function startTimers() {
    if (timers.length) return;
    scheduleMis();
    timers.push(setInterval(mischiefTick, 30000));
    timers.push(setInterval(idleTick, 45000));
    timers.push(setInterval(microTick, 25000));
    timers.push(setInterval(tickGate, 900));
    timers.push(setInterval(envTick, 60000));
  }
  function stopTimers() {
    for (var i = 0; i < timers.length; i++) clearInterval(timers[i]);
    timers = [];
  }

  function init() {
    if (!document.body || document.getElementById('term13')) return;
    S = load();
    build();
    tickGate();
    paintEnv();
    routeTick(false);
    bindPanel();

    var gate = document.getElementById('login-gate');
    if (gate && window.MutationObserver) {
      new MutationObserver(tickGate).observe(gate, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    if (window.MutationObserver) {
      new MutationObserver(function () {
        if (document.body.classList.contains('hud-active')) tickGate();
      }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    /* 主题变化：它会看见光变了 */
    lastTheme = themeName();
    if (window.MutationObserver) {
      new MutationObserver(function () {
        var t = themeName();
        if (t === lastTheme) return;
        lastTheme = t;
        if (!visible || !S || S.sleeping || isMuted() || document.hidden) return;
        setMood('alert', 3600);
        say(THEME_LINE[t] || '> 光变了。', 3600);
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
    startTimers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
