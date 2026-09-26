export const DEFAULT_PRIVATE_SLUG = 'drks-wqrgmrlzucjg5eg';

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow, noarchive',
    },
  });
}

export function allowed(request, env) {
  const expected = String(env.PRIVATE_SLUG || DEFAULT_PRIVATE_SLUG).trim().replace(/^\/+|\/+$/g, '') || DEFAULT_PRIVATE_SLUG;
  return request.headers.get('X-DRKS-Access') === expected;
}

export function cleanSources(payload) {
  const sources = Array.isArray(payload?.sources) ? payload.sources : [];
  return sources.slice(0, 50).filter(x => x && typeof x === 'object').map(src => ({
    memberId: String(src.memberId || '').slice(0, 64),
    name: String(src.name || '').slice(0, 120),
    roman: String(src.roman || '').slice(0, 64),
    youtube: String(src.youtube || '').trim().slice(0, 120),
    twitch: String(src.twitch || '').trim().slice(0, 80),
    kick: String(src.kick || '').trim().slice(0, 80),
  }));
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchText(url, init = {}) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function xmlDecode(s = '') {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

async function hashText(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function cacheGet(key) {
  try {
    const hit = await caches.default.match(new Request(key));
    return hit ? await hit.json() : null;
  } catch {
    return null;
  }
}

function cachePut(key, value, ttl, waitUntil) {
  try {
    const res = new Response(JSON.stringify(value), {
      headers: {'content-type':'application/json','cache-control':`public, max-age=${ttl}`},
    });
    const p = caches.default.put(new Request(key), res);
    if (waitUntil) waitUntil(p); else p.catch(()=>{});
  } catch {}
  return value;
}

async function youtubeChannelMeta(handle, env, waitUntil) {
  if (!env.YOUTUBE_API_KEY || !handle) return null;
  handle = String(handle).replace(/^@/, '');
  const key = `https://drks-cache.invalid/youtube-channel/${encodeURIComponent(handle.toLowerCase())}`;
  const cached = await cacheGet(key);
  if (cached) return cached;
  const q = new URLSearchParams({part:'id,snippet', forHandle:`@${handle}`, key:env.YOUTUBE_API_KEY});
  const data = await fetchJson(`https://www.googleapis.com/youtube/v3/channels?${q}`);
  const item = data.items?.[0];
  if (!item) return null;
  const thumbs = item.snippet?.thumbnails || {};
  const avatar = (thumbs.high || thumbs.medium || thumbs.default || {}).url || '';
  return cachePut(key, {id:item.id, avatar, title:item.snippet?.title || ''}, 86400, waitUntil);
}

function parseYoutubeFeed(xml, src, meta) {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  return entries.slice(0, 12).map(entry => {
    const videoId = (entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1] || '';
    const title = xmlDecode((entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || src.name);
    const published = (entry.match(/<published>([^<]+)<\/published>/) || [])[1] || '';
    const thumb = xmlDecode((entry.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/) || [])[1] || '');
    return videoId ? {
      memberId:src.memberId, memberName:src.name, roman:src.roman, videoId,
      feedTitle:title, feedPublishedAt:published, feedThumbnail:thumb,
      memberAvatar:meta?.avatar || '',
    } : null;
  }).filter(Boolean);
}

async function youtubeFeedOne(src, env, waitUntil) {
  const handle = src.youtube;
  if (!handle) return [];
  try {
    const meta = await youtubeChannelMeta(handle, env, waitUntil);
    if (!meta?.id) return [];
    const key = `https://drks-cache.invalid/youtube-feed/${encodeURIComponent(meta.id)}`;
    const cached = await cacheGet(key);
    if (cached) return cached;
    const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(meta.id)}`);
    return cachePut(key, parseYoutubeFeed(xml, src, meta), 90, waitUntil);
  } catch (e) {
    return {error:String(e?.message || e), provider:'YouTube'};
  }
}

export async function youtubePublicLive(handle, waitUntil) {
  handle = String(handle || '').trim().replace(/^@/, '');
  if (!handle) return null;
  const key = `https://drks-cache.invalid/youtube-public-live/${encodeURIComponent(handle.toLowerCase())}`;
  const cached = await cacheGet(key);
  if (cached !== null) return cached?.none ? null : cached;
  try {
    const res = await fetch(`https://www.youtube.com/@${encodeURIComponent(handle)}/live`, {
      redirect:'follow',
      headers:{'User-Agent':'Mozilla/5.0','Accept-Language':'ja,en;q=0.8'},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const finalUrl = new URL(res.url);
    let videoId = '';
    if (finalUrl.hostname.includes('youtube.com') && finalUrl.pathname === '/watch') {
      videoId = finalUrl.searchParams.get('v') || '';
    }
    if (!videoId && (html.includes('"isLiveNow":true') || html.includes('"isLiveContent":true'))) {
      videoId = (html.match(/"videoId":"([A-Za-z0-9_-]{11})"/) || [])[1] || '';
    }
    if (!videoId) {
      cachePut(key, {none:true}, 30, waitUntil);
      return null;
    }
    const title = xmlDecode((html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || [])[1] || '');
    const thumbnail = xmlDecode((html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) || [])[1] || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
    const row = {videoId, url:`https://www.youtube.com/watch?v=${videoId}`, title, thumbnail};
    return cachePut(key, row, 45, waitUntil);
  } catch {
    cachePut(key, {none:true}, 30, waitUntil);
    return null;
  }
}

async function fetchYoutubePublic(sources, waitUntil) {
  const enabled = sources.filter(s => s.youtube);
  if (!enabled.length) return [[], {configured:false, ok:true, message:'対象チャンネル未設定'}];
  const rows = await Promise.all(enabled.map(async src => {
    const row = await youtubePublicLive(src.youtube, waitUntil);
    if (!row) return null;
    return {
      memberId:src.memberId, memberName:src.name, roman:src.roman,
      platform:'YouTube', status:'live', videoId:row.videoId,
      title:row.title || src.name, thumbnail:row.thumbnail || '', url:row.url,
      viewerCount:null, startedAt:null, scheduledAt:null, category:'', memberAvatar:'', fallback:true,
    };
  }));
  return [rows.filter(Boolean), {configured:false, ok:true, message:'公開LIVEページ確認（API未設定フォールバック）'}];
}

async function fetchYoutube(sources, env, waitUntil) {
  if (!env.YOUTUBE_API_KEY) return fetchYoutubePublic(sources, waitUntil);
  const enabled = sources.filter(s => s.youtube);
  if (!enabled.length) return [[], {configured:true, ok:true, message:'対象チャンネル未設定'}];
  const results = await Promise.all(enabled.map(s => youtubeFeedOne(s, env, waitUntil)));
  const candidates = [], errors = [];
  for (const r of results) {
    if (r && !Array.isArray(r) && r.error) errors.push(r.error); else candidates.push(...(r || []));
  }
  const byId = new Map();
  for (const row of candidates) if (!byId.has(row.videoId)) byId.set(row.videoId, row);
  const vids = [...byId.keys()];
  if (!vids.length) return [[], {configured:true, ok:!errors.length, message:errors.length?'一部RSS取得失敗':'RSS取得済み / LIVEなし'}];
  const details = new Map();
  try {
    for (let i=0; i<vids.length; i+=50) {
      const params = new URLSearchParams({part:'snippet,liveStreamingDetails', id:vids.slice(i,i+50).join(','), key:env.YOUTUBE_API_KEY});
      const data = await fetchJson(`https://www.googleapis.com/youtube/v3/videos?${params}`);
      for (const item of data.items || []) details.set(item.id, item);
    }
  } catch (e) { errors.push(String(e?.message || e)); }
  const out = [];
  for (const [vid, base] of byId.entries()) {
    const d = details.get(vid) || {};
    const sn = d.snippet || {};
    const broadcast = sn.liveBroadcastContent;
    if (!['live','upcoming'].includes(broadcast)) continue;
    const live = d.liveStreamingDetails || {};
    const th = sn.thumbnails || {};
    const thumb = (th.maxres || th.standard || th.high || th.medium || {}).url || base.feedThumbnail || '';
    const cv = String(live.concurrentViewers ?? '');
    out.push({
      memberId:base.memberId, memberName:base.memberName, roman:base.roman,
      platform:'YouTube', status:broadcast, videoId:vid,
      title:sn.title || base.feedTitle || base.memberName, thumbnail:thumb,
      url:`https://www.youtube.com/watch?v=${vid}`, channelTitle:sn.channelTitle || '',
      memberAvatar:base.memberAvatar || '', viewerCount:/^\d+$/.test(cv)?Number(cv):null,
      startedAt:live.actualStartTime || null, scheduledAt:live.scheduledStartTime || null,
      category:sn.categoryId || '',
    });
  }
  return [out, {configured:true, ok:!errors.length, message:errors.length?'一部取得失敗':'RSS + videos.list 接続済み'}];
}

async function getTwitchToken(env, waitUntil) {
  const key = 'https://drks-cache.invalid/token/twitch';
  const cached = await cacheGet(key);
  if (cached?.token) return cached.token;
  const body = new URLSearchParams({client_id:env.TWITCH_CLIENT_ID, client_secret:env.TWITCH_CLIENT_SECRET, grant_type:'client_credentials'});
  const data = await fetchJson('https://id.twitch.tv/oauth2/token', {method:'POST', body});
  cachePut(key, {token:data.access_token}, Math.max(300, Math.min(Number(data.expires_in || 3600)-120, 3600)), waitUntil);
  return data.access_token;
}

async function fetchTwitch(sources, env, waitUntil) {
  if (!(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET)) return [[], {configured:false, ok:false, message:'Twitch API 未設定'}];
  const lookups = new Map(sources.filter(s=>s.twitch).map(s=>[s.twitch.toLowerCase(),s]));
  if (!lookups.size) return [[], {configured:true, ok:true, message:'対象チャンネル未設定'}];
  try {
    const token = await getTwitchToken(env, waitUntil);
    const qs = new URLSearchParams();
    for (const x of lookups.keys()) qs.append('user_login', x);
    const headers = {'Client-Id':env.TWITCH_CLIENT_ID, 'Authorization':`Bearer ${token}`};
    const [streams, users] = await Promise.all([
      fetchJson(`https://api.twitch.tv/helix/streams?${qs}`, {headers}),
      fetchJson(`https://api.twitch.tv/helix/users?${qs}`, {headers}),
    ]);
    const avatars = new Map((users.data || []).map(u=>[String(u.login||'').toLowerCase(),u.profile_image_url||'']));
    const out=[];
    for (const st of streams.data || []) {
      const login = String(st.user_login || '').toLowerCase();
      const src = lookups.get(login); if (!src) continue;
      const thumb = String(st.thumbnail_url || '').replace('{width}','1280').replace('{height}','720');
      out.push({memberId:src.memberId,memberName:src.name,roman:src.roman,platform:'Twitch',status:'live',title:st.title||src.name,thumbnail:thumb,url:`https://www.twitch.tv/${login}`,viewerCount:st.viewer_count??null,startedAt:st.started_at||null,memberAvatar:avatars.get(login)||'',scheduledAt:null,category:st.game_name||''});
    }
    return [out, {configured:true,ok:true,message:'接続済み'}];
  } catch(e) { return [[], {configured:true,ok:false,message:`取得失敗: ${String(e?.message||e).slice(0,100)}`}]; }
}

async function getKickToken(env, waitUntil) {
  const key='https://drks-cache.invalid/token/kick';
  const cached=await cacheGet(key); if(cached?.token)return cached.token;
  const body=new URLSearchParams({grant_type:'client_credentials',client_id:env.KICK_CLIENT_ID,client_secret:env.KICK_CLIENT_SECRET});
  const data=await fetchJson('https://id.kick.com/oauth/token',{method:'POST',body});
  cachePut(key,{token:data.access_token},Math.max(300,Math.min(Number(data.expires_in||3600)-120,3600)),waitUntil);
  return data.access_token;
}

async function fetchKick(sources, env, waitUntil) {
  if (!(env.KICK_CLIENT_ID && env.KICK_CLIENT_SECRET)) return [[], {configured:false,ok:false,message:'Kick API 未設定'}];
  const lookups=new Map(sources.filter(s=>s.kick).map(s=>[s.kick.toLowerCase(),s]));
  if(!lookups.size)return [[],{configured:true,ok:true,message:'対象チャンネル未設定'}];
  try{
    const token=await getKickToken(env,waitUntil);
    const qs=new URLSearchParams(); for(const x of lookups.keys())qs.append('slug',x);
    const data=await fetchJson(`https://api.kick.com/public/v1/channels?${qs}`,{headers:{Authorization:`Bearer ${token}`}});
    const out=[];
    for(const ch of data.data||[]){
      const slug=String(ch.slug||'').toLowerCase(); const src=lookups.get(slug); const stream=ch.stream||{};
      if(!src||!stream.is_live)continue;
      out.push({memberId:src.memberId,memberName:src.name,roman:src.roman,platform:'Kick',status:'live',title:ch.stream_title||src.name,thumbnail:stream.thumbnail||'',url:`https://kick.com/${slug}`,viewerCount:stream.viewer_count??null,startedAt:stream.start_time||null,memberAvatar:ch.profile_picture||(ch.broadcaster_user||{}).profile_picture||(ch.user||{}).profile_picture||'',scheduledAt:null,category:(ch.category||{}).name||''});
    }
    return [out,{configured:true,ok:true,message:'接続済み'}];
  }catch(e){return [[],{configured:true,ok:false,message:`取得失敗: ${String(e?.message||e).slice(0,100)}`}];}
}

export async function collectLive(payload, env, waitUntil) {
  const sources=cleanSources(payload);
  const sig=await hashText(JSON.stringify(sources));
  const key=`https://drks-cache.invalid/live/${sig}`;
  const cached=await cacheGet(key);
  if(cached){return {...cached,cached:true};}
  const [yt,tw,ki]=await Promise.all([
    fetchYoutube(sources,env,waitUntil),
    fetchTwitch(sources,env,waitUntil),
    fetchKick(sources,env,waitUntil),
  ]);
  const items=[...yt[0],...tw[0],...ki[0]].sort((a,b)=>{
    const as=a.status==='live'?0:1, bs=b.status==='live'?0:1;
    return as-bs || String(a.memberName||'').localeCompare(String(b.memberName||''),'ja') || String(a.platform||'').localeCompare(String(b.platform||''));
  });
  const value={items,providers:{YouTube:yt[1],Twitch:tw[1],Kick:ki[1]},fetchedAt:Math.floor(Date.now()/1000),cached:false};
  return cachePut(key,value,55,waitUntil);
}

export async function fetchArchive(payload, env, waitUntil) {
  const sources=cleanSources(payload);
  if(!env.YOUTUBE_API_KEY)return {items:[],message:'YouTube API未設定',configured:false};
  const sig=await hashText(JSON.stringify(sources));
  const key=`https://drks-cache.invalid/archive/${sig}`;
  const cached=await cacheGet(key); if(cached)return cached;
  const enabled=sources.filter(s=>s.youtube);
  const results=await Promise.all(enabled.map(s=>youtubeFeedOne(s,env,waitUntil)));
  const out=[];
  for(const r of results){
    if(!Array.isArray(r))continue;
    for(const row of r.slice(0,3))out.push({memberId:row.memberId,memberName:row.memberName,platform:'YouTube',title:row.feedTitle||'',publishedAt:row.feedPublishedAt||null,thumbnail:row.feedThumbnail||'',memberAvatar:row.memberAvatar||'',url:`https://www.youtube.com/watch?v=${row.videoId}`});
  }
  out.sort((a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
  return cachePut(key,{items:out.slice(0,30),message:'RSS',configured:true},300,waitUntil);
}

export function health(env) {
  const slug=String(env.PRIVATE_SLUG||DEFAULT_PRIVATE_SLUG).trim().replace(/^\/+|\/+$/g,'')||DEFAULT_PRIVATE_SLUG;
  return {
    ok:true,server:'DRKS LIVE PORTAL v8 / Cloudflare Workers',privatePath:`/${slug}/`,
    providers:{YouTube:Boolean(env.YOUTUBE_API_KEY),Twitch:Boolean(env.TWITCH_CLIENT_ID&&env.TWITCH_CLIENT_SECRET),Kick:Boolean(env.KICK_CLIENT_ID&&env.KICK_CLIENT_SECRET)},
    youtubeFallback:!Boolean(env.YOUTUBE_API_KEY),time:Math.floor(Date.now()/1000),
  };
}
