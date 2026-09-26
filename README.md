# DRKS LIVE PORTAL v8 — Cloudflare Workers版

この版は Cloudflare Pages 用ではなく、Cloudflare Workers + Static Assets 用です。
CloudflareのBuild画面で `Deploy command: npx wrangler deploy` になっている既存プロジェクトへ、そのまま載せることを目的にしています。

## GitHubへアップロードするもの

ZIPを解凍し、**中身をリポジトリの一番上（root）へ**アップロードしてください。

GitHubを開いたとき、少なくとも次が直下に見えていればOKです。

- `wrangler.jsonc`
- `package.json`
- `src/`
- `public/`
- `README.md`

旧Pages版の `functions/` は不要です。残っていても今回のWorkerは使用しませんが、混乱防止のため削除推奨です。

## Cloudflareの既存Build設定

現在のWorkerプロジェクトでは以下でOKです。

- Production branch: `main`
- Build command: 空欄 / None
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

GitHubへV8をコミットしたら、Cloudflareの `Retry build` か、新しいDeployを実行してください。

## 公開後のURL

WorkerのURLが例として

`https://drks-live-portal2.<your-subdomain>.workers.dev`

なら、共有するURLは標準では

`https://drks-live-portal2.<your-subdomain>.workers.dev/drks-wqrgmrlzucjg5eg/`

です。

トップ `/` は404を返します。`robots.txt` も全クロール禁止です。

## ログインなし・URLを知っている人だけ

認証画面はありません。長い専用パスを知っている人だけが通常アクセスできる方式です。

これは強いアクセス制御ではありません。URLを転送された人は閲覧できます。
GitHubリポジトリもPrivateにすることを推奨します。

### 専用URLを変更したい場合

Cloudflareの Worker > Settings > Variables & Secrets で通常のVariableとして

`PRIVATE_SLUG = 任意の長い文字列`

を設定できます。

例: `PRIVATE_SLUG = drks-xxxxxxxxxxxxxxxxxxxx`

V8ではWorker側でURLを書き換えるため、GitHub上のフォルダ名を変更する必要はありません。

## LIVE自動取得用 Secrets

なくてもサイト本体と手動マルチ視聴は動きます。
自動LIVE判定や同接取得を安定させたい場合のみ設定してください。

- `YOUTUBE_API_KEY`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `KICK_CLIENT_ID`
- `KICK_CLIENT_SECRET`

Cloudflareの Worker > Settings > Variables & Secrets でSecretとして登録します。

## API

同一Worker内で以下を処理します。

- `GET /api/health`
- `POST /api/live`
- `POST /api/archive`
- `GET /api/youtube-live?handle=...`

ブラウザ側は専用URLの先頭パスを `X-DRKS-Access` に入れてAPIを呼ぶため、通常のトップURLからAPIだけを直接使いにくいようにしています。
