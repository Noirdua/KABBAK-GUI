
# KABBAK

A web-based esoteric correspondence app for tarot, astrology, calendars, symbols, and related systems.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-5FA04E?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Git](https://img.shields.io/badge/VCS-Git-F05032?logo=git&logoColor=white)](https://git-scm.com/)

## Features

- Correspondence explorer for multiple occult/esoteric systems.
- Tarot deck support served by the KABBAK API.
- Fast local static shell serving with `serve`.

## Quick Start

1. Install Node.js: https://nodejs.org/en/download
2. Start the API and confirm its base URL and API key.
3. Clone or download this repository.
4. Install dependencies.
5. Start the client.

```powershell
git clone <your-frontend-repo-url>
Set-Location .\KABBAK
npm install
npm run start
```

The app opens in your browser (typically at `http://127.0.0.1:8080`). On localhost it pre-fills `http://localhost:3100`. Enter an API key in the connection gate (or Settings). The browser remembers URL and key.

Create keys in the API Admin panel, or set them in the API `.env` (`KABBAK_API_KEY` / `KABBAK_API_KEYS`). For a keyless local server use `KABBAK_NO_AUTH=1`. Branding, theme, and other site defaults are edited in Admin / Settings — there is no client `config.json` to copy.

## NPM Scripts

| Command | Description |
| --- | --- |
| `npm run start` | Serve the static client locally and open `index.html`. |
| `npm run dev` | Alias of `npm run start`. |

## Connection and site defaults

The static client does not use `.env`. API keys and bind address live in the **API** `.env`. After you connect once, the GUI stores the API URL and key in the browser.

Site title, overlay, CORS, and other server options are in **Admin → Server**. Theme, location, deck, and menu layout are in **Settings**.
