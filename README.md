# Nocturne Academia — Flashcards

Application de flashcards **100 % front-end** (aucun back-end). Thème sombre
académique avec des accents « candy-pop ».

## Stack

- **React 19** + **TypeScript**
- **Vite 8**
- **Tailwind CSS v4** + composants **shadcn/ui** (Radix)
- **IndexedDB** (stockage clé-valeur, sans limite de taille — pas de localStorage)

## Lancer

```bash
npm install
npm run dev      # serveur de développement
npm run build    # build de production (tsc + vite)
npm run preview  # prévisualiser le build
```

## Concepts

- **Dossier** (`{ id, name }`) — unité d'organisation indépendante.
- **Flashcard** (`{ id, folderId, front, back, tagIds[] }`) — un recto, un verso,
  et une liste de tags.
- **Tag** (`{ id, folderId, name, color }`) — isolé par dossier (chaque dossier a
  ses propres tags), sert à filtrer les flashcards.

## Architecture

| Fichier | Rôle |
| --- | --- |
| `src/lib/idb.ts` | Wrapper clé-valeur générique au-dessus d'IndexedDB |
| `src/lib/repo.ts` | CRUD folders / tags / cards (clés `folder:`, `tag:{folderId}:`, `card:{folderId}:`) |
| `src/lib/useHashRoute.ts` | Routing par hash (`#/`, `#/folder/{id}`) — adapté à un hébergement statique |
| `src/lib/candy.ts` | Palette candy-pop des tags |
| `src/pages/HomePage.tsx` | Liste + création de dossiers |
| `src/pages/FolderPage.tsx` | Filtre par tags, grille de cartes, mode révision |

### Choix de routing

Routing **par hash** (`#/folder/{id}`) : l'app étant statique et sans serveur,
le hash évite toute réécriture d'URL côté serveur et rend le rechargement sûr
sur n'importe quel hébergeur.

## Fonctionnalités

- Créer / renommer / supprimer des dossiers (suppression en cascade des cartes et tags).
- Créer / modifier / supprimer des flashcards, avec création de tags à la volée.
- Filtrer les cartes par tags (union : au moins un tag sélectionné).
- Retourner une carte (recto/verso) et **mode révision** plein écran (mélange, clavier).
