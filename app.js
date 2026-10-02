// Scene BGM — フリーBGMを場面から選んで連続再生する。
// 再生は YouTube IFrame Player API のみ。素材サイトのサーバーには実行時にアクセスしない。

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- 永続化 ----------
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('sbgm.' + key);
      return v == null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('sbgm.' + key, JSON.stringify(value)); } catch {}
  },
};

// ---------- アイコン ----------
const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4.5" height="16" rx="1.2"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.2"/></svg>',
  playLine: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>',
  pauseLine: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M19 20 9 12l10-8v16zM5 19V5"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="m5 4 10 8-10 8V4zM19 5v14"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
  repeat: '<svg viewBox="0 0 24 24"><path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>',
  addNext: '<svg viewBox="0 0 24 24"><path d="M3 6h12M3 12h12M3 18h8M18 15v6M15 18h6"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  auto: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M12 21V9M7 14l5-5 5 5M5 3h14"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
};

// ---------- 場面プリセット ----------
// tags / genres のいずれかに当たるか、サブタイトル・説明文に kw を含めば該当
const SCENES = [
  { name: '明るい・元気', c: ['#ff9a3c', '#ff5f6d'], tags: ['明るい', '元気', 'かわいい', '爽やか', '楽しい'], kw: ['明る', '元気', '楽し', 'ポップ'] },
  { name: 'ほのぼの日常', c: ['#5fc88f', '#2f9e8f'], tags: ['穏やか', 'カフェ', '故郷', '店内', '動物', '猫', '犬'], kw: ['ほのぼの', 'のんびり', '日常', 'ゆったり'] },
  { name: '切ない・感動', c: ['#6a8dff', '#8457d6'], tags: ['切ない', '悲しみ', '悲しい', '別れ', '寂しい', '回想', '夕日', '懐かしい'], kw: ['切な', '悲し', '感動', '泣'] },
  { name: '緊張・シリアス', c: ['#4b5563', '#1f2937'], tags: ['推理', '探偵', '悪の組織', '暗い', '苦悩'], kw: ['緊張', '緊迫', 'シリアス', '厳戒', '不安'] },
  { name: 'バトル・熱い', c: ['#ef4444', '#991b1b'], tags: ['戦闘曲', 'メタル', 'ラウド', 'アクション'], kw: ['バトル', '戦闘', '熱い', '激し'] },
  { name: '壮大・荘厳', c: ['#c9a227', '#7a5a12'], tags: ['壮大', '荘厳', '儀式', '城', 'フルオーケストラ'], genres: ['オーケストラ'] },
  { name: 'ホラー・不穏', c: ['#3f3f46', '#450a0a'], tags: ['ホラー', '不気味', '絶望'], kw: ['恐怖', '不穏', '怖'] },
  { name: '幻想・神秘', c: ['#22d3ee', '#6366f1'], tags: ['幻想的', '神秘的'], genres: ['ファンタジー'], kw: ['幻想', '神秘'] },
  { name: '癒し・作業用', c: ['#86c5a9', '#4b8f8c'], tags: ['リラックス'], genres: ['ヒーリング'], kw: ['癒', 'ヒーリング'] },
  { name: 'オシャレ・ジャズ', c: ['#d4a373', '#7f5539'], tags: ['オシャレ', 'ジャズ', 'カフェ'], kw: ['ジャズ', 'おしゃれ', 'オシャレ'] },
  { name: '和風', c: ['#e05d5d', '#7c2d12'], tags: ['和風'], kw: ['和風', '和楽器', '江戸', '侍', '忍'] },
  { name: 'サイバー・近未来', c: ['#06b6d4', '#7c3aed'], tags: ['未来', '宇宙'], genres: ['サイバー'] },
  { name: 'レトロゲーム', c: ['#84cc16', '#15803d'], tags: ['ピコピコ音'], genres: ['ファミコン風'] },
  { name: 'ロック', c: ['#f97316', '#1f2937'], genres: ['ネオロック'] },
  { name: 'ピアノ', c: ['#a78bfa', '#475569'], genres: ['ピアノ'] },
  { name: 'アコースティック', c: ['#eab308', '#a16207'], genres: ['アコースティック'] },
];

// 曲の性格を表さない汎用タグ。タグ一覧や類似度計算から外す
const GENERIC_TAGS = new Set(['ゲーム', 'アニメ', 'YouTube', 'rpg', '映画・ドラマ', '古い曲', 'midi', '演劇', 'ラジオ']);

// ---------- 状態 ----------
const state = {
  tracks: [],
  byId: new Map(),
  queue: store.get('queue', { items: [], orig: [], index: -1 }),
  favs: store.get('favs', []), // [{id, at}]
  history: store.get('history', []), // [{id, at}] 新しい順
  settings: Object.assign({ theme: 'auto', shuffle: true, repeat: 'all' }, store.get('settings', {})),
  filter: { q: '', genres: new Set(), tags: new Set() },
  tab: 'search',
  shown: 50,
  tagsOpen: false,
  playing: false,
};
const favSet = new Set(state.favs.map((f) => f.id));

const save = {
  queue: () => store.set('queue', state.queue),
  favs: () => store.set('favs', state.favs),
  history: () => store.set('history', state.history),
  settings: () => store.set('settings', state.settings),
};

const current = () => state.byId.get(state.queue.items[state.queue.index]);
const isFav = (id) => favSet.has(id);

// ---------- ユーティリティ ----------
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const fmtTime = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
function timeAgo(t) {
  const d = (Date.now() - t) / 1000;
  if (d < 60) return 'たった今';
  if (d < 3600) return `${Math.floor(d / 60)}分前`;
  if (d < 86400) return `${Math.floor(d / 3600)}時間前`;
  if (d < 86400 * 7) return `${Math.floor(d / 86400)}日前`;
  return new Date(t).toLocaleDateString('ja-JP');
}
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- 検索 ----------
function haystack(t) {
  return t._hay ??= [t.title, t.subtitle, t.genre, t.tags.join(' '), t.desc].join(' ').toLowerCase();
}
function matchScene(t, sc) {
  if (sc.genres?.includes(t.genre)) return true;
  if (sc.tags?.some((x) => t.tags.includes(x))) return true;
  const text = t.subtitle + ' ' + t.desc;
  return !!sc.kw?.some((k) => text.includes(k));
}
function filtered() {
  const { q, genres, tags } = state.filter;
  const words = q.toLowerCase().split(/[\s　]+/).filter(Boolean);
  return state.tracks.filter((t) =>
    (!genres.size || genres.has(t.genre)) &&
    (!tags.size || t.tags.some((x) => tags.has(x))) &&
    words.every((w) => haystack(t).includes(w)));
}
const hasFilter = () => state.filter.q.trim() || state.filter.genres.size || state.filter.tags.size;

function similarTo(t, n = 30) {
  const own = t.tags.filter((x) => !GENERIC_TAGS.has(x));
  return state.tracks
    .filter((o) => o.id !== t.id)
    .map((o) => ({ o, s: own.filter((x) => o.tags.includes(x)).length * 2 + (o.genre === t.genre ? 1 : 0) + Math.random() * 0.5 }))
    .filter((x) => x.s >= 1.5)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.o.id);
}

// ---------- キュー操作 ----------
function setQueue(ids, startId, { autoplay = true, label } = {}) {
  ids = ids.filter((id) => state.byId.has(id));
  if (!ids.length) return toast('再生できる曲がありません');
  let items = ids.slice();
  if (state.settings.shuffle) {
    const rest = shuffled(items.filter((id) => id !== startId));
    items = startId ? [startId, ...rest] : rest;
  }
  const index = startId ? Math.max(0, items.indexOf(startId)) : 0;
  state.queue = { items, orig: ids.slice(), index };
  save.queue();
  loadCurrent(autoplay);
  if (label) toast(`${label}：${items.length}曲`);
  render();
}
function jumpTo(index) {
  if (index < 0 || index >= state.queue.items.length) return;
  state.queue.index = index;
  save.queue();
  loadCurrent(true);
  render();
}
function playNow(id) {
  const q = state.queue;
  if (q.index < 0) return setQueue([id], id);
  q.items.splice(q.index + 1, 0, id);
  q.orig.push(id);
  jumpTo(q.index + 1);
}
function addNext(id) {
  const q = state.queue;
  if (q.index < 0) return setQueue([id], id, { autoplay: false });
  q.items.splice(q.index + 1, 0, id);
  q.orig.push(id);
  save.queue();
  toast('次に再生します');
  render();
}
function removeAt(i) {
  const q = state.queue;
  const [id] = q.items.splice(i, 1);
  const oi = q.orig.indexOf(id);
  if (oi >= 0) q.orig.splice(oi, 1);
  if (i < q.index) q.index--;
  else if (i === q.index) {
    if (q.index >= q.items.length) q.index = q.items.length - 1;
    loadCurrent(state.playing);
  }
  save.queue();
  render();
}
function moveUp(i) {
  const q = state.queue;
  if (i <= 0) return;
  [q.items[i - 1], q.items[i]] = [q.items[i], q.items[i - 1]];
  if (q.index === i) q.index--;
  else if (q.index === i - 1) q.index++;
  save.queue();
  render();
}
function next(auto = false) {
  const q = state.queue;
  if (!q.items.length) return;
  if (q.index < q.items.length - 1) q.index++;
  else if (state.settings.repeat === 'all' || !auto) q.index = 0;
  else { state.playing = false; renderPlayer(); return; }
  save.queue();
  loadCurrent(true);
  render();
}
function prev() {
  const q = state.queue;
  if (!q.items.length) return;
  if (yt.time() > 3) return yt.seek(0);
  q.index = q.index > 0 ? q.index - 1 : q.items.length - 1;
  save.queue();
  loadCurrent(true);
  render();
}
function toggleShuffle() {
  const s = state.settings;
  s.shuffle = !s.shuffle;
  save.settings();
  const q = state.queue;
  const cur = q.items[q.index];
  if (cur) {
    if (s.shuffle) {
      // 現在曲以降だけを混ぜる
      q.items = [...q.items.slice(0, q.index + 1), ...shuffled(q.items.slice(q.index + 1))];
    } else {
      q.items = q.orig.slice();
      q.index = Math.max(0, q.items.indexOf(cur));
    }
    save.queue();
  }
  toast(s.shuffle ? 'シャッフル：オン' : 'シャッフル：オフ');
  render();
}
function cycleRepeat() {
  const order = ['all', 'one', 'off'];
  const s = state.settings;
  s.repeat = order[(order.indexOf(s.repeat) + 1) % order.length];
  save.settings();
  // 1曲リピートに切り替えたとき、enqueue済みの次曲をクリアするため現在曲を再cue
  if (s.repeat === 'one' && yt.ready && current()) loadCurrent(state.playing);
  toast({ all: 'リピート：全曲', one: 'リピート：1曲', off: 'リピート：オフ' }[s.repeat]);
  renderPlayer();
}

// ---------- お気に入り・履歴 ----------
function toggleFav(id) {
  if (!id) return;
  if (favSet.has(id)) {
    favSet.delete(id);
    state.favs = state.favs.filter((f) => f.id !== id);
    toast('お気に入りから外しました');
  } else {
    favSet.add(id);
    state.favs.unshift({ id, at: Date.now() });
    toast('★ お気に入りに追加');
  }
  save.favs();
  render();
}
function pushHistory(id) {
  const h = state.history;
  if (h[0]?.id === id) return;
  h.unshift({ id, at: Date.now() });
  if (h.length > 300) h.length = 300;
  save.history();
  if (state.tab === 'history') renderView();
}

// ---------- YouTube プレイヤー ----------
const yt = {
  player: null,
  ready: false,
  loadedId: null,
  logged: false,
  errors: 0,
  time() { try { return this.player?.getCurrentTime?.() || 0; } catch { return 0; } },
  duration() { try { return this.player?.getDuration?.() || 0; } catch { return 0; } },
  seek(s) { this.player?.seekTo?.(s, true); },
  play() { this.player?.playVideo?.(); },
  pause() { this.player?.pauseVideo?.(); },
};

function loadCurrent(autoplay) {
  const t = current();
  renderPlayer();
  if (!t || !yt.ready) return;
  yt.loadedId = t.id;
  yt.logged = false;
  if (autoplay) yt.player.loadVideoById({ videoId: t.yt });
  else yt.player.cueVideoById({ videoId: t.yt, startSeconds: store.get('pos', 0) });
  syncUpcoming();
}

// PiP生存対策：次曲をプレイヤー内部プレイリストにenqueueし、曲遷移をプレイヤー内部完結させる
// （loadVideoByIdでの差し替えはvideo要素が作り直されiOSではPiPが切れる）
const ENQUEUE_BUFFER = 10;
function upcomingTracks(n) {
  const q = state.queue;
  const out = [];
  const wrap = state.settings.repeat === 'all';
  for (let step = 1; step <= Math.min(n, q.items.length - 1); step++) {
    let i = q.index + step;
    if (i >= q.items.length) {
      if (!wrap) break;
      i -= q.items.length;
    }
    const t = state.byId.get(q.items[i]);
    if (t) out.push(t);
  }
  return out;
}
function syncUpcoming() {
  if (!yt.ready || !current() || state.settings.repeat === 'one') return;
  let have = 0;
  try {
    const pl = yt.player.getPlaylist?.() || [];
    have = pl.length - (yt.player.getPlaylistIndex?.() ?? 0) - 1;
  } catch {}
  for (const t of upcomingTracks(ENQUEUE_BUFFER - Math.max(0, have))) yt.player.enqueueVideo?.(t.yt);
}
function playingVideoId() {
  try {
    const m = (yt.player.getVideoUrl?.() || '').match(/[?&]v=([\w-]+)/);
    if (m) return m[1];
    const id = yt.player.getPlaylist?.()?.[yt.player.getPlaylistIndex?.()];
    if (id) return id;
  } catch {}
  return null;
}
function handleEnded() {
  const q = state.queue;
  if (state.settings.repeat === 'one') { yt.seek(0); yt.play(); return; }
  let nextIdx = q.index + 1;
  if (nextIdx >= q.items.length) nextIdx = state.settings.repeat === 'all' ? 0 : -1;
  const nt = nextIdx >= 0 ? state.byId.get(q.items[nextIdx]) : null;
  if (!nt) { state.playing = false; renderPlayer(); return; }
  if (nt.yt === current()?.yt) { yt.seek(0); yt.play(); return; }
  if (playingVideoId() === nt.yt) {
    // プレイヤーが内部で既に次曲へ進んでいる。再読み込みせず位置だけ同期してPiPを保つ
    q.index = nextIdx;
    save.queue();
    yt.logged = false;
    syncUpcoming();
    render();
  } else {
    q.index = nextIdx;
    save.queue();
    loadCurrent(true);
    render();
  }
}

function initYouTube() {
  window.onYouTubeIframeAPIReady = () => {
    yt.player = new YT.Player('yt', {
      host: 'https://www.youtube-nocookie.com',
      playerVars: { playsinline: 1, rel: 0, iv_load_policy: 3, ...(location.origin.startsWith('http') ? { origin: location.origin } : {}) },
      events: {
        onReady: () => {
          yt.ready = true;
          if (current()) loadCurrent(false);
        },
        onStateChange: (e) => {
          const S = YT.PlayerState;
          if (e.data === S.PLAYING) {
            state.playing = true;
            yt.errors = 0;
            const t = current();
            if (t && !yt.logged) { yt.logged = true; pushHistory(t.id); }
          } else if (e.data === S.PAUSED) {
            state.playing = false;
          } else if (e.data === S.ENDED) {
            handleEnded();
            return;
          }
          renderPlayer();
        },
        onError: () => {
          // 埋め込み不可・削除済みなどはスキップ。全曲失敗なら止める
          yt.errors++;
          if (yt.errors >= Math.min(state.queue.items.length, 10)) {
            state.playing = false;
            renderPlayer();
            return toast('再生できる動画が見つかりませんでした');
          }
          toast('再生できない動画のためスキップします');
          setTimeout(() => next(true), 600);
        },
      },
    });
  };
  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  document.head.append(s);
}

// 再生位置の表示と保存
let seeking = false;
let playerVisible = true;
let lastSave = 0;
setInterval(() => {
  if (!yt.ready || !current()) return;
  const t = yt.time();
  const d = yt.duration();
  if (!seeking) {
    $('#seek').value = d ? Math.round((t / d) * 1000) : 0;
    $('#tCur').textContent = fmtTime(t);
    $('#tDur').textContent = fmtTime(d);
  }
  if (state.playing && Date.now() - lastSave > 5000) {
    lastSave = Date.now();
    store.set('pos', Math.floor(t));
  }
}, 500);

// ---------- 描画 ----------
function trackRow(t, { idx, mode = 'list', current: cur = false, meta } = {}) {
  const tags = t.tags.filter((x) => !GENERIC_TAGS.has(x)).slice(0, 3).join('・');
  const right = mode === 'queue'
    ? `<button class="icon-btn" data-action="up" data-idx="${idx}" aria-label="上へ" ${idx === 0 ? 'disabled' : ''}>${ICON.up}</button>
       <button class="icon-btn" data-action="remove" data-idx="${idx}" aria-label="キューから外す">${ICON.x}</button>`
    : `<button class="icon-btn" data-action="addnext" data-id="${t.id}" aria-label="次に再生">${ICON.addNext}</button>`;
  return `<li class="row ${cur ? 'is-current' : ''}" data-action="${mode === 'queue' ? 'jump' : 'row'}" data-id="${t.id}" data-idx="${idx}">
    ${mode === 'queue' ? `<span class="num">${cur ? '▶' : idx + 1}</span>` : ''}
    <div class="row-main">
      <div class="row-title">${esc(t.title)}${t.subtitle ? `<span class="sub">${esc(t.subtitle)}</span>` : ''}</div>
      <div class="row-meta">${esc(meta ?? [t.genre, tags].filter(Boolean).join(' · '))}</div>
    </div>
    <button class="icon-btn fav ${isFav(t.id) ? 'on' : ''}" data-action="fav" data-id="${t.id}" aria-label="お気に入り">${ICON.star}</button>
    ${right}
  </li>`;
}

function renderPlayer() {
  const t = current();
  $('.video').classList.toggle('has-track', !!t);
  $('#nowTitle').textContent = t ? t.title : '—';
  $('#nowSub').textContent = t ? [t.subtitle, t.genre].filter(Boolean).join(' · ') : 'まだ再生していません';
  $('#nowTags').innerHTML = t
    ? t.tags.filter((x) => !GENERIC_TAGS.has(x)).map((x) => `<button class="chip" data-tag="${esc(x)}">#${esc(x)}</button>`).join('')
    : '';
  const fav = t && isFav(t.id);
  for (const el of [$('#nowFav'), $('#miniFav')]) {
    el.innerHTML = ICON.star;
    el.classList.toggle('on', !!fav);
    el.disabled = !t;
  }
  $('#playBtn').innerHTML = state.playing ? ICON.pause : ICON.play;
  $('#miniPlay').innerHTML = state.playing ? ICON.pauseLine : ICON.playLine;
  $('#shuffleBtn').classList.toggle('on', state.settings.shuffle);
  $('#repeatBtn').classList.toggle('on', state.settings.repeat !== 'off');
  $('#repeatBtn').classList.toggle('repeat-one', state.settings.repeat === 'one');
  $('#similarBtn').disabled = !t;
  const credit = $('#credit');
  if (t) {
    credit.href = `https://maou.audio/${t.id}/`;
    credit.textContent = '魔王魂で曲ページを開く ↗';
  } else {
    credit.removeAttribute('href');
    credit.textContent = '';
  }
  $('#mini').hidden = playerVisible || !t;
  $('#miniText').innerHTML = t ? `<b>${esc(t.title)}</b><span>${esc(t.subtitle || t.genre)}</span>` : '';
  if (!t) {
    $('#tCur').textContent = '0:00';
    $('#tDur').textContent = '0:00';
    $('#seek').value = 0;
  }
  document.title = t ? `${t.title} — Scene BGM` : 'Scene BGM';
}

function renderTabs() {
  const counts = { queue: state.queue.items.length, favs: state.favs.length };
  for (const b of document.querySelectorAll('.tabs button')) {
    const tab = b.dataset.tab;
    b.setAttribute('aria-selected', String(tab === state.tab));
    const label = { search: 'さがす', queue: 'キュー', history: '履歴', favs: 'お気に入り' }[tab];
    b.innerHTML = label + (counts[tab] ? `<span class="count">${counts[tab]}</span>` : '');
  }
}

function sceneCount(sc) {
  return sc._n ??= state.tracks.filter((t) => matchScene(t, sc)).length;
}

function renderSearch() {
  const f = state.filter;
  const genres = [...new Set(state.tracks.map((t) => t.genre))];
  const tagCount = new Map();
  for (const t of state.tracks) for (const x of t.tags) if (!GENERIC_TAGS.has(x)) tagCount.set(x, (tagCount.get(x) || 0) + 1);
  const tags = [...tagCount].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
  const active = hasFilter();
  const res = active ? filtered() : [];

  return `
    <div class="searchbox">${ICON.search}<input id="q" type="search" placeholder="曲名・雰囲気・場面で検索（例：雨 ピアノ）" value="${esc(f.q)}" enterkeyhint="search"></div>
    ${active ? `
      <div class="result-bar">
        <span class="n">${res.length}曲</span>
        <button class="pill primary" data-action="play-results">${ICON.playLine}この${res.length}曲を再生</button>
        <button class="pill ghost" data-action="clear-filter">${ICON.x}条件をクリア</button>
      </div>` : ''}
    ${!active ? `
      <div class="section">
        <div class="section-head"><h2>場面からすぐ再生</h2></div>
        <div class="scenes">
          ${SCENES.map((sc, i) => sceneCount(sc) >= 3 ? `
            <button class="scene" data-action="scene" data-idx="${i}" style="--c1:${sc.c[0]};--c2:${sc.c[1]}">
              <b>${esc(sc.name)}</b><span>${sceneCount(sc)}曲</span>${ICON.play}
            </button>` : '').join('')}
        </div>
      </div>` : ''}
    <div class="section">
      <div class="section-head"><h2>ジャンル</h2></div>
      <div class="chips">${genres.map((g) => `<button class="chip ${f.genres.has(g) ? 'on' : ''}" data-action="genre" data-v="${esc(g)}">${esc(g)}</button>`).join('')}</div>
    </div>
    <div class="section">
      <div class="section-head"><h2>雰囲気・用途タグ</h2>
        <button class="link" data-action="toggle-tags">${state.tagsOpen ? '閉じる' : 'すべて表示'}</button></div>
      <div class="chips ${state.tagsOpen ? '' : 'collapsed'}">${tags.map(([x, n]) => `<button class="chip ${f.tags.has(x) ? 'on' : ''}" data-action="tag" data-v="${esc(x)}">${esc(x)}<small>${n}</small></button>`).join('')}</div>
    </div>
    ${active ? `
      <ul class="list" data-list="results">${res.slice(0, state.shown).map((t, i) => trackRow(t, { idx: i, current: t.id === current()?.id })).join('') || ''}</ul>
      ${res.length === 0 ? '<p class="empty">条件に合う曲がありません</p>' : ''}
      ${res.length > state.shown ? `<button class="pill more" data-action="more">さらに表示（残り${res.length - state.shown}曲）</button>` : ''}` : ''}
  `;
}

function renderQueue() {
  const q = state.queue;
  if (!q.items.length) return '<p class="empty">キューは空です。「さがす」から場面を選んでください。</p>';
  return `
    <div class="toolbar">
      <span class="muted">${q.index + 1} / ${q.items.length}曲</span>
      <span class="spacer"></span>
      <button class="pill ghost" data-action="clear-queue">${ICON.x}クリア</button>
    </div>
    <ul class="list">${q.items.map((id, i) => {
      const t = state.byId.get(id);
      return t ? trackRow(t, { idx: i, mode: 'queue', current: i === q.index }) : '';
    }).join('')}</ul>`;
}

function renderHistory() {
  const h = state.history.filter((x) => state.byId.has(x.id));
  if (!h.length) return '<p class="empty">再生した曲がここに残ります。あとから★を付けられます。</p>';
  return `
    <div class="toolbar">
      <span class="muted">最近再生した曲（${h.length}）</span>
      <span class="spacer"></span>
      <button class="pill ghost" data-action="clear-history">${ICON.x}履歴を消す</button>
    </div>
    <ul class="list">${h.map((x, i) => {
      const t = state.byId.get(x.id);
      return trackRow(t, { idx: i, current: i === 0 && t.id === current()?.id && state.playing, meta: `${timeAgo(x.at)} · ${t.genre}` });
    }).join('')}</ul>`;
}

function renderFavs() {
  const favs = state.favs.filter((f) => state.byId.has(f.id));
  return `
    <div class="toolbar">
      ${favs.length ? `<button class="pill primary" data-action="play-favs">${ICON.playLine}お気に入りを再生</button>` : ''}
      <span class="spacer"></span>
      <button class="pill ghost" data-action="export">${ICON.download}書き出し</button>
      <button class="pill ghost" data-action="copy">${ICON.copy}コピー</button>
      <button class="pill ghost" data-action="import">${ICON.upload}読み込み</button>
    </div>
    <p class="hint">お気に入りはこの端末のブラウザに保存されます。別の端末へは「書き出し」→「読み込み」で移せます。</p>
    ${favs.length
      ? `<ul class="list">${favs.map((f, i) => {
          const t = state.byId.get(f.id);
          return trackRow(t, { idx: i, current: t.id === current()?.id, meta: `${timeAgo(f.at)}に追加 · ${t.genre}` });
        }).join('')}</ul>`
      : '<p class="empty">★を付けた曲がここに並びます。</p>'}`;
}

function renderView() {
  const v = $('#view');
  const focused = document.activeElement?.id === 'q';
  const caret = focused ? document.activeElement.selectionStart : null;
  v.innerHTML = { search: renderSearch, queue: renderQueue, history: renderHistory, favs: renderFavs }[state.tab]();
  if (focused) {
    const q = $('#q');
    q.focus();
    q.setSelectionRange(caret, caret);
  }
}

function render() {
  renderPlayer();
  renderTabs();
  renderView();
}

function renderTheme() {
  const t = state.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  $('#themeBtn').innerHTML = { auto: ICON.auto, light: ICON.sun, dark: ICON.moon }[t];
  $('#themeBtn').title = { auto: 'テーマ：端末に合わせる', light: 'テーマ：ライト', dark: 'テーマ：ダーク' }[t];
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]').content = dark ? '#0f1115' : '#f6f5f2';
}

// ---------- お気に入りの書き出し・読み込み ----------
function exportJson() {
  return JSON.stringify({ app: 'scene-bgm', v: 1, exportedAt: new Date().toISOString(), favs: state.favs }, null, 1);
}
function importJson(text) {
  let data;
  try { data = JSON.parse(text); } catch { return toast('JSONを読み取れませんでした'); }
  const list = Array.isArray(data) ? data : data.favs;
  if (!Array.isArray(list)) return toast('お気に入りのデータが見つかりません');
  let added = 0;
  for (const f of list) {
    const id = typeof f === 'string' ? f : f?.id;
    if (!id || favSet.has(id)) continue;
    favSet.add(id);
    state.favs.push({ id, at: typeof f === 'object' && f.at ? f.at : Date.now() });
    added++;
  }
  state.favs.sort((a, b) => b.at - a.at);
  save.favs();
  toast(`${added}曲を追加しました`);
  render();
}

// ---------- イベント ----------
function bind() {
  $('#prevBtn').innerHTML = ICON.prev;
  $('#nextBtn').innerHTML = ICON.next;
  $('#miniNext').innerHTML = ICON.next;
  $('#shuffleBtn').innerHTML = ICON.shuffle;
  $('#repeatBtn').innerHTML = ICON.repeat;
  $('#playBtn').onclick = $('#miniPlay').onclick = () => {
    if (!current()) {
      const sc = SCENES[Math.floor(Math.random() * SCENES.length)];
      return setQueue(state.tracks.filter((t) => matchScene(t, sc)).map((t) => t.id), null, { label: sc.name });
    }
    if (!yt.ready) return;
    if (state.playing) yt.pause();
    else if (yt.loadedId !== current().id) loadCurrent(true);
    else yt.play();
  };
  $('#nextBtn').onclick = $('#miniNext').onclick = () => next();
  $('#prevBtn').onclick = prev;
  $('#shuffleBtn').onclick = toggleShuffle;
  $('#repeatBtn').onclick = cycleRepeat;
  $('#nowFav').onclick = $('#miniFav').onclick = () => toggleFav(current()?.id);
  $('#miniText').onclick = () => $('#player').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#similarBtn').onclick = () => {
    const t = current();
    if (!t) return;
    const ids = similarTo(t);
    const q = state.queue;
    q.items = [...q.items.slice(0, q.index + 1), ...(state.settings.shuffle ? shuffled(ids) : ids)];
    q.orig = q.items.slice();
    save.queue();
    toast(`似た曲を${ids.length}曲、次から流します`);
    render();
  };
  $('#nowTags').onclick = (e) => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    state.filter = { q: '', genres: new Set(), tags: new Set([b.dataset.tag]) };
    state.tab = 'search';
    state.shown = 50;
    render();
    $('.tabs').scrollIntoView({ behavior: 'smooth' });
  };
  $('#themeBtn').onclick = () => {
    const order = ['auto', 'light', 'dark'];
    state.settings.theme = order[(order.indexOf(state.settings.theme) + 1) % 3];
    save.settings();
    renderTheme();
  };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderTheme);

  const seek = $('#seek');
  seek.addEventListener('input', () => {
    seeking = true;
    $('#tCur').textContent = fmtTime((seek.value / 1000) * yt.duration());
  });
  seek.addEventListener('change', () => {
    yt.seek((seek.value / 1000) * yt.duration());
    seeking = false;
  });

  $('.tabs').onclick = (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    state.tab = b.dataset.tab;
    renderTabs();
    renderView();
  };

  let qTimer;
  $('#view').addEventListener('input', (e) => {
    if (e.target.id !== 'q') return;
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      state.filter.q = e.target.value;
      state.shown = 50;
      renderView();
    }, 200);
  });

  $('#view').addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id, v } = el.dataset;
    const idx = +el.dataset.idx;
    const f = state.filter;
    switch (action) {
      case 'scene': {
        const sc = SCENES[idx];
        setQueue(state.tracks.filter((t) => matchScene(t, sc)).map((t) => t.id), null, { label: sc.name });
        break;
      }
      case 'genre':
      case 'tag': {
        const set = action === 'genre' ? f.genres : f.tags;
        set.has(v) ? set.delete(v) : set.add(v);
        state.shown = 50;
        renderView();
        break;
      }
      case 'toggle-tags': state.tagsOpen = !state.tagsOpen; renderView(); break;
      case 'clear-filter': state.filter = { q: '', genres: new Set(), tags: new Set() }; renderView(); break;
      case 'more': state.shown += 50; renderView(); break;
      case 'play-results': setQueue(filtered().map((t) => t.id), null, { label: '検索結果' }); break;
      case 'row': {
        const list = el.closest('[data-list]')?.dataset.list;
        if (list === 'results') setQueue(filtered().map((t) => t.id), id);
        else playNow(id);
        break;
      }
      case 'jump': jumpTo(idx); break;
      case 'fav': toggleFav(id); break;
      case 'addnext': addNext(id); break;
      case 'up': moveUp(idx); break;
      case 'remove': removeAt(idx); break;
      case 'clear-queue':
        if (confirm('キューを空にしますか？')) {
          yt.pause();
          state.queue = { items: [], orig: [], index: -1 };
          state.playing = false;
          save.queue();
          render();
        }
        break;
      case 'clear-history':
        if (confirm('再生履歴を消しますか？（お気に入りは残ります）')) {
          state.history = [];
          save.history();
          renderView();
        }
        break;
      case 'play-favs': setQueue(state.favs.map((x) => x.id), null, { label: 'お気に入り' }); break;
      case 'export': {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }));
        a.download = `scene-bgm-favorites-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        break;
      }
      case 'copy':
        navigator.clipboard?.writeText(exportJson()).then(() => toast('クリップボードにコピーしました'), () => toast('コピーできませんでした'));
        break;
      case 'import': $('#importDlg').showModal(); break;
    }
  });

  $('#importFile').onchange = async (e) => {
    const file = e.target.files[0];
    if (file) $('#importText').value = await file.text();
  };
  $('#importDlg').addEventListener('close', () => {
    const dlg = $('#importDlg');
    if (dlg.returnValue === 'ok' && $('#importText').value.trim()) importJson($('#importText').value);
    $('#importText').value = '';
    $('#importFile').value = '';
  });

  // プレイヤーが画面外に出たらミニプレイヤーを表示
  new IntersectionObserver(([entry]) => {
    playerVisible = entry.isIntersecting;
    $('#mini').hidden = playerVisible || !current();
  }, { threshold: 0.15 }).observe($('#player'));
}

// ---------- 起動 ----------
async function main() {
  renderTheme();
  bind();
  try {
    const res = await fetch('data/maou.json');
    const data = await res.json();
    // 現段階では YouTube 動画のある曲のみ扱う
    state.tracks = data.tracks.filter((t) => t.yt);
  } catch {
    $('#view').innerHTML = '<p class="empty">曲データを読み込めませんでした</p>';
    return;
  }
  for (const t of state.tracks) state.byId.set(t.id, t);
  const q = state.queue;
  q.items = q.items.filter((id) => state.byId.has(id));
  q.orig = (q.orig || q.items).filter((id) => state.byId.has(id));
  if (q.index >= q.items.length) q.index = q.items.length - 1;
  render();
  initYouTube();
}
main();
