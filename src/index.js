import {
  DEFAULT_PRIVATE_SLUG,
  allowed,
  collectLive,
  fetchArchive,
  health,
  json,
  youtubePublicLive,
} from './providers.js';

function cleanSlug(value) {
  return String(value || '')
    .trim()
    .replace(/^\/+|\/+$/g, '') || DEFAULT_PRIVATE_SLUG;
}

function withSecurityHeaders(response, contentType) {
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (contentType) headers.set('Content-Type', contentType);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function notFound() {
  return new Response(
    '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>404</title><body style="font-family:system-ui;background:#f6f7f9;color:#111;display:grid;place-items:center;height:100vh;margin:0"><div><b>404</b><p>Not Found</p></div></body></html>',
    {
      status: 404,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'x-robots-tag': 'noindex, nofollow, noarchive',
        'cache-control': 'no-store',
      },
    },
  );
}

async function api(request, env, ctx, path) {
  if (!allowed(request, env)) return json({ error: 'not found' }, 404);

  try {
    if (path === '/api/health' && request.method === 'GET') {
      return json(health(env));
    }

    if (path === '/api/youtube-live' && request.method === 'GET') {
      const handle = new URL(request.url).searchParams.get('handle') || '';
      const item = await youtubePublicLive(handle.slice(0, 100), p => ctx.waitUntil(p));
      return json({ ok: Boolean(item), item });
    }

    if (path === '/api/live' && request.method === 'POST') {
      const payload = await request.json().catch(() => ({}));
      return json(await collectLive(payload, env, p => ctx.waitUntil(p)));
    }

    if (path === '/api/archive' && request.method === 'POST') {
      const payload = await request.json().catch(() => ({}));
      return json(await fetchArchive(payload, env, p => ctx.waitUntil(p)));
    }

    return json({ error: 'not found' }, 404);
  } catch (error) {
    return json({ error: String(error?.message || error) }, 500);
  }
}

async function servePrivateAsset(request, env, privateSlug) {
  const url = new URL(request.url);
  const prefix = `/${privateSlug}`;

  if (url.pathname === prefix) {
    url.pathname = `${prefix}/`;
    return Response.redirect(url.toString(), 302);
  }

  if (!url.pathname.startsWith(`${prefix}/`)) return notFound();

  // The physical asset folder is kept at the default slug. This lets PRIVATE_SLUG
  // change in Cloudflare without having to rename files in GitHub.
  const suffix = url.pathname.slice(prefix.length);
  const assetUrl = new URL(request.url);
  assetUrl.pathname = `/${DEFAULT_PRIVATE_SLUG}${suffix}`;

  const assetRequest = new Request(assetUrl.toString(), request);
  const response = await env.ASSETS.fetch(assetRequest);
  if (response.status === 404) return notFound();
  return withSecurityHeaders(response);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const privateSlug = cleanSlug(env.PRIVATE_SLUG);

    if (path === '/robots.txt') {
      return new Response('User-agent: *\nDisallow: /\n', {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'public, max-age=3600',
          'x-robots-tag': 'noindex, nofollow, noarchive',
        },
      });
    }

    if (path.startsWith('/api/')) {
      return api(request, env, ctx, path);
    }

    if (path === '/' || path === '/index.html' || path === '/favicon.ico') {
      return notFound();
    }

    return servePrivateAsset(request, env, privateSlug);
  },
};
