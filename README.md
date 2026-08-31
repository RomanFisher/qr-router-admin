🇬🇧 **English** · [🇺🇦 Українська](README.uk.md) · [🇵🇱 Polski](README.pl.md)

# QR Router Admin

One static QR code that always points to `<domain>/r/<slug>`. Where it
actually redirects is decided by the admin through a control panel, by
picking the active link from a list. The QR code itself never changes.

## Stack

Node.js + Express + SQLite (a single file, no separate DB container) + EJS.
Styling is Tailwind CSS via CDN (no build step), dark theme by default with
a toggle for light mode (remembered in the browser's `localStorage`),
responsive layout. Everything runs in Docker containers, with no third-party
cloud services and nothing extra to rent.

## Quick start (by IP / no domain)

You only need Docker + Docker Compose.

```
cp .env.example .env
docker compose up -d --build
```

Open `http://localhost:3000` (or `http://<server-IP>:3000`) — on first visit
you'll see a form to create the admin account (username + password, minimum
8 characters). There is no default password anywhere in the code: until an
account is created through this form, logging in is impossible.

Then: create a code → add one or more links → pick the active one → download
the QR (PNG) with the button and print it.

## Running with your own domain and HTTPS (Caddy)

If you have a domain whose DNS A record points at the server's IP, and ports
80/443 are open:

1. In `.env`, set:
   ```
   DOMAIN=qr.mydomain.com
   ```
2. Start it together with Caddy (a separate compose file; the HTTPS
   certificate from Let's Encrypt is obtained automatically):
   ```
   docker compose -f docker-compose.https.yml up -d --build
   ```
3. Open `https://qr.mydomain.com` — same as before, the admin-creation form
   appears on first visit.

In this mode port 3000 is not published externally — all traffic goes
through Caddy on 443/80.

## Languages

The interface is available in three languages: Ukrainian, English, Polish
(`src/locales/*.json`). The language is picked like this:

1. If a `lang` cookie exists (the person already chose a language with the
   switcher at the top) — that one is used.
2. Otherwise — the browser's language is used (the `Accept-Language` header).
3. If the browser's language isn't in the supported list — English is used
   by default.

The language switcher (UK · EN · PL) is at the top of every page, including
the login and first-time setup screens — it works without being logged in.

## Tests

The automated tests (`tests/`) run through the whole cycle: the setup
wizard, login, admin-section protection, creating a code, adding/switching
links, the redirect, changing the password, deletion; a dedicated
concurrency test (hundreds of simultaneous scans while the active link is
being switched in parallel); and a dedicated i18n test (browser language
detection, the English fallback, the switcher, protection against an open
redirect via the `redirect` parameter). They use Node's built-in
`node --test` and an isolated in-memory database — your real data
(`./data/app.db`) is never touched.

Without Docker (`npm install` once):
```
npm install
npm test
```

Or inside a container, without installing Node.js on the host:
```
docker compose run --rm app npm test
```

## Recovering access (forgotten password)

There's no email in this project and there won't be — recovery goes through
the server, which the admin already has access to (SSH/Docker), and sets a
new password directly in the database:

```
docker compose exec app npm run reset-admin -- admin yourNewStrongPassword
```

(for the HTTPS setup: `docker compose -f docker-compose.https.yml exec app ...`)

This overwrites the account — the previous password isn't needed.

## Data

The SQLite file lives at `./data/app.db` on the host (a Docker volume) — it
survives container restarts and rebuilds. Backup = copy that file. The
auto-generated session secret (`./data/.session_secret`) lives alongside it
— don't delete it, or every session will be logged out.

## Production notes

- Login is protected by a simple rate limit (10 attempts / 15 min per IP).
- Changing `BASE_DOMAIN` under Settings does not affect already-printed QR
  codes — a physical code encodes whichever domain was active at the moment
  its PNG was generated.
- Behind Caddy, automatic domain detection (for generating new QR codes)
  works correctly out of the box, since Caddy forwards the right headers —
  nothing extra to configure.
