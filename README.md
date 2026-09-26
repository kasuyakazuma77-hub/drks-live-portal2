# DRKS LIVE PORTAL v9 — Cloudflare Workers版

## 今回の修正

V8でMULTI VIEWの初期4枠が demo / URL未設定のまま残っていたため、実際の配信プレイヤーが表示されない状態を修正しました。

V9では初期4枠を以下の実チャンネルへ接続します。

- 加藤純一 / Twitch `kato_junichi0817`
- ゆゆうた / Twitch `yuyuta0702`
- 布団ちゃん / Twitch `indegnasen0706`
- バトラ / Twitch `batora324`

Twitch公式埋め込みプレイヤーを使用します。配信中ならLIVE、オフラインならTwitch側のオフライン表示になります。

以前のV8を開いたことがあるブラウザでも、保存されている4つのdemo枠をV9起動時に実チャンネルへ自動移行します。

## YouTube / Twitch / Kick

- Twitch: APIキーなしでも「直接視聴」と固定チャンネルの公式埋め込みは動きます。
- YouTube: APIキーなしでも公開LIVEページを補助的に確認します。LIVEが見つかった時だけ動画IDを使って公式プレイヤーを表示します。
- Kick: slugを設定していれば公式player.kick.comを使用します。
- 自動LIVE判定 / 同接表示: Twitch / Kickは公式APIのSecretsを設定すると有効になります。YouTubeもAPIキー設定時の方が安定します。

## GitHubへ更新する方法

このZIPを解凍し、中身を現在の `drks-live-portal2` リポジトリ直下へ上書きしてください。

GitHub直下に最低限これが見える状態にします。

- `wrangler.jsonc`
- `package.json`
- `src/`
- `public/`

Cloudflare側は今の設定のままでOKです。

- Build command: None
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

GitHubへcommitすると自動Buildされます。必要ならDeploymentsからRetry buildしてください。

## 更新後に古い画面が残る場合

V8のService Workerキャッシュを使っていたため、最初の1回だけ古い画面が残ることがあります。V9ではキャッシュ方式を修正しています。

公開URLの末尾に一度だけ `?v=9` を付けて開き、Ctrl+F5で再読み込みしてください。

例：

`https://...workers.dev/drks-wqrgmrlzucjg5eg/?v=9`

## MULTI VIEW

- 初回から実Twitchチャンネル4窓
- `▶ 固定チャンネル` で実チャンネル4窓へ戻せる
- `◉ LIVE自動配置` はAPI / 公開LIVE検出で取得できた、現在LIVE中の配信だけを配置
- URL手動追加も継続

## 秘密URL

トップ `/` は404です。標準の専用URLは

`/drks-wqrgmrlzucjg5eg/`

です。閲覧者ログインは不要です。
