
# KABBAK

A web-based esoteric correspondence app for tarot, astrology, calendars, symbols, and related systems.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-5FA04E?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Git](https://img.shields.io/badge/VCS-Git-F05032?logo=git&logoColor=white)](https://git-scm.com/)

## Features

- Correspondence explorer for multiple occult/esoteric systems.
- Tarot deck support served by the KABBAK API.
- Fast local static shell serving with `http-server`.

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

The app opens in your browser (typically at `http://127.0.0.1:8080`) and stays in shell mode until you enter a reachable API base URL and a valid API key.

For local development with a default local API configuration:

```powershell
API Base URL: http://localhost:3100
API Key: <value accepted by KABBAK_API_KEY or KABBAK_API_KEYS>
```

## NPM Scripts

| Command | Description |
| --- | --- |
| `npm run start` | Serve the static client locally and open `index.html`. |
| `npm run dev` | Alias of `npm run start`. |

## Server Admin Defaults (`config.json`)

Copy `config.example.json` to `config.json` in the client root. First-time visitors inherit these defaults; users who already saved settings keep their own choices.

```json
{
  "apiBaseUrl": "http://localhost:3100",
  "apiKey": "",
  "branding": {
    "title": "My Site",
    "homeLabel": "My Site",
    "logo": "logo.png"
  },
  "defaults": {
    "menuLayout": "drawer",
    "timeFormat": "minutes",
    "tarotDeck": "ceremonial-magick",
    "detailTextScale": 1,
    "themeId": "ocean",
    "stellariumBackgroundEnabled": false,
    "latitude": 51.5074,
    "longitude": -0.1278
  }
}
```

### Branding / logo

| Field | Purpose |
| --- | --- |
| `branding.title` | Browser tab title |
| `branding.homeLabel` | Top-left home control text (and image alt text) |
| `branding.logo` | `false` (default text), `"logo.png"` (explicit path), or `true` (auto-detect) |

With `"logo": true`, auto-detect checks `logo.png`, `logo.svg`, `logo.webp`, `logo.jpg`, then `logo.jpeg`. Prefer an explicit path like `"logo": "logo.png"` after placing the file next to `index.html`.

### Theme defaults

| Field | Purpose |
| --- | --- |
| `defaults.themeId` | Built-in theme id: `midnight`, `amethyst`, `emerald`, `crimson`, `ocean`, `solar` |
| `defaults.theme` | Optional custom palette object (`id`, `name`, `base` colors) |

Example custom theme:

```json
"defaults": {
  "theme": {
    "id": "site-brand",
    "name": "Site Brand",
    "base": {
      "bg": "#101418",
      "surface": "#1b242c",
      "border": "#334155",
      "text": "#f8fafc",
      "muted": "#94a3b8",
      "accent": "#38bdf8",
      "brand": "#fbbf24"
    }
  }
}
```

Theme defaults apply only when the browser has no saved theme yet.
