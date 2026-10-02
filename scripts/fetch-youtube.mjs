// 素材サイト公式YouTubeチャンネルの投稿から曲情報を作り、data/<key>.json に書き出す。
// 素材サイト本体のサーバーにはアクセスしない（YouTube Data API v3 のみ）。
//
// 使い方:
//   YOUTUBE_API_KEY=... node scripts/fetch-youtube.mjs        全件取得（GitHub Actions で週1回実行）
//   node scripts/fetch-youtube.mjs --rss                      APIキーなしで最新15件だけ取得（解析の確認用）
//
// YouTube API ポリシーにより取得データは30日以内に更新・削除が必要なため、毎回全件を取り直して置き換える。
import { readFile, writeFile } from 'node:fs/promises';

const API = 'https://www.googleapis.com/youtube/v3';
const KEY = process.env.YOUTUBE_API_KEY;
const RSS = process.argv.includes('--rss');
const MIN_SECONDS = 30; // ジングル等の短すぎる動画は除外

const dataUrl = (name) => new URL(`../data/${name}`, import.meta.url);

async function api(path, params) {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries({ ...params, key: KEY })) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${path}: ${await res.text()}`);
  return res.json();
}

// アップロード動画の一覧（uploads プレイリスト）を全件取得
async function listUploads(channelId) {
  const playlistId = 'UU' + channelId.slice(2);
  const ids = [];
  let pageToken;
  do {
    const r = await api('playlistItems', { part: 'contentDetails', playlistId, maxResults: 50, ...(pageToken ? { pageToken } : {}) });
    ids.push(...r.items.map((x) => x.contentDetails.videoId));
    pageToken = r.nextPageToken;
  } while (pageToken);
  return ids;
}

// 動画詳細（タイトル・説明・長さ・埋め込み可否）を50件ずつ取得
async function videoDetails(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await api('videos', { part: 'snippet,contentDetails,status', id: ids.slice(i, i + 50).join(','), maxResults: 50 });
    for (const v of r.items) {
      out.push({
        yt: v.id,
        title: v.snippet.title,
        description: v.snippet.description,
        publishedAt: v.snippet.publishedAt,
        seconds: isoSeconds(v.contentDetails.duration),
        embeddable: v.status.embeddable && v.status.privacyStatus === 'public',
      });
    }
  }
  return out;
}

const isoSeconds = (d) => {
  const m = d?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
};

// APIキーなしの確認用：RSSフィード（最新15件）
async function fromRss(channelId) {
  const xml = await (await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`)).text();
  const unxml = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return xml.split('<entry>').slice(1).map((e) => ({
    yt: e.match(/<yt:videoId>(.*?)</)[1],
    title: unxml(e.match(/<title>(.*?)<\/title>/)[1]),
    description: unxml(e.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] ?? ''),
    publishedAt: e.match(/<published>(.*?)</)[1],
    seconds: null, // RSSには長さがない
    embeddable: true,
  }));
}

// ---------- サイト別の解析 ----------
const GENRES = ['ロック', 'メタル', 'ポップ', 'ジャズ', 'クラシック', 'オーケストラ', 'アコースティック', 'アンビエント', 'ヒーリング',
  'EDM', 'テクノ', 'ハウス', 'ヒップホップ', 'ファンク', 'ボサノバ', 'ラテン', '和風', '中華風', 'ケルト', '民族音楽', 'エスニック',
  'チップチューン', '8bit', 'エレクトロニカ', 'Lo-Fi', 'ローファイ', 'ワルツ', 'マーチ', 'ブルース', 'カントリー', 'フォーク', 'デジタル', 'サイバー'];
const TEMPOS = ['遅い', 'ゆっくり', '普通の速さ', '軽快', '速い', '一部速い', '鈍重'];

const PARSERS = {
  opentracks(v) {
    const d = v.description;
    const detail = d.match(/opentracks\.com\/bgm\/detail\/(\d+)(?:\/track\/(\d+))?/);
    if (!detail) return null; // 楽曲以外の動画（告知など）
    const name = d.match(/フリーBGM「(.+?)」/)?.[1] ?? v.title.split('｜')[0].trim();
    const variant = v.title.split('｜')[0].match(/#(\d+)\s*$/)?.[1];
    const composer = d.match(/作（編）曲\s*[：:]\s*(.+)/)?.[1]?.trim() ?? '';
    const kwLine = d.match(/キーワード\s*=\s*\n(.+)/)?.[1] ?? '';
    // 半角カナ等を全角に揃える（ｱｺｰｽﾃｨｯｸ → アコースティック）
    const tags = [...new Set(kwLine.normalize('NFKC').split(',').map((s) => s.trim()).filter(Boolean))];
    const track = detail[2] ? +detail[2] : 1;
    return {
      id: `ot_${detail[1]}${track > 1 ? `_${track}` : ''}`,
      group: `ot_${detail[1]}`,
      title: name,
      subtitle: variant ? `#${variant}` : '',
      composer,
      genre: GENRES.find((g) => tags.includes(g)) ?? 'その他',
      tempo: TEMPOS.find((x) => tags.includes(x)) ?? '',
      tags,
      url: `https://opentracks.com/bgm/detail/${detail[1]}${detail[2] ? `/track/${detail[2]}` : ''}`,
    };
  },
};

// ---------- 実行 ----------
if (!RSS && !KEY) {
  console.error('YOUTUBE_API_KEY が未設定です（確認だけなら --rss）');
  process.exit(1);
}
const sources = JSON.parse(await readFile(dataUrl('sources.json'), 'utf8'));
for (const src of sources) {
  const videos = RSS ? await fromRss(src.channelId) : await videoDetails(await listUploads(src.channelId));
  const parse = PARSERS[src.parser];
  const tracks = [];
  let skipped = 0;
  for (const v of videos) {
    const t = v.embeddable && (v.seconds == null || v.seconds >= MIN_SECONDS) ? parse(v) : null;
    if (!t) { skipped++; continue; }
    tracks.push({ ...t, src: src.key, yt: v.yt, seconds: v.seconds, publishedAt: v.publishedAt });
  }
  // 同じ曲の別バージョンのうち、番号なし（または最小番号）を代表にする
  const byGroup = new Map();
  for (const t of tracks) {
    const g = byGroup.get(t.group);
    if (!g || t.id.length < g.id.length) byGroup.set(t.group, t);
  }
  for (const t of tracks) t.primary = byGroup.get(t.group) === t;
  tracks.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const out = { source: src.name, site: src.site, builtAt: new Date().toISOString(), partial: RSS, tracks };
  await writeFile(dataUrl(`${src.key}.json`), JSON.stringify(out));
  console.log(`${src.key}: ${tracks.length}曲（代表 ${byGroup.size}曲）, 除外 ${skipped}件${RSS ? ' [RSS:最新分のみ]' : ''}`);
}
