# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Les Immortels** is a real-time web app for managing a Werewolf (Loup-Garou) game played over a weekend with ~30 players. The full specification lives in `PITCH.md` (written in French). The full implementation plan lives in `PLAN.md`.

**Core principle:** The admin (Thomas) has total manual control over every step of the game. The app never auto-advances phases. Every result must be validated by the admin before being revealed. The admin can modify any aspect of the game at any time to fix bugs or errors.

## Recommended Tech Stack

- **Backend**: Node.js + Express + Socket.IO
- **Frontend**: React (Vite) served as static files by Express
- **Database**: SQLite via `better-sqlite3` (single file, no external services)
- **CSS**: Tailwind CSS
- **Deployment**: Docker Compose, behind Cloudflare reverse proxy (HTTPS via cloudflared)

## Target Architecture

```
les-immortels/
├── server/
│   ├── index.js            # Express + Socket.IO + static serving
│   ├── db.js               # SQLite init + migrations
│   ├── game-engine.js      # Game logic (phases, votes, scoring)
│   ├── routes/
│   │   ├── admin.js        # Admin API (password-protected)
│   │   ├── player.js       # Player API
│   │   └── game.js         # Game state API
│   └── socket-handlers.js  # Socket.IO event handlers
├── client/                 # React + Vite frontend
│   ├── pages/
│   │   ├── admin/          # Admin control panel
│   │   ├── player/         # Player game interface (mobile-first)
│   │   └── dashboard/      # Projected real-time display (16:9, no interaction)
│   └── components/
├── data/
│   └── game.db             # SQLite file (auto-created)
└── package.json
```

## Three Main Interfaces

1. **`/play`** — Player interface (mobile-first, account login: pseudo + password, session cookie). The pseudo is login-only; every screen displays "Prénom Nom"
2. **`/admin`** — Admin panel (password-protected, Thomas is sole admin, controls all phase transitions, can override anything)
3. **`/dashboard`** — Projected display (read-only, large text, animations, 16:9 optimized)

## Key Game Mechanics

- 29 players: 8 wolves + 21 villagers, ~18 phases across 3 days
- Night = single phase with parallel votes (wolves + villagers guess + ghosts)
- Villagers choose a player they think is a villager at night (+1 if correct) — same UX as wolf vote, serves as camouflage
- **Night vote screens must stay pixel-identical between wolves and villagers**, including the target list, which is every alive player except oneself. A wolf voting for a wolf is stored with `is_valid = 0` rather than rejected: an error message would only ever be seen by a wolf, and a shorter list would leak the role to anyone counting names on a screenshot
- Role is shown behind a press-and-hold gesture and can be re-opened any time via "Ma carte". A screenshot cannot be prevented (no browser API can, and a second phone defeats anything client-side), so the card is instead made worthless as proof: any player can display any role, and the real/fake selector is hidden while the card is held
- A faked wolf card **must** show a decoy pack (`client/src/utils/fakePack.js`): a real wolf card always lists one, so a pack-less Loup card would itself prove the holder is a villager. The decoy must keep the right size, include every publicly exposed wolf, exclude every publicly cleared villager, and stay stable across reloads — `fakePack.test.js` pins all four
- Council phases: speech order + timer (>10 alive) or 10-min free debate (≤10 alive), then vote
- Eliminated players become ghosts who vote each night + villager ghosts can identify wolves
- 6 special roles earned through challenges — one role per player max, challenge teams entered manually by admin
- Night power activation order: Protector → Sorcière → Voyante → then admin reveals results
- Scores are computed automatically but hidden from players until game end

## Database Schema (10 tables)

- **`game_settings`**: key/value store for all game state (current phase, admin password, protected player, witch/seer uses, mayor, etc.)
- **`players`**: id, name (display name, unique), username + password_hash (scrypt) + first_name/last_name for the account, role (wolf/villager), special_role (one max), status (alive/ghost), session_token, score
- **`archived_games`**: finished games serialized to JSON, preserved across resets so players can review them from the end screen
- **`phases`**: id, type (night/village_council), status (pending/active/voting/completed), timestamps
- **`phase_victims`**: phase_id, player_id, eliminated_by, was_protected, was_resurrected (supports multiple victims per phase)
- **`votes`**: phase_id, voter_id, target_id, vote_type (wolf/ghost_eliminate/village/villager_guess), is_valid
- **`ghost_identifications`**: phase_id, ghost_id, target_id, target_is_wolf
- **`challenges`**: name, winning team player IDs, special_role_awarded, awarded_to_player_id
- **`score_snapshots`**: full score backups captured before important mutations
- **`score_events`**: one row per score gain/loss with reason, source, and before/after totals

## Real-Time Communication (Socket.IO)

Server→Client: `lobby:update`, `game:started`, `phase:started`, `phase:vote_update`, `phase:result`, `player:eliminated`, `player:role_assigned`, `wolves:revealed`, `timer:start` (client-side countdown), `game:end`, `special:prompt`

Client→Server: `player:join`, `vote:submit`, `villager:guess`, `ghost:identify`, `special:response`, `admin:start_game`, `admin:start_phase`, `admin:close_votes`, `admin:reveal_result`, `admin:start_timer`

## Resilience Requirements

- All game state must be recoverable from SQLite alone (no critical in-memory-only state) — server restart mid-phase must work
- A whole game can be exported to / imported from a single JSON file (`server/game-archive.js`); the same serializer feeds the player-visible archives
- Votes persisted to DB immediately on receipt — reconnecting players recover state via session token
- Admin can force-close voting, force hunter choice, force any action if a player is unresponsive
- Tie-breaking: admin decides for wolves, random for village/ghosts

## Design Direction

- Dark theme with red (wolves), night-blue (villagers), green (ghosts) accents
- Mobile-first player interface, large projected dashboard
- Confirmation prompts before vote submission (no undo)
- Optional vibration on new phase start (no sound management in app)

## Language

The specification and all game-facing text is in **French**. Code comments and variable names should be in English, but user-facing strings (UI labels, messages) must be in French.
