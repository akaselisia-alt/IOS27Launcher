# Put the account system online (about 15 minutes)

The launcher app is built by GitHub Actions. The account server (`server/`) must run on the internet so every phone can reach it. You host it once; people then create accounts inside the launcher (ID + password, no Google).

## 1. Host the server (pick one)

The server keeps accounts in a file, so it needs a **disk that survives restarts**. Hosts with a wiped/ephemeral disk will lose every account.

* **Render** (easiest): Dashboard -> New -> Blueprint -> choose this repo. `render.yaml` sets up the server and a 1 GB disk (needs a paid instance, about $7/month).
* **Fly.io**: install `flyctl`, then in the `server` folder run `fly launch --no-deploy --copy-config`, `fly volumes create accounts --size 1`, `fly deploy`.
* **Your own machine / VPS**: `docker build -t ios27-server ./server && docker run -d --restart always -p 8080:8080 -v ios27data:/data ios27-server`, then put Caddy or a Cloudflare Tunnel in front for HTTPS.

All three give you an `https://...` address. Open `https://YOUR-ADDRESS/health`: it must show `{"ok":true}`.

## 2. Bake the address into the app

GitHub repo -> Settings -> Secrets and variables -> Actions -> **Variables** -> New repository variable:
name `LAUNCHER_SERVER`, value `https://YOUR-ADDRESS` (no trailing slash). Then Actions -> Build APK -> Run workflow. The new APK already knows your server, so users just tap Settings -> Create account.

## 3. Test before publishing

1. Install the new APK, open Settings, create an account, **write down the recovery code**.
2. Sign out, sign in again. Try "Forgot password?" with the recovery code.
3. Change a wallpaper, install the APK on a second phone, sign in and see the settings arrive.

## Back up and keep it safe

* Copy `/data/db.json` somewhere regularly (it holds all accounts).
* Passwords are never stored, only salted scrypt hashes. Recovery codes are stored as hashes.
* Without email, a lost password AND lost recovery code cannot be recovered; delete the account in `db.json` so the ID can be reused.
* `https://YOUR-ADDRESS/privacy` is a ready privacy page you can link if you publish the app.

## The Store (apps, uploads, money)

The same server also runs the app store. Anyone with an account can upload an APK at `https://YOUR-SERVER/developer`;
after you approve it at `https://YOUR-SERVER/admin` it appears in the Store inside the launcher and in the separate
**IOS27Store.apk** (both are built by the workflow and published on the Releases page).

Set these environment variables on the server:

| Variable | What it does |
|---|---|
| `ADMIN_IDS` | Your launcher account ID (comma-separated for more). Only these accounts can approve apps, record payouts and refund. |
| `PUBLIC_URL` | The https address of your server (needed for payment return links). |
| `PAYMENT_PROVIDER` | `paystack`, `flutterwave`, `mock` (testing only) or `none` (free apps only). |
| `PAYSTACK_SECRET` / `FLW_SECRET` / `FLW_WEBHOOK_HASH` | Keys from your Paystack or Flutterwave dashboard. |
| `CURRENCY` | Default `GHS`. |
| `PLATFORM_FEE_PERCENT` | Your cut of each sale, default 30. |
| `MAX_APK_MB` | Upload size limit, default 150. |
| `AUTO_APPROVE` | `1` skips review (not recommended). |

Webhook URLs to enter in the provider dashboard: `/api/store/webhook/paystack` or `/api/store/webhook/flutterwave`.

Things to know:
- The server must have **HTTPS and a persistent disk** (apps and the database live in `DATA_DIR`). Free tiers that erase disk will lose every upload.
- Payouts to developers are **manual**: the admin page shows what each developer is owed; you pay them and record it.
- A refund in the admin page reverses the ledger; also refund the customer in the provider dashboard.
- The server checks that an upload is a real APK and records its SHA-256 (the app verifies it before installing), but it **cannot scan for malware**. Review apps before approving.
- Phones must allow "install unknown apps" for the Store/launcher the first time.
- Set the `LAUNCHER_SERVER` repository variable and re-run the workflow so both APKs know your server.

## Fmusic (post and stream songs)

The Fmusic app in both launchers streams songs that people post to your server. Nothing extra to install: it runs on the same server and needs the same disk.

- Anyone with an account posts a song from the **Post** tab: audio file (mp3, m4a, ogg, wav, flac), title, artist, genre, optional cover art, and a tick-box confirming they own the rights. It goes live at once. Anyone can stream it without signing in.
- Listeners can like songs, make playlists, search, and report a song. Three different people reporting a song hides it until an admin (`ADMIN_IDS`) restores or deletes it.
- Limits: 30 MB per song (`MAX_AUDIO_MB`), 40 songs per person, 10 uploads a day.
- Songs are stored in `DATA_DIR/songs`. Use a persistent disk, the same as for the Store, and back it up.
- You are responsible for what is posted. Remove songs that break copyright when you are told about them. Phones stop playback when the screen turns off, because the app has no background music service yet.
