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
