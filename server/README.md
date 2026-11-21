# iOS 27 Launcher server

Tiny account + settings-sync server for the launcher. No Google account involved: people pick a launcher ID and a password.
It stores, per account: the ID, a salted scrypt password hash, and the synced launcher settings (wallpaper choice, icon size and shape, columns, dock apps, hidden apps, lock-screen switch). It never stores wallpaper photos or anything from the phone.

No dependencies. Needs Node 18+.

## Run it

```bash
cd server
PORT=8080 DATA_DIR=./data node server.js
```

or with Docker:

```bash
docker build -t ios27-server ./server
docker run -d -p 8080:8080 -v ios27data:/data ios27-server
```

## It must be reachable over HTTPS

The launcher only talks to `https://` addresses. Put the server behind any host or proxy that gives you HTTPS (a Docker/Node host, a VPS with Caddy or nginx, a tunnel such as Cloudflare Tunnel, etc.).

* Set `TRUST_PROXY=1` **only** when the server is behind such a proxy (it makes the server read the real client IP for rate limiting). Do not set it if the server is exposed directly.
* Keep `DATA_DIR` on storage that **survives restarts and redeploys**. Many free hosts wipe the disk, which would delete every account. Use a persistent volume/disk, or host it on your own machine.

## Then, in the launcher

Settings (home screen) -> Server -> paste your `https://...` address -> Save -> Test connection -> Create account.

## API

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/health` | | `{ok:true}` |
| POST | `/api/register` | `{id, password}` | ID 3-24 chars `a-z 0-9 . _`, password 8-128 chars. Returns `{id, token, recovery}` (recovery code is shown once) |
| POST | `/api/login` | `{id, password}` | Returns `{id, token}` |
| GET | `/api/me` | | needs `Authorization: Bearer <token>` |
| GET | `/api/settings` | | `{settings, updatedAt}` |
| PUT | `/api/settings` | `{settings:{...}}` | max 64 KB |
| POST | `/api/recover` | `{id, recovery, newPassword}` | resets a forgotten password with the one-time recovery code; returns a new `{token, recovery}` |
| POST | `/api/recovery-code` | `{password}` | makes a new recovery code (old one stops working) |
| POST | `/api/logout` | | ends this session |
| POST | `/api/password` | `{oldPassword, newPassword}` | signs out other devices |
| POST | `/api/account/delete` | `{password}` | deletes the account and its data |

## Safety built in

Salted scrypt password hashing, constant-time comparison, random session tokens (only their hash is stored), 90-day sessions, per-IP and per-account rate limits with a 15-minute lockout after 8 wrong passwords, 100 KB request cap, `db.json` written with owner-only permissions. Passwords are never logged.

## Not included (be aware)

There is no email. A forgotten password is reset with the recovery code shown at sign-up. If both are lost, the owner of the server has to delete the account so the ID can be registered again. Back up `DATA_DIR/db.json` if you care about the accounts.
