# Les Immortels

A real-time web app for managing **Werewolf (Loup-Garou)** games with ~30 players over a weekend. Built with Node.js, React, Socket.IO, and SQLite.

*Application web temps réel pour gérer une partie de Loup-Garou avec ~30 joueurs.*

## Features

- **3 interfaces**: Player (mobile-first), Admin control panel, Projected dashboard (16:9)
- **Real-time**: All game events broadcast instantly via Socket.IO
- **Full admin control**: Manual phase transitions, vote overrides, player management
- **Offline-resilient**: All state persisted in SQLite — server restarts mid-game are safe
- **Special roles**: 6 roles earned through challenges (Maire, Sorcière, Protecteur, Voyante, Chasseur, Immunité)
- **Ghost system**: Eliminated players become ghosts who continue to participate
- **Automatic scoring**: Points computed throughout the game, revealed at the end

## Quick Start

### Prerequisites

- Node.js 20+
- npm

### Local Development

```bash
git clone https://github.com/t-lefort/immortels.git
cd immortels
cp .env.example .env    # Edit .env to set your ADMIN_PASSWORD
npm install
npm run dev
```

The app starts on `http://localhost:3000`:
- `/play` — Player interface
- `/admin` — Admin panel (password required)
- `/dashboard` — Projected display

### With Docker

```bash
cp .env.example .env    # Edit .env to set your ADMIN_PASSWORD
docker compose up --build
```

## Configuration

Copy `.env.example` to `.env` and set the following variables:

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment (`production` / `development`) | `production` |
| `ADMIN_PASSWORD` | Admin panel password | `changeme` |
| `TUNNEL_TOKEN` | Cloudflare tunnel token (optional) | — |

## Production Deployment

### Using Docker Compose

```bash
# Build and push (from dev machine)
docker buildx build --platform linux/amd64 -t ghcr.io/t-lefort/immortels:latest .
docker push ghcr.io/t-lefort/immortels:latest

# On the server
docker compose -f docker-compose.prod.yml up -d
```

SQLite data is persisted in a Docker volume (`immortels-data`).

### Useful Commands

```bash
docker compose -f docker-compose.prod.yml logs -f     # View logs
docker compose -f docker-compose.prod.yml restart      # Restart
docker compose -f docker-compose.prod.yml down         # Stop
docker compose -f docker-compose.prod.yml down -v      # Stop + delete data
```

## Tech Stack

- **Backend**: Node.js + Express + Socket.IO
- **Frontend**: React 19 + Vite + Tailwind CSS 4
- **Database**: SQLite via `better-sqlite3`
- **Deployment**: Docker, Cloudflare Tunnel

## Project Structure

```
├── server/
│   ├── index.js              # Express + Socket.IO server
│   ├── db.js                 # SQLite schema & helpers
│   ├── game-engine.js        # Core game logic
│   ├── socket-handlers.js    # Real-time event handlers
│   ├── special-roles.js      # Special role powers
│   ├── middleware/            # Auth & session middleware
│   └── routes/               # REST API (admin, player, game)
├── client/
│   ├── src/
│   │   ├── pages/            # Admin, Player, Dashboard views
│   │   ├── components/       # Reusable UI components
│   │   ├── hooks/            # Custom React hooks
│   │   └── services/         # Socket.IO & API clients
│   └── vite.config.js
├── docker-compose.yml        # Dev setup
├── docker-compose.prod.yml   # Production setup
└── Dockerfile                # Multi-stage build
```

## Game Rules

See [PITCH.md](PITCH.md) for the full game specification (in French).

## License

[MIT](LICENSE)
