# Plan de développement — Les Immortels

## Contexte

Application web temps réel pour gérer un jeu de Loup-Garou ("Les Immortels") joué sur un week-end avec ~30 joueurs. L'admin (Thomas) contrôle manuellement chaque phase. Aucun code n'existe encore — seuls PITCH.md (spec) et CLAUDE.md (guidelines) sont présents.

**Stack** : Node.js + Express + Socket.IO | React (Vite) + Tailwind CSS | SQLite (better-sqlite3) | Docker Compose + cloudflared

---

## Phase 1 — Scaffolding du projet ✅

Créer la structure complète du projet, installer les dépendances, configurer Vite + Tailwind + Docker.

**Fichiers à créer :**
- `package.json` — dépendances (express, socket.io, better-sqlite3, uuid, cookie-parser, react, react-dom, react-router-dom, socket.io-client, tailwindcss, vite, @vitejs/plugin-react)
- `server/index.js` — Express minimal servant les fichiers statiques du build Vite
- `client/index.html`, `client/src/main.jsx`, `client/src/App.jsx` — React avec BrowserRouter, 3 routes placeholder (`/play`, `/admin`, `/dashboard`)
- `client/vite.config.js` — plugin React, proxy `/api` et `/socket.io` vers le serveur en dev
- `client/tailwind.config.js` — palette sombre : wolf `#8B0000`, villager `#1a1a4e`, ghost `#2d6a4f`, fond `#0d0d0d`
- `client/postcss.config.js`, `client/src/index.css` — directives Tailwind
- `Dockerfile` — multi-stage (build client puis serveur Node)
- `docker-compose.yml` — service app (port 3000, volume `./data`) + service cloudflared
- `.gitignore`, `.env.example`, `.dockerignore`

**Vérification :** `npm run dev` affiche les 3 routes placeholder ; `npm run build && npm start` sert l'app sur le port 3000.

---

## Phase 2 — Base de données SQLite ✅

**Fichier : `server/db.js`**

Créer les 7 tables :

| Table | Rôle |
|-------|------|
| `game_settings` | clé/valeur (game_status, admin_password, current_phase_id, num_wolves, moonless_night, protected_player_id, last_protected_player_id, witch_used, seer_uses_remaining, mayor_id, hunter_pending) |
| `players` | id, name (UNIQUE), role, special_role, status, eliminated_at_phase, eliminated_by, session_token (UNIQUE), score |
| `phases` | id, type (night/village_council), status (pending/active/voting/completed), timestamps |
| `phase_victims` | phase_id, player_id, eliminated_by, was_protected, was_resurrected |
| `votes` | phase_id, voter_id, target_id, vote_type (wolf/ghost_eliminate/village/villager_guess), is_valid |
| `ghost_identifications` | phase_id, ghost_id, target_id, target_is_wolf |
| `challenges` | name, after_phase_id, winning_team_player_ids (JSON), special_role_awarded, awarded_to_player_id, timestamp |

Exports : `getDb()`, `getSetting(key)`, `setSetting(key, value)`, `getAllSettings()`, `resetGame()`.

Pragmas : WAL mode, foreign keys ON. Valeurs par défaut insérées à l'init.

**Vérification :** Au démarrage, `data/game.db` est créé avec les 7 tables et les settings par défaut.

---

## Phase 3 — Fondation serveur ✅

**Fichiers :**
- `server/index.js` — Express + HTTP server + Socket.IO (pingTimeout 60s, pingInterval 25s), middleware JSON/cookie-parser, montage des routes, SPA fallback
- `server/middleware/auth.js` — vérifie `x-admin-password` (header ou cookie) vs `game_settings.admin_password`
- `server/middleware/session.js` — lit le cookie `session_token`, attache `req.player`
- `server/routes/admin.js` — stubs avec middleware auth
- `server/routes/player.js` — `POST /api/player/join { name }` : crée le joueur + session_token (uuid) + cookie
- `server/routes/game.js` — `GET /api/game/state` : retourne game_status, currentPhase, players ; `GET /api/game/health`
- `server/socket-handlers.js` — connexion avec rooms (`player:{id}`, `wolves`, `ghosts`, `admin`, `dashboard`), state sync au connect

**Vérification :** Join crée un joueur, `/api/game/state` retourne l'état, Socket.IO connecte et rejoint les rooms.

---

## Phase 4 — Moteur de jeu (logique pure) ✅

**Fichier : `server/game-engine.js`**

Fonctions exportées :
- **Setup** : `assignRoles(numWolves)` — Fisher-Yates shuffle, N premiers = loups
- **Phases** : `createPhase(type)`, `startPhase(id)`, `openVoting(id)`, `closeVoting(id)`, `getCurrentPhase()`
- **Votes** : `submitVote(phaseId, voterId, targetId, voteType)` — persist immédiat + dédoublonnage ; `getVoteResults(phaseId, voteType)` — décompte trié ; `getVoteDetails(phaseId)` — détail pour admin
- **Résolution nuit** : `resolveNight(phaseId)` → `{ wolfVictim, wolfVoteTie, ghostVictim, protectedPlayerId, wolfVictimProtected, ghostVictimProtected }`
- **Résolution conseil** : `resolveVillageCouncil(phaseId)` — vote double du maire, immunité, égalité (maire tranche ou tirage au sort)
- **Ordre de parole** : `generateSpeechOrder(phaseId)` — shuffle des vivants
- **Élimination** : `eliminatePlayer(playerId, phaseId, eliminatedBy)`, `protectPlayer(playerId)`, `resurrectPlayer(playerId)`
- **Devinette villageois (nuit)** : pendant la nuit, les villageois vivants choisissent un joueur qu'ils pensent être villageois (+1 si juste). Même mécanisme que le vote loup (sélection d'un joueur parmi les vivants), mais le but est de deviner un allié. Sert aussi de camouflage (tout le monde est sur son téléphone). Vote type `villager_guess` stocké dans la table `votes`.
- **Scoring** : `computePhaseScores(phaseId)`, `computeChallengeScores(challengeId)`, `computeFinalScores()`, `getScoreboard()`

Règles d'égalité : Loups → admin tranche | Village → maire ou tirage au sort | Fantômes → tirage au sort.

**Vérification :** Tests unitaires sur chaque fonction avec des données en DB.

---

## Phase 5 — API + interface Admin ✅

**Routes API (`server/routes/admin.js`, toutes protégées par `adminAuth`) :**

| Catégorie | Endpoints |
|-----------|-----------|
| Setup | `POST /players/bulk`, `DELETE /players/:id`, `POST /game/assign-roles`, `POST /game/start`, `GET /players` |
| Phases | `POST /phase/create`, `POST /phase/start`, `POST /phase/open-voting`, `POST /phase/close-voting`, `GET /phase/results`, `POST /phase/reveal`, `POST /phase/skip`, `GET /phase/votes`, `POST /phase/speech-order`, `POST /timer/start` |
| Pouvoirs | `POST /special/trigger`, `POST /special/force` |
| Épreuves | `POST /challenge`, `POST /challenge/assign` |
| Overrides | `PUT /player/:id`, `POST /phase/undo`, `PUT /settings`, `POST /game/reset`, `POST /wolf-tie-break` |

**Interface React (`client/src/pages/admin/`) :**
- `AdminLogin.jsx` — saisie mot de passe, stocké en localStorage
- `AdminPage.jsx` — navigation par onglets + barre status (game_status, phase, nb vivants)
- `SetupTab.jsx` — saisie joueurs (textarea bulk), assignation rôles, bouton démarrer
- `PhaseControlTab.jsx` — création/lancement phase, compteur votes temps réel, résultats, résolution pouvoirs spéciaux dans l'ordre (Protecteur → Sorcière → Voyante), résolution égalité loups, bouton révéler
- `ChallengesTab.jsx` — enregistrer épreuve, attribuer rôle spécial
- `PlayersTab.jsx` — tableau complet avec édition inline (rôle, statut, score, special_role)
- `ScoresTab.jsx` — classement complet, override scores
- `HistoryTab.jsx` — historique votes détaillé par phase
- `SettingsTab.jsx` — édition game_settings, mode test, reset

**Fichiers support :** `client/src/hooks/useAdminSocket.js`, `client/src/services/adminApi.js`

**Vérification :** Parcours complet : login admin → ajout joueurs → assignation rôles → démarrage partie → création/gestion phase.

---

## Phase 6 — API + interface Joueur ✅

**Routes API (`server/routes/player.js` + `server/routes/game.js`) :**
- `POST /api/player/join { name }`, `GET /api/player/me`, `GET /api/game/state`, `GET /api/game/phase/:id`
- `POST /api/player/vote`, `POST /api/player/villager-guess`, `POST /api/player/ghost-identify`
- `GET /api/player/wolves` (loups uniquement, après phase 1)

**Interface React (`client/src/pages/player/`) :**
- `PlayerPage.jsx` — routeur d'écrans basé sur game_status + phase + rôle + statut
- `LoginScreen.jsx` — saisie prénom, zéro friction, gestion collision (+ initiale nom)
- `LobbyScreen.jsx` — attente pré-jeu
- `WaitingScreen.jsx` — statut (vivant/fantôme), liste éliminés, liste loups (si loup après phase 1). **Le rôle n'est PAS réaffiché** — il n'est montré qu'une seule fois au début du jeu (voir `RoleRevealScreen.jsx`)
- `RoleRevealScreen.jsx` — écran unique d'affichage du rôle (loup/villageois) au démarrage du jeu. Affiché une seule fois, avec **protection anti-screenshot** : overlay CSS avec texte animé/clignotant rendant les captures illisibles (watermark dynamique avec le nom du joueur en filigrane, animation CSS rapide `mix-blend-mode`, `filter` alterné). Un bouton "J'ai compris" ferme l'écran définitivement. Le rôle n'est plus accessible ensuite.
- `NightWolfVote.jsx` — sélection d'un villageois vivant, confirmation, compteur partagé X/Y
- `NightVillagerGuess.jsx` — les villageois vivants choisissent un joueur qu'ils pensent être villageois parmi les vivants (hors eux-mêmes). Même UX que le vote loup (sélection + confirmation). +1 point si le joueur choisi est effectivement villageois. Sert aussi de camouflage (tout le monde sur son téléphone). Même compteur partagé X/Y.
- `NightGhostVote.jsx` — vote élimination + cases identification loups (fantômes villageois)
- `VillageCouncilVote.jsx` — sélection joueur à éliminer, affichage immunité si applicable
- `PhaseResultScreen.jsx` — annonce victime + rôle
- `EliminatedScreen.jsx` — transition "Vous êtes devenu un Fantôme"

**Composants réutilisables :** `VoteConfirmation.jsx`, `PlayerCard.jsx`, `CountdownTimer.jsx`
**Context/hooks :** `PlayerContext.jsx`, `usePlayerSocket.js`, `useGameState.js`, `client/src/services/playerApi.js`

**Mobile-first :** targets tactiles 48px min, texte 16px min, boutons action en bas, vibration sur `phase:started`, meta viewport avec viewport-fit=cover.

**Vérification :** Test complet sur mobile : login → lobby → réception rôle → vote nuit (loup/villageois/fantôme) → résultat → vote conseil.

---

## Phase 7 — Dashboard projeté ✅

**Interface React (`client/src/pages/dashboard/`) :**
- `DashboardPage.jsx` — machine à états avec overlays (night, council, result, challenge, timer, end)
- `LobbyDisplay.jsx` — titre + compteur joueurs connectés
- `GameDisplay.jsx` — base persistante : grille vivants (60%) + liste éliminés avec rôle (40%), barre titre/phase/compteur
- `NightDisplay.jsx` — overlay sombre, textes atmosphériques séquentiels, barre de progression votes
- `CouncilDisplay.jsx` — ordre de parole avec speaker surligné + chrono (>10) ou chrono 10min (≤10), animation "VOTE EN COURS"
- `ResultDisplay.jsx` — reveal dramatique : blackout → nom lettre par lettre → badge rôle (rouge LOUP / bleu VILLAGEOIS)
- `ChallengeDisplay.jsx` — équipe gagnante + "Un joueur a reçu un pouvoir spécial !"
- `EndDisplay.jsx` — classement animé du dernier au premier, podium top 3
- `TimerOverlay.jsx` — grand décompte

**Layout :** aspect-ratio 16:9, unités `vw` pour le texte (titre 4vw, noms 1.5vw), fond `#0d0d0d`, pas de scroll.
**Animations CSS :** fadeIn, slideUp, pulseGlow, letterReveal, nightFall.

**Vérification :** Affichage sur moniteur externe 1920×1080, texte lisible à 3m, transitions fluides.

---

## Phase 8 — Intégration Socket.IO complète ✅

**Fichier principal : `server/socket-handlers.js` (réécriture complète) + `server/socket-rooms.js`**

**Événements serveur → client :**

| Événement | Destinataires | Déclencheur |
|-----------|---------------|-------------|
| `lobby:update` | admin | joueur rejoint le lobby |
| `game:started` | tous | admin démarre la partie |
| `phase:started` | tous (payload spécifique par rôle via room perso) | admin lance une phase |
| `phase:vote_update` | admin + dashboard + joueurs (compteur combiné loups+villageois) | chaque vote/réponse |
| `phase:result` | tous | admin révèle les résultats |
| `player:eliminated` | tous | inclus dans le reveal |
| `player:role_assigned` | joueur concerné uniquement | épreuve résolue |
| `wolves:revealed` | loups uniquement | après phase 1 |
| `timer:start` | dashboard + joueurs | admin lance un chrono |
| `game:end` | tous | admin termine la partie |
| `special:prompt` | joueur concerné | admin active un pouvoir |
| `state:sync` | client qui se (re)connecte | à chaque connexion |

**Compteur combiné nuit :** Le compteur public = votes loups + votes villageois "devinette" (pas de distinction) sur total vivants. Les deux types de votes sont stockés dans la table `votes` (types `wolf` et `villager_guess`), donc le compteur survit à un restart serveur.

**Reconnexion :** À chaque connexion, le serveur envoie `state:sync` avec l'état complet (game_status, phase courante, hasVoted, compteurs). Le client se remet en état correct.

**Vérification :** Flux complet admin → joueurs → dashboard en temps réel. Déconnexion/reconnexion mid-phase préserve l'état.

---

## Phase 9 — Rôles spéciaux ✅

**Fichier : `server/special-roles.js`** + modifications dans `game-engine.js`, `routes/admin.js`, pages player.

**6 rôles, flows détaillés :**

1. **Maire** — vote double au conseil ; en cas d'égalité le maire tranche ; succession si éliminé (prompt `mayor_succession` au maire sortant)
2. **Sorcière** — peut ressusciter 1 victime (loups ou fantômes), usage unique ; admin trigger → prompt → réponse Oui/Non → `resurrectPlayer()` ; peut être un loup
3. **Protecteur** — protège un joueur par nuit (pas soi-même, pas le même 2 nuits de suite) ; prompt au début de la nuit ; si victime = protégé → survit ; `last_protected_player_id` pour rotation
4. **Voyante** — voit le rôle d'un joueur, 2 utilisations max, désactivée en nuit sans lune (toggle admin) ; prompt → choix joueur → retour loup/villageois
5. **Chasseur** — quand éliminé (par tout moyen), tue immédiatement un joueur ; scoring +2 si loup, -1 si villageois ; chaîne si la cible est aussi chasseur ; admin peut forcer
6. **Immunité** — immunisé au prochain vote conseil, usage unique, `special_role` remis à NULL après utilisation

**Ordre d'activation nuit :** Protecteur → votes résolus → Sorcière → Voyante → admin révèle.

**Écrans joueur :** `ProtecteurPrompt.jsx`, `SorcierePrompt.jsx`, `VoyantePrompt.jsx`, `ChasseurPrompt.jsx`, `MayorSuccessionPrompt.jsx`
**Admin :** `SpecialRolesPanel.jsx` intégré dans PhaseControlTab — étapes séquentielles avec boutons trigger/skip/force.

**Vérification :** Tester chaque rôle individuellement + scénarios combinés (protecteur sauve victime loups, sorcière ressuscite victime fantômes, chasseur en chaîne).

---

## Phase 10 — Système de scoring ✅

Implémentation complète dans `server/game-engine.js` :

| Condition | Points | Moment |
|-----------|--------|--------|
| Villageois devine un villageois la nuit | +1 | Fin de nuit, si le joueur choisi est effectivement villageois |
| Équipe gagne épreuve | +1 | Enregistrement épreuve, joueurs vivants de l'équipe |
| Survivant final | +3 | Fin de partie |
| Villageois vote contre un loup au conseil | +2 | Fin de conseil (même si le loup n'est pas éliminé) |
| Loup survit au conseil | +1 | Fin de conseil |
| Fantôme villageois identifie un loup | +1 | Fin de nuit |
| Fantôme villageois se trompe | -1 | Fin de nuit |
| Fantôme loup + villageois éliminé par fantômes | +3 | Fin de nuit |
| Chasseur tue un loup | +2 | Activation du chasseur |
| Chasseur tue un villageois | -1 | Activation du chasseur |

Scores invisibles pour les joueurs, visibles pour l'admin. Override admin possible. Révélation en fin de partie avec animation dashboard (classement du dernier au premier, podium top 3).

---

## Phase 11 — Résilience et cas limites ✅

- **`server/state-recovery.js`** — reconstruction état complet depuis SQLite au restart serveur
- **Dédoublonnage votes** — vérification avant insertion
- **Validation entrées** — types, ranges, joueur vivant, phase active, loup ne vote pas pour loup
- **Gestion déconnexion** — `ConnectionStatus.jsx` (vert/jaune/rouge), reconnexion auto Socket.IO
- **Force-close** — joueur absent = abstention
- **Chaîne chasseur** — si la cible du chasseur est aussi chasseur
- **Succession maire** — prompt + timeout + force admin
- **Shutdown gracieux** — `SIGTERM` → fermer server + DB proprement
- **Error handler global** Express

---

## Phase 12 — Déploiement Docker ✅

- `Dockerfile` multi-stage optimisé (build client → serveur prod)
- `docker-compose.yml` avec volume `./data`, variable `TUNNEL_TOKEN`, healthcheck
- `.dockerignore` (node_modules, .git, data/)
- Endpoint `GET /api/game/health`
- Express `trust proxy`, Socket.IO CORS configuré pour le domaine Cloudflare
- Cache headers sur les fichiers statiques Vite (hashés)

---

## Phase 13 — Mode test et polish ✅

**Mode test :**
- Nombre joueurs/loups variable via `game_settings`
- Skip phases
- Bouton Reset (truncate toutes les tables, reset settings, `game:reset` → tous les clients retournent au lobby)

**Logging :** `server/logger.js` — logs structurés JSON par catégorie (VOTE, PHASE, SOCKET, AUTH, SCORE, SPECIAL)

**Polish UI :**
- Transitions entre écrans (fade/slide)
- Toast notifications
- Skeleton loading states
- Safari iOS fixes (100vh, safe area)
- PWA manifest optionnel (Add to Home Screen)

---

## Ordre d'implémentation et dépendances

```
Phase  1: Scaffolding             [aucune dépendance]
Phase  2: Base de données         [1]
Phase  3: Fondation serveur       [1, 2]
Phase  4: Moteur de jeu           [2]
Phase  5: Admin API + UI          [3, 4]
Phase  6: Joueur API + UI         [3, 4, 5]
Phase  7: Dashboard               [3]
Phase  8: Socket.IO               [5, 6, 7]
Phase  9: Rôles spéciaux          [4, 5, 6, 8]
Phase 10: Scoring                 [4, 9]
Phase 11: Résilience              [toutes]
Phase 12: Déploiement             [toutes]
Phase 13: Mode test + polish      [toutes]
```

## Fichiers critiques

- [server/game-engine.js](server/game-engine.js) — coeur de la logique : phases, votes, victimes, scoring, devinette villageois
- [server/db.js](server/db.js) — schéma 7 tables, helpers, migrations
- [server/socket-handlers.js](server/socket-handlers.js) — coordination temps réel admin ↔ joueurs ↔ dashboard
- [client/src/pages/admin/PhaseControlTab.jsx](client/src/pages/admin/PhaseControlTab.jsx) — écran admin le plus complexe (votes, résultats, pouvoirs)
- [client/src/pages/player/PlayerPage.jsx](client/src/pages/player/PlayerPage.jsx) — routeur d'écrans pour les 30 joueurs

## Vérification end-to-end

1. Simulation complète avec 10 joueurs (3 loups) : 4 nuits + 4 conseils + tous les rôles spéciaux
2. Test stress : 30 connexions Socket.IO simultanées, votes rapides
3. Test résilience : restart serveur mid-phase, déconnexion/reconnexion multiple
4. Test dashboard : moniteur externe 1920×1080, lisibilité à 3m
5. Test mobile : Safari iOS + Chrome Android, tactile, vibration
