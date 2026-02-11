# Les Immortels — Spécification de l'application web

## Contexte

Application web pour un jeu de Loup-Garou longue durée ("Les Immortels") joué pendant un week-end anniversaire avec ~30 joueurs. L'app gère les votes, les rôles, les phases de jeu, le scoring et un dashboard projeté en temps réel.

**Contraintes d'environnement :**
- Hébergée sur le serveur perso de Thomas, derrière un reverse proxy Cloudflare (HTTPS via cloudflared)
- La connexion peut être instable → l'app doit être résiliente (pas de perte de données si un joueur se déconnecte)
- ~30 joueurs simultanés sur téléphone mobile
- Thomas est le seul administrateur du jeu

**Principe fondamental :** Thomas doit pouvoir faire avancer tout le jeu manuellement et modifier/valider chaque étape. L'admin a un contrôle total sur chaque action pour pouvoir corriger en temps réel s'il y a des bugs ou des imprévus.

---

## Stack technique recommandé

Faire au plus simple et robuste :
- **Backend** : Node.js + Express + Socket.IO (temps réel pour le dashboard et les changements de phase)
- **Frontend** : React (Vite) servi en fichiers statiques par Express — ou Next.js avec custom server
- **Base de données** : SQLite via `better-sqlite3` (fichier unique, aucun service à installer, persistant)
- **CSS** : Tailwind CSS
- **Déploiement** : un docker-compose

Alternative encore plus simple : Express + templates EJS (server-rendered) + Socket.IO + SQLite. Pas de build frontend, mais moins souple pour l'UX.

---

## Architecture

```
les-immortels/
├── server/
│   ├── index.js            # Express + Socket.IO + servir le frontend
│   ├── db.js               # Initialisation SQLite + migrations
│   ├── game-engine.js      # Logique du jeu (phases, votes, scoring)
│   ├── routes/
│   │   ├── admin.js        # Routes API admin (Thomas)
│   │   ├── player.js       # Routes API joueurs
│   │   └── game.js         # Routes API état du jeu
│   └── socket-handlers.js  # Événements Socket.IO
├── client/                 # Frontend React/Vite (ou Next.js)
│   ├── pages/
│   │   ├── admin/          # Interface admin
│   │   ├── player/         # Interface joueur
│   │   └── dashboard/      # Dashboard projeté
│   └── components/
├── data/
│   └── game.db             # Fichier SQLite (créé automatiquement)
└── package.json
```

---

## Modèle de données

### Table `game_settings`

| Colonne | Type | Description |
|---------|------|-------------|
| key | TEXT PK | Clé du paramètre |
| value | TEXT | Valeur (sérialisée en JSON si nécessaire) |

Paramètres stockés : `game_status` (`setup`/`in_progress`/`finished`), `admin_password`, `current_phase_id`, `num_wolves` (mode test), `num_players` (mode test), `moonless_night` (toggle voyante), `protected_player_id` (joueur actuellement protégé), `witch_used` (booléen), `seer_uses_remaining` (compteur, max 2), `mayor_id` (joueur actuel maire), etc. L'admin peut modifier tous ces paramètres à tout moment.

### Table `players`

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | TEXT UNIQUE | Prénom du joueur (+ première lettre du nom de famille si doublon de prénom) |
| role | TEXT | `wolf` ou `villager` |
| special_role | TEXT NULL | `maire`, `chasseur`, `sorciere`, `protecteur`, `voyante`, `immunite`. Un seul rôle spécial par joueur. Si un joueur gagne plusieurs épreuves, il ne peut pas être choisi à nouveau. |
| status | TEXT | `alive`, `ghost` |
| eliminated_at_phase | INTEGER NULL | Numéro de la phase où le joueur a été éliminé |
| eliminated_by | TEXT NULL | `wolves`, `ghosts`, `village`, `chasseur` |
| session_token | TEXT | Token unique pour identifier le joueur (cookie) |
| score | INTEGER DEFAULT 0 | Score accumulé |

### Table `phases`

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER PK | Numéro de phase (1, 2, 3...) |
| type | TEXT | `night`, `village_council` |
| status | TEXT | `pending`, `active`, `voting`, `completed` |
| timestamp_start | DATETIME | Début de la phase |
| timestamp_end | DATETIME NULL | Fin de la phase |

### Table `phase_victims`

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER PK | Auto-increment |
| phase_id | INTEGER | FK → phases.id |
| player_id | INTEGER | FK → players.id (joueur éliminé) |
| eliminated_by | TEXT | `wolves`, `ghosts`, `village`, `chasseur` |
| was_protected | BOOLEAN DEFAULT 0 | Si le joueur a été sauvé par le protecteur |
| was_resurrected | BOOLEAN DEFAULT 0 | Si le joueur a été ressuscité par la sorcière |

### Table `votes`

Tous les votes réels sont stockés, y compris les devinettes des villageois la nuit.

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER PK | Auto-increment |
| phase_id | INTEGER | FK → phases.id |
| voter_id | INTEGER | FK → players.id |
| target_id | INTEGER NULL | FK → players.id (NULL si abstention) |
| vote_type | TEXT | `wolf`, `ghost_eliminate`, `village`, `villager_guess` |
| is_valid | BOOLEAN | Le vote a-t-il été compté |

### Table `ghost_identifications`

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER PK | Auto-increment |
| phase_id | INTEGER | FK → phases.id (phase de nuit) |
| ghost_id | INTEGER | FK → players.id (le fantôme villageois qui identifie) |
| target_id | INTEGER | FK → players.id (le joueur sélectionné) |
| target_is_wolf | BOOLEAN | Vrai si la cible est effectivement un loup |

### Table `challenges`

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Nom de l'épreuve (ex: "Kahoot vendredi soir") |
| after_phase_id | INTEGER NULL | FK → phases.id (après quelle phase l'épreuve a lieu) |
| winning_team_player_ids | TEXT | JSON array des IDs des joueurs de l'équipe gagnante |
| special_role_awarded | TEXT | Rôle spécial attribué (`maire`, `sorciere`, etc.) |
| awarded_to_player_id | INTEGER NULL | FK → players.id (joueur qui a reçu le rôle) |
| timestamp | DATETIME | Quand l'épreuve a été enregistrée |

---

## Rôles et pouvoirs

### Rôles de base
- **Loup** (8 joueurs) : vote chaque nuit pour éliminer un villageois, peut communiquer discrètement avec les autres loups en journée
- **Villageois** (21 joueurs) : vote au conseil du village pour éliminer un suspect

### Rôles spéciaux (gagnés via les épreuves)

Chaque épreuve gagnée attribue un rôle spécial à un membre aléatoire de l'équipe gagnante (ou choisi manuellement par Thomas). Le joueur peut être loup ou villageois — le pouvoir est additif (il garde son rôle de base). **Un joueur ne peut avoir qu'un seul rôle spécial.** Si un joueur a déjà un rôle spécial, il ne peut pas être sélectionné à nouveau.

| Rôle | Épreuve | Pouvoir | Impact scoring |
|------|---------|---------|----------------|
| **Maire** | Vendredi soir | Son vote au conseil compte double | — |
| **Sorcière** | Samedi matin | Peut ressusciter une personne tuée par les loups ou les fantômes (usage unique). Peut être un loup. | — |
| **Protecteur** | Samedi après-midi | Protège un joueur différent chaque jour du vote des loups et des fantômes. Ne peut pas se protéger lui-même. Peut être un loup. | — |
| **Voyante** | Samedi après-midi | Peut voir le rôle (loup/villageois) d'un joueur. Utilisable 2 fois maximum. Ne fonctionne pas pendant une nuit sans lune (à définir par Thomas). | — |
| **Chasseur** | Samedi soir | Quand il est éliminé, il peut tuer immédiatement un joueur de son choix. Peut être un loup. | +2 si tue un loup, -1 si tue un villageois |
| **Immunité conseil** | Dimanche matin | Immunisé au prochain vote du conseil du village. | — |

### Fantômes (joueurs éliminés)

Quand un joueur est éliminé (par les loups, les fantômes ou le village), son rôle est **révélé publiquement** et il devient un fantôme.

**Pouvoirs des fantômes :**
1. **Vote d'élimination** : chaque nuit, chaque fantôme vote individuellement (sans se concerter) pour éliminer un joueur vivant. Majorité gagne, égalité = hasard.
2. **Identification (fantômes villageois uniquement)** : chaque nuit, le fantôme villageois peut sélectionner autant de joueurs vivants qu'il veut comme "suspects loups". +1 point par loup correctement identifié, -1 par erreur.

---

## Déroulement des phases

### Séquence complète du jeu

L'admin (Thomas) fait avancer manuellement chaque phase. L'app ne passe jamais automatiquement à la phase suivante.

**Note :** Le décompte de joueurs ci-dessous est indicatif (scénario idéal sans intervention du protecteur, de la sorcière ou du chasseur). En réalité, le nombre de survivants peut varier. La séquence de 18 phases est un guide — Thomas adapte si nécessaire.

```
Phase 1  : [NUIT]     Loups votent (pas encore de fantômes) .................. ~29 → ~28
Phase 2  : [VILLAGE]  Conseil du village .................................... ~28 → ~27
           [ÉPREUVE]  Épreuve vendredi soir (Kahoot → rôle Maire)
Phase 3  : [NUIT]     Loups + Fantômes votent ............................... ~27 → ~25
Phase 4  : [VILLAGE]  Conseil du village .................................... ~25 → ~24
           [ÉPREUVE]  Épreuve samedi matin (→ rôle Sorcière)
Phase 5  : [NUIT]     Loups + Fantômes votent ............................... ~24 → ~22
Phase 6  : [VILLAGE]  Conseil du village .................................... ~22 → ~21
Phase 7  : [NUIT]     Loups + Fantômes votent ............................... ~21 → ~19
Phase 8  : [VILLAGE]  Conseil du village .................................... ~19 → ~18
           [ÉPREUVE]  Épreuve samedi après-midi (→ rôle Protecteur ou Voyante)
Phase 9  : [NUIT]     Loups + Fantômes votent ............................... ~18 → ~16
Phase 10 : [VILLAGE]  Conseil du village .................................... ~16 → ~15
Phase 11 : [NUIT]     Loups + Fantômes votent ............................... ~15 → ~13
Phase 12 : [VILLAGE]  Conseil du village .................................... ~13 → ~12
           [ÉPREUVE]  Épreuve samedi soir (cuisine → rôle Chasseur)
Phase 13 : [NUIT]     Loups + Fantômes votent ............................... ~12 → ~10
Phase 14 : [VILLAGE]  Conseil du village .................................... ~10 → ~9
Phase 15 : [NUIT]     Loups + Fantômes votent ............................... ~9 → ~7
           [ÉPREUVE]  Épreuve dimanche matin (→ Immunité conseil)
Phase 16 : [VILLAGE]  Conseil du village .................................... ~7 → ~6
Phase 17 : [NUIT]     Loups + Fantômes votent ............................... ~6 → ~4
Phase 18 : [VILLAGE]  Conseil du village (FINAL) ............................ ~4 → ~3
```

**Note :** Les épreuves sont gérées hors de l'app. Thomas entre manuellement dans l'app l'équipe gagnante et les joueurs qui composaient l'équipe (pour le scoring). Le joueur qui reçoit le rôle spécial est tiré au hasard parmi les joueurs vivants de l'équipe, ou choisi manuellement par Thomas.

### Phase de nuit — Déroulement détaillé

Chaque nuit est **une seule phase** dans laquelle les votes des vivants et des fantômes se déroulent en parallèle.

Quand l'admin lance une phase de nuit :

1. **Tous les joueurs vivants** voient un écran de vote sur leur téléphone
2. Les **loups** voient la liste des joueurs vivants (hors loups) et sélectionnent un nom
3. Les **villageois** voient la liste des joueurs vivants (hors eux-mêmes) et choisissent un joueur qu'ils pensent être villageois (devinette). Même UX que le vote loup (sélection d'un joueur + confirmation). **+1 point si le joueur choisi est effectivement villageois.** Sert aussi de **camouflage** — tout le monde est sur son téléphone, il est impossible de distinguer loups et villageois.
4. L'admin voit en temps réel combien de joueurs ont voté (le compteur englobe loups + villageois devinette, sans distinction)
5. **En parallèle, les fantômes** votent pour éliminer quelqu'un (chacun sélectionne un joueur vivant). Un **délai court** est imposé pour voter, afin d'éviter que les fantômes se concertent physiquement.
6. **Les fantômes villageois** peuvent en plus sélectionner des joueurs qu'ils soupçonnent d'être des loups (case à cocher sur chaque joueur vivant)
7. Quand tous ont voté (ou que l'admin force la clôture), l'app calcule les résultats et les affiche à l'admin :
   - Victime des loups (majorité)
   - Victime des fantômes (majorité, hasard si égalité)
8. **L'admin valide les résultats** avant de les révéler — il peut intervenir si nécessaire

#### Activation des pouvoirs spéciaux pendant la nuit

Après la clôture des votes, **avant la révélation publique**, l'admin gère les pouvoirs dans cet ordre :

1. **Protecteur** : si actif, l'admin voit qui est protégé. Si la victime des loups ou des fantômes est le joueur protégé → la victime survit.
2. **Sorcière** : si la sorcière n'a pas encore utilisé son pouvoir, l'admin peut déclencher l'écran de la sorcière. La sorcière voit le nom de la victime et choisit de ressusciter ou non.
3. **Voyante** : si active et si ce n'est pas une nuit sans lune (toggle admin), l'admin peut déclencher l'écran de la voyante. La voyante choisit un joueur et voit son rôle (loup/villageois). 2 utilisations max dans la partie.
4. L'admin révèle les résultats finaux (après résolution des protections/résurrections)

**Important — Phase 1 (première nuit) :**
- Il n'y a pas encore de fantômes, donc seuls les loups et villageois participent
- Après cette phase, les loups se découvrent entre eux : l'app leur affiche la liste des autres loups

### Conseil du village — Déroulement détaillé

Quand l'admin lance un conseil du village :

1. **Si >10 joueurs vivants** :
   - L'app tire un ordre de parole aléatoire parmi les joueurs vivants
   - L'admin affiche l'ordre de parole (sur le dashboard)
   - Un **chronomètre** configurable se lance pour chaque joueur (ex : 30s ou 1min)
   - Après tous les tours de parole, l'admin ouvre le vote

2. **Si ≤10 joueurs vivants** :
   - L'admin lance un **chrono de 10 minutes** de débat libre (affiché sur le dashboard)
   - À la fin du chrono, l'admin ouvre le vote

3. **Vote** : Chaque joueur vivant sélectionne un joueur à éliminer. Le joueur avec le plus de votes est éliminé. En cas d'égalité, le maire tranche (s'il n'y a pas de maire, tirage au sort automatique).

4. Le rôle de l'éliminé est révélé publiquement.

5. **Si le maire est éliminé** : un écran spécial s'affiche sur le téléphone du maire sortant pour qu'il désigne son successeur parmi les joueurs vivants. L'admin peut forcer le choix si le maire ne répond pas.

---

## Scoring — Calcul automatique

Les scores sont calculés automatiquement par l'app à chaque fin de phase. **Les scores restent invisibles pour tous les joueurs** pendant toute la durée du jeu. Seul l'admin peut les consulter.

### Règles de scoring

| Condition | Points | Quand c'est calculé |
|-----------|--------|---------------------|
| Villageois devine un villageois la nuit | +1 | Fin de nuit, si le joueur choisi est effectivement villageois |
| Équipe gagne une épreuve | +1 | Quand l'admin entre le résultat de l'épreuve (uniquement joueurs vivants de l'équipe) |
| Survivant final | +3 | Fin de la partie |
| Villageois vote contre un loup au conseil | +2 | Fin de chaque conseil, pour chaque villageois vivant ayant voté pour un loup (même si le loup n'est pas éliminé) |
| Loup survit à un conseil du village | +1 | Fin de chaque conseil, pour chaque loup vivant non éliminé |
| Fantôme villageois identifie un loup | +1 par loup sélectionné | Fin de chaque nuit |
| Fantôme villageois se trompe | -1 par villageois sélectionné | Fin de chaque nuit |
| Fantôme loup : villageois éliminé par les fantômes pour lequel il a voté | +3 | Fin de chaque nuit, si la victime fantôme est un villageois ET que le fantôme loup avait voté pour cette personne |
| Chasseur tue un loup | +2 | Quand le chasseur utilise son pouvoir |
| Chasseur tue un villageois | -1 | Quand le chasseur utilise son pouvoir |

---

## Interfaces

### 1. Interface joueur (`/play`)

**Accès** : chaque joueur se connecte avec son prénom. Si deux joueurs ont le même prénom, on ajoute la première lettre du nom de famille (ex: "Thomas L."). Un token de session est stocké en cookie pour le reconnaître.

**Écrans :**

#### Écran de pré-jeu (lobby)
- Affiché avant que l'admin ne lance la partie
- Le joueur entre son nom et attend
- L'admin voit la liste des joueurs connectés en temps réel et peut lancer la partie quand tout le monde est prêt

#### Écran de révélation du rôle
- Affiché **une seule fois** au démarrage du jeu, quand l'admin lance la partie
- Montre le rôle du joueur (loup ou villageois) avec **protection anti-screenshot** : overlay CSS avec watermark dynamique (nom du joueur en filigrane, animation rapide, `mix-blend-mode`)
- Un bouton "J'ai compris" ferme l'écran définitivement
- **Le rôle n'est plus accessible ensuite** — le joueur doit le retenir

#### Écran d'attente
- Affiché quand aucune phase n'est en cours
- Montre : le statut du joueur (vivant/fantôme), la liste des joueurs éliminés et leur rôle
- Si le joueur est loup et que la phase 1 est passée : affiche la liste des autres loups
- Si le joueur a un rôle spécial : affiche le détail de son pouvoir
- **Le rôle de base (loup/villageois) n'est PAS réaffiché** sur cet écran

#### Écran de vote — Nuit (joueur vivant)
- **Si loup** : Liste des joueurs vivants (hors loups) avec sélection d'un seul joueur + bouton "Voter"
- **Si villageois** : Liste des joueurs vivants (hors soi-même) — le villageois choisit un joueur qu'il pense être villageois (devinette). Même UX que le vote loup (sélection + confirmation). +1 point si correct. Sert de camouflage : tout le monde est sur son téléphone.
- Indicateur : "En attente des votes... X/Y ont voté" (compteur commun loups + villageois devinette, sans distinction)
- Le joueur ne peut pas changer son vote après envoi

#### Écran de vote — Nuit (fantôme)
- **Vote d'élimination** : Liste des joueurs vivants, sélectionner un joueur à éliminer
- **Identification (fantôme villageois uniquement)** : Cases à cocher sur chaque joueur vivant. Le fantôme coche ceux qu'il pense être des loups. Il peut en cocher 0, 1, ou autant qu'il veut.
- Bouton "Valider"

#### Écran de vote — Conseil du village (joueur vivant)
- Liste de tous les joueurs vivants (sauf soi-même)
- Sélectionner un joueur + bouton "Voter"

#### Écran de résultat de phase
- Annonce de la victime (nom + rôle révélé)
- Si le joueur est éliminé : message "Vous êtes devenu un Fantôme" avec explication des nouvelles mécaniques

#### Écran pouvoir spécial (quand applicable)
- **Sorcière** : "Voulez-vous ressusciter [victime] ?" → Oui / Non
- **Voyante** : "Choisissez un joueur pour voir son rôle" → Liste des joueurs → Affiche "Loup" ou "Villageois"
- **Chasseur** (quand éliminé) : "Vous pouvez éliminer un joueur" → Liste des joueurs → Confirmer
- **Protecteur** : "Qui voulez-vous protéger ce soir ?" → Liste (sauf lui-même, sauf celui protégé la veille)

### 2. Interface admin (`/admin`)

**Accès** : protégé par un mot de passe simple (configuré au démarrage).

**Fonctionnalités :**

#### Setup du jeu
- Entrer la liste des 29 joueurs (noms)
- Lancer la distribution aléatoire des rôles (8 loups, 21 villageois)
- Voir la liste complète : qui est quoi (seul Thomas voit ça)

#### Contrôle des phases
- Bouton "Lancer la phase suivante" avec le type de phase affiché (Nuit / Conseil / Épreuve)
- Possibilité de sauter une phase ou d'en modifier l'ordre si besoin
- Pendant une phase active :
  - Voir le nombre de votes reçus / attendus (en temps réel)
  - Bouton "Forcer la clôture" (si quelqu'un ne vote pas)
  - Voir le résultat des votes (détaillé : qui a voté pour qui)
  - Bouton "Révéler le résultat" (l'envoie sur le dashboard et aux joueurs)

#### Gestion des épreuves
- Entrer le résultat d'une épreuve : sélectionner l'équipe gagnante
- Attribuer un rôle spécial : le système tire un membre au hasard de l'équipe gagnante, ou Thomas choisit manuellement

#### Gestion des rôles spéciaux
- Voir qui a quel rôle spécial
- Activer un pouvoir spécial quand le joueur le demande (ex : la sorcière veut ressusciter quelqu'un)

#### Scoring
- Voir le classement complet en temps réel (tous les scores)
- Bouton "Révéler les scores" en fin de partie

#### Historique
- Consulter les votes détaillés de chaque phase passée (qui a voté pour qui)
- Historique des actions admin (pour traçabilité)

#### Gestion d'urgence — Contrôle total
L'admin doit pouvoir modifier n'importe quel aspect du jeu pour corriger des bugs ou des erreurs en temps réel :
- Modifier le rôle ou le rôle spécial d'un joueur
- Annuler la dernière phase
- Réintégrer un joueur éliminé par erreur
- Modifier un score manuellement
- Modifier les paramètres de jeu (`game_settings`)
- Forcer un résultat de vote

### 3. Dashboard projeté (`/dashboard`)

**Affiché sur un écran/vidéoprojecteur** visible par tout le monde. Pas d'interaction, affichage uniquement.

**Éléments affichés :**

#### En permanence
- Titre du jeu "Les Immortels" et branding visuel
- Nombre de joueurs vivants / total
- Liste des joueurs vivants (noms)
- Liste des joueurs éliminés (noms + rôle révélé : loup/villageois)
- Phase actuelle (Nuit / Conseil / Attente / Épreuve)

#### Pendant un conseil du village
- Si >10 joueurs : ordre de parole avec le joueur actuel en surbrillance + chronomètre individuel
- Si ≤10 joueurs : chrono de 10 minutes décomptant
- Animation "Vote en cours" quand le vote est ouvert
- Résultat : nom de l'éliminé + révélation du rôle (avec animation)

#### Pendant une nuit
- Animation "La nuit tombe..." / "Les loups chassent..." / "Les fantômes rôdent..."
- Indicateur de progression des votes (barre de progression, pas de détails)
- Résultat : victime(s) de la nuit + révélation du rôle

#### Annonce de résultat d'épreuve
- Afficher l'équipe gagnante
- Afficher "Un joueur de l'équipe a reçu un rôle spécial !" (sans dire qui ni quel rôle)

---

## Temps réel (Socket.IO)

### Événements serveur → client

| Événement | Payload | Destinataires |
|-----------|---------|---------------|
| `lobby:update` | `{ connectedPlayers: [{ id, name }] }` | Admin (pré-jeu) |
| `game:started` | `{ playerCount }` | Tous |
| `phase:started` | `{ phaseId, type, alivePlayers }` | Tous |
| `phase:vote_update` | `{ votedCount, totalExpected }` | Admin + Dashboard |
| `phase:result` | `{ victims: [{ name, role }], phase }` | Tous |
| `player:eliminated` | `{ playerId, name, role, eliminatedBy }` | Tous |
| `player:role_assigned` | `{ specialRole, description }` | Le joueur concerné uniquement |
| `wolves:revealed` | `{ wolfNames: [...] }` | Les loups uniquement (après phase 1) |
| `timer:start` | `{ duration, label }` | Dashboard (le décompte est géré côté client) |
| `game:end` | `{ winners, scores }` | Tous (fin de partie) |
| `special:prompt` | `{ type, data }` | Joueur concerné (sorcière, voyante, chasseur, protecteur, maire sortant) |

### Événements client → serveur

| Événement | Payload | Émetteur |
|-----------|---------|----------|
| `player:join` | `{ name }` | Joueurs (pré-jeu) |
| `vote:submit` | `{ phaseId, targetId }` | Joueurs (loups, fantômes, village) |
| `villager:guess` | `{ phaseId, targetId }` | Villageois (devinette nuit — choisit un joueur qu'il pense être villageois) |
| `ghost:identify` | `{ phaseId, targetIds: [...] }` | Fantômes villageois |
| `special:response` | `{ type, data }` | Joueur concerné (réponse sorcière, voyante, chasseur, protecteur, maire) |
| `admin:start_game` | `{}` | Admin |
| `admin:start_phase` | `{ phaseType }` | Admin |
| `admin:close_votes` | `{ phaseId }` | Admin |
| `admin:reveal_result` | `{ phaseId }` | Admin |
| `admin:start_timer` | `{ duration }` | Admin |

---

## Résilience et cas limites

### Déconnexion d'un joueur
- Les votes sont persistés en base dès réception. Si un joueur se déconnecte et se reconnecte, son token de session le ré-identifie et il retrouve l'état actuel de la phase.
- Si un joueur ne vote pas, l'admin peut forcer la clôture de la phase (le joueur est compté comme abstention).

### Égalités
- **Vote des loups** : si égalité, l'admin tranche (ou tirage au sort dans l'app)
- **Vote du village** : tirage au sort automatique
- **Vote des fantômes** : tirage au sort automatique

### Protecteur et Sorcière
- Si le protecteur protège la victime des loups : la victime survit (l'app annonce "personne n'a été éliminé par les loups cette nuit")
- Si le protecteur protège la victime des fantômes : idem
- Si la sorcière ressuscite quelqu'un : le joueur redevient vivant (son statut repasse à `alive`)
- La sorcière ne peut utiliser son pouvoir qu'une seule fois dans toute la partie

### Chasseur
- Quand le chasseur est éliminé (par n'importe quel moyen), l'app interrompt le flux pour lui demander qui il veut tuer
- Si le chasseur ne répond pas, l'admin peut forcer le choix ou passer
- Le joueur tué par le chasseur est éliminé immédiatement et son rôle est révélé
- Le scoring du chasseur est appliqué (+2 si loup, -1 si villageois)

### Redémarrage du serveur
- L'intégralité de l'état du jeu doit être reconstituable depuis la base SQLite (pas d'état critique en mémoire uniquement)
- Si le serveur redémarre en pleine phase, les votes déjà enregistrés sont conservés et la phase reprend là où elle en était

### Fin de partie
- La partie se termine quand l'admin le décide (normalement quand il reste 3 joueurs)
- L'admin appuie sur "Fin de partie"
- Les scores finaux sont calculés (+3 pour les survivants)
- Le classement est affiché (sur le dashboard ou dans l'admin, au choix de Thomas)

---

## Design / UX

### Thème visuel
- **Couleurs** : fond sombre (nuit), accents rouge sang (loups), bleu nuit (villageois), vert fantôme
- **Ambiance** : mystérieuse, type série Canal+
- **Mobile-first** : l'interface joueur doit être parfaitement utilisable sur téléphone
- **Dashboard** : optimisé pour un écran large (16:9), gros texte lisible de loin, animations fluides

### Principes UX
- **Zéro friction** : le joueur se connecte avec son prénom, pas de mot de passe, pas d'inscription
- **Clarté** : à chaque instant, le joueur doit savoir ce qu'on attend de lui
- **Confirmation des votes** : demander "Êtes-vous sûr ?" avant de valider un vote (pas de retour en arrière)
- **Feedback immédiat** : vibration quand une nouvelle phase commence (si le navigateur le supporte). Pas de gestion de son dans l'app (musique d'ambiance gérée séparément sur une enceinte)

---

## Pour tester (soirée test avec ~10 personnes)

L'app devrait supporter un "mode test" avec des paramètres ajustables :
- Nombre de joueurs variable (pas forcément 29)
- Nombre de loups variable
- Possibilité de sauter des phases
- Bouton "Reset" qui remet le jeu à zéro
- Logs détaillés en console pour le debug