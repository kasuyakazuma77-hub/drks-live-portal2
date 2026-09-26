# DRKS LIVE PORTAL v7 / Cloudflare Pages + Functions

Render/Pythonサーバーを使わず、Cloudflare Pages + Pages Functions で公開する版です。

## この版で変えたこと

- `server.py` / `start.bat` は公開に不要
- Web画面は Cloudflare Pages の静的配信
- `/api/*` だけ Pages Functions で実行
- YouTube / Twitch / Kick のAPIキーはブラウザへ置かず、Cloudflare側の Variables and Secrets で保持
- トップURL `/` にはサイトを置かず、専用パスだけに本体を配置
- `robots.txt` と `X-Robots-Tag` で検索エンジン向けに非掲載指定
- 静的ファイルは Functions を通さない `_routes.json` を同梱

## 公開URL

公開後に共有するのは次の形です。

`https://＜プロジェクト名＞.pages.dev/drks-wqrgmrlzucjg5eg/`

`https://＜プロジェクト名＞.pages.dev/` は 404 になります。

> これはログイン認証ではありません。URLを転送された相手は閲覧できます。
> URLをGitHub上から知られにくくするため、GitHubリポジトリは **Private** 推奨です。

---

# 一番簡単な公開方法

## 1. GitHubへアップロード

このZIPを解凍し、**中身をそのままGitHubリポジトリのルートへアップロード**してください。

GitHubの最上位に次が見えていればOKです。

- `public/`
- `functions/`
- `src/`
- `README.md`
- `PRIVATE_URL.txt`

`ZIPファイルそのもの`をGitHubへ置くだけでは動きません。解凍した中身をアップロードしてください。

## 2. CloudflareでPagesを作成

Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Import an existing Git repository**

GitHubを接続し、DRKS用リポジトリを選びます。

### Build settings

- Production branch: `main`
- Framework preset: `None`
- Build command: **空欄**
- Build output directory: `public`
- Root directory: `/` のまま

そのまま Deploy します。

Pages Functions は `functions/` フォルダから自動で検出されます。

## 3. 公開URLを開く

Cloudflareが例えば

`https://drks-live-portal.pages.dev`

を発行した場合、実際に使うURLは

`https://drks-live-portal.pages.dev/drks-wqrgmrlzucjg5eg/`

です。

この段階で、APIキーなしでも以下は利用できます。

- HOME / MEMBERS / MY DRKS
- 2 / 4 / 6 / 8 窓
- YouTube / Twitch / Kick URLの手動追加
- 公式埋め込みプレイヤー
- レイアウト保存
- お気に入り
- URL共有
- YouTube公開LIVEの補助確認

---

# 自動LIVE判定・同接表示を有効にする

Cloudflare Pages のプロジェクトを開き、

**Settings → Variables and Secrets → Add**

から必要なものだけ登録します。

### YouTube

`YOUTUBE_API_KEY`

### Twitch

`TWITCH_CLIENT_ID`

`TWITCH_CLIENT_SECRET`

### Kick

`KICK_CLIENT_ID`

`KICK_CLIENT_SECRET`

Client Secret / API Key は **Encrypt / Secret** として登録してください。

登録後は新しくDeployしてください。

`PRIVATE_SLUG` は設定しなくても動きます。標準値は `drks-wqrgmrlzucjg5eg` です。

---

# 無料枠向けの構成

`public/_routes.json` で `/api/*` だけをFunctionsへ通し、HTML/CSS/JS/画像などの通常表示は静的配信にしています。

そのため、ページを開くだけのアクセスはFunctionsを消費せず、LIVE情報の更新時だけFunctionsを使用します。

現在の自動更新間隔は約1分です。

---

# 重要：URLを知っている人だけ方式について

この版は次の対策を入れています。

- 本体を推測しにくいサブパスへ配置
- ルートは404
- `robots.txt` で全クロール拒否
- `X-Robots-Tag: noindex, nofollow, noarchive`
- 閲覧者ログインなし

ただし認証機能ではありません。
URLを知っている人は誰でも開けます。

本当に第三者からアクセスできないようにする場合はCloudflare Access等の認証が必要ですが、「ログイン不要」という今回の要件とは両立しないため導入していません。

---

# フォルダ構成

```text
public/
  404.html
  robots.txt
  _headers
  _routes.json
  drks-wqrgmrlzucjg5eg/
    index.html
    app.js
    styles.css
    design-v4.css
    design-v5.css
    design-v6.css
    manifest.json
    sw.js
    assets/
      icon.svg
functions/
  api/
    health.js
    live.js
    archive.js
    youtube-live.js
src/
  providers.js
```

## v7

Cloudflare Pages + Functions用にV6のPython API処理をJavaScript/Workersランタイムへ移植しています。
