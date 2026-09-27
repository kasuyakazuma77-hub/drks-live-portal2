# DRKS LIVE PORTAL v11

Twitch接続の診断と堅牢化版です。

- Twitch OAuth POSTを明示的に application/x-www-form-urlencoded で送信
- Client ID単位でToken cacheを分離
- Get Streamsを本体判定、Get Usersはプロフィール取得のbest-effortへ変更
- `/api/twitch-test` でSecretを表示せず OAuth / Helix の接続段階を診断
- LIVE画面にTwitchエラー理由と「Twitch診断」ボタンを表示

公開URL:
https://drks-live-portal2.kasuyakazuma77.workers.dev/drks-wqrgmrlzucjg5eg/?v=11
