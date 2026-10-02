// 魔王魂の曲一覧ページから曲情報を集めて data/maou.json に書き出す。
// サーバー負荷を避けるため、1リクエストごとに待機する。
// 使い方: node scripts/build-catalog.mjs
import { writeFile, mkdir } from 'node:fs/promises';

const BASE = 'https://maou.audio';
const WAIT_MS = 1500;
const UA = 'Mozilla/5.0 (personal BGM player catalog builder)';

// 収集対象のサブカテゴリ → 表示用ジャンル名
const CATEGORIES = {
  'bgm/bgm-neorock': 'ネオロック',
  'bgm/bgm-acoustic': 'アコースティック',
  'bgm/bgm-piano': 'ピアノ',
  'bgm/bgm-orchestra': 'オーケストラ',
  'bgm/bgm-cyber': 'サイバー',
  'bgm/bgm-ethnic': '民族音楽',
  'bgm/bgm-healing': 'ヒーリング',
  'bgm/bgm-fantasy': 'ファンタジー',
  'bgm/bgm-8bit': 'ファミコン風',
  'game/game-battle': 'ゲーム:戦闘',
  'game/game-dangeon': 'ゲーム:ダンジョン',
  'game/game-event': 'ゲーム:イベント',
  'game/game-field': 'ゲーム:フィールド',
  'game/game-town': 'ゲーム:町',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ')
    .trim();

function parsePage(html, genre) {
  const blocks = html.split('<div class="sound">').slice(1);
  const tracks = [];
  for (const b of blocks) {
    const link = b.match(/<h2 class='icon'><a href="https:\/\/maou\.audio\/([^/"]+)\/">([^<]*)<\/a>/);
    const mp3 = b.match(/href="(https:\/\/maou\.audio\/sound\/[^"]+?\.mp3)"/);
    if (!link || !mp3) continue;
    const sub = b.match(/<div class="title-subtitle">([\s\S]*?)<\/div>/);
    const desc = b.match(/<div class="sonog-text">([\s\S]*?)<\/div>/);
    const yt = b.match(/youtube\.com\/embed\/([\w-]{11})/);
    const tagList = b.match(/<div class="tag_list">([\s\S]*?)<\/div>/);
    const tags = tagList ? [...tagList[1].matchAll(/rel="tag">([^<]+)</g)].map((m) => decode(m[1])) : [];
    tracks.push({
      id: link[1],
      title: decode(link[2]),
      subtitle: sub ? decode(sub[1]).replace(/^サブタイトル：/, '') : '',
      genre,
      tags,
      desc: desc ? decode(desc[1]) : '',
      src: mp3[1],
      yt: yt ? yt[1] : null,
      loop: b.includes('ループ対応'),
    });
  }
  const last = html.match(/class="last"[^>]*href="[^"]*\/page\/(\d+)\/"/);
  const pages = html.match(/<span class='pages'>\d+\/(\d+)<\/span>/);
  return { tracks, totalPages: pages ? +pages[1] : last ? +last[1] : 1 };
}

const all = new Map();
for (const [path, genre] of Object.entries(CATEGORIES)) {
  let page = 1;
  let total = 1;
  do {
    const url = `${BASE}/category/${path}/${page > 1 ? `page/${page}/` : ''}`;
    const html = await get(url);
    const { tracks, totalPages } = parsePage(html, genre);
    total = totalPages;
    for (const t of tracks) {
      const prev = all.get(t.id);
      if (prev) prev.tags = [...new Set([...prev.tags, ...t.tags])];
      else all.set(t.id, t);
    }
    console.log(`${genre} p${page}/${total}: +${tracks.length} (計${all.size})`);
    page++;
    await sleep(WAIT_MS);
  } while (page <= total);
}

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
const out = {
  source: '魔王魂 (https://maou.audio/)',
  builtAt: new Date().toISOString(),
  tracks: [...all.values()],
};
await writeFile(new URL('../data/maou.json', import.meta.url), JSON.stringify(out));
console.log(`done: ${out.tracks.length} tracks`);
