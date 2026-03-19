# Les Immortels

Application web temps réel pour gérer une partie de Loup-Garou.

## Prérequis

- Docker et Docker Compose installés sur le serveur
- Accès au registre GitHub Container Registry (`ghcr.io`)

## Déploiement sur le serveur

### 1. Se connecter au registre GitHub

```bash
echo "VOTRE_GITHUB_TOKEN" | docker login ghcr.io -u t-lefort --password-stdin
```

> Le token GitHub (Personal Access Token) doit avoir le scope `read:packages`.

### 2. Récupérer la dernière image

```bash
docker pull ghcr.io/t-lefort/immortels:latest
```

### 3. Lancer l'application

Copier `docker-compose.prod.yml` sur le serveur, puis :

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 4. Mettre à jour l'application

```bash
docker pull ghcr.io/t-lefort/immortels:latest
docker compose -f docker-compose.prod.yml up -d
```

Docker Compose recréera automatiquement le conteneur si l'image a changé. Les données SQLite sont persistées dans un volume Docker (`immortels-data`).

### 5. Commandes utiles

```bash
# Voir les logs
docker compose -f docker-compose.prod.yml logs -f

# Redémarrer
docker compose -f docker-compose.prod.yml restart

# Arrêter
docker compose -f docker-compose.prod.yml down

# Arrêter ET supprimer les données
docker compose -f docker-compose.prod.yml down -v
```

## Développement local

```bash
npm install
npm run dev
```

Ou avec Docker :

```bash
docker compose up --build
```

## Build et push de l'image (depuis la machine de dev)

```bash
# Build pour linux/amd64
docker buildx build --platform linux/amd64 -t ghcr.io/t-lefort/immortels:latest .

# Push vers le registre
docker push ghcr.io/t-lefort/immortels:latest
```
