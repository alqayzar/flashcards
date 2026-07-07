/**
 * Dépôt de données : CRUD sur folders / tags / cards.
 * Convention de clés (stockage clé-valeur) :
 *   folder:{folderId}
 *   tag:{folderId}:{tagId}
 *   card:{folderId}:{cardId}
 *   image:{imageId}   ({ blob, refCount }, global — non scopé par dossier,
 *                       pour permettre le partage d'une image entre un
 *                       dossier et sa copie sans dupliquer le blob)
 * Ainsi, lister les tags/cards d'un dossier = un simple scan par préfixe.
 */
import {
  kvDelete,
  kvEntriesByPrefix,
  kvGet,
  kvSet,
} from "./idb"
import { uid } from "./id"
import { parseClozeBlanks, stripClozeBraces } from "./cloze"
import type { Card, CardInput, Folder, Tag } from "./types"
import type { CardReviewState } from "./srs/types"

export { uid }

/* ------------------------------- Folders -------------------------------- */

const folderKey = (id: string) => `folder:${id}`

export async function listFolders(): Promise<Folder[]> {
  const entries = await kvEntriesByPrefix<Folder>("folder:")
  return entries.map((e) => e.value).sort((a, b) => a.createdAt - b.createdAt)
}

export async function getFolder(id: string): Promise<Folder | undefined> {
  return kvGet<Folder>(folderKey(id))
}

export async function createFolder(name: string): Promise<Folder> {
  const folder: Folder = { id: uid(), name: name.trim(), createdAt: Date.now() }
  await kvSet(folderKey(folder.id), folder)
  return folder
}

export async function updateFolder(
  id: string,
  patch: Partial<Pick<Folder, "name">>
): Promise<void> {
  const existing = await getFolder(id)
  if (!existing) return
  await kvSet(folderKey(id), { ...existing, ...patch, name: patch.name?.trim() ?? existing.name })
}

/**
 * Duplique un dossier entièrement : ses tags et ses flashcards, en
 * remappant les tagIds vers les nouveaux tags créés. Les images ne sont pas
 * recopiées : la carte dupliquée référence le même blob (compteur de
 * références incrémenté via `retainImage`) — le blob n'est supprimé que
 * lorsque plus aucune carte, dans aucun dossier, ne le référence. La
 * progression de révision (échéances/ease factor) n'est copiée que si
 * `includeReviewState` est vrai — sinon les cartes dupliquées démarrent
 * neuves, comme si elles n'avaient jamais été étudiées.
 */
export async function duplicateFolder(
  folderId: string,
  options: { includeReviewState: boolean }
): Promise<Folder> {
  const source = await getFolder(folderId)
  if (!source) throw new Error(`Dossier "${folderId}" introuvable`)

  const newFolder: Folder = {
    id: uid(),
    name: `${source.name} (copie)`,
    createdAt: Date.now(),
  }
  await kvSet(folderKey(newFolder.id), newFolder)

  // Dupliquer les tags, en gardant une correspondance ancien → nouveau id
  const tags = await listTags(folderId)
  const tagIdMap = new Map<string, string>()
  await Promise.all(
    tags.map(async (t) => {
      const newTag: Tag = {
        id: uid(),
        folderId: newFolder.id,
        name: t.name,
        color: t.color,
        createdAt: t.createdAt,
      }
      tagIdMap.set(t.id, newTag.id)
      await kvSet(tagKey(newFolder.id, newTag.id), newTag)
    })
  )

  // Dupliquer les cartes (en partageant leurs images) et remapper leurs tags
  // + leur éventuel lien reversedFrom (carte inversée) vers les nouveaux ids
  const cards = await listCards(folderId)
  const cardIdMap = new Map<string, string>(cards.map((c) => [c.id, uid()]))
  await Promise.all(
    cards.map(async (c) => {
      await Promise.all([
        c.frontImage ? retainImage(c.frontImage) : Promise.resolve(),
        c.backImage ? retainImage(c.backImage) : Promise.resolve(),
      ])
      const newCard: Card = {
        id: cardIdMap.get(c.id)!,
        folderId: newFolder.id,
        front: c.front,
        back: c.back,
        frontImage: c.frontImage,
        backImage: c.backImage,
        tagIds: c.tagIds
          .map((tagId) => tagIdMap.get(tagId))
          .filter((tagId): tagId is string => !!tagId),
        reversedFrom: c.reversedFrom ? cardIdMap.get(c.reversedFrom) : undefined,
        clozeOf: c.clozeOf ? cardIdMap.get(c.clozeOf) : undefined,
        clozeIndex: c.clozeIndex,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        reviewState:
          options.includeReviewState && c.reviewState
            ? Object.fromEntries(
                Object.entries(c.reviewState).map(([sid, state]) => [
                  sid,
                  { ...state },
                ])
              )
            : undefined,
      }
      await kvSet(cardKey(newFolder.id, newCard.id), newCard)
    })
  )

  return newFolder
}

export async function deleteFolder(id: string): Promise<void> {
  // Supprime le dossier + ses tags + ses cards + son filtre. Les images sont
  // relâchées (pas supprimées à l'aveugle) : une carte dupliquée dans un
  // autre dossier peut encore référencer la même image.
  const [tags, cards] = await Promise.all([
    kvEntriesByPrefix<Tag>(`tag:${id}:`),
    kvEntriesByPrefix<Card>(`card:${id}:`),
  ])
  await Promise.all([
    ...tags.map((t) => kvDelete(t.key)),
    ...cards.map(async (c) => {
      await kvDelete(c.key)
      if (c.value.frontImage) await releaseImage(c.value.frontImage)
      if (c.value.backImage) await releaseImage(c.value.backImage)
    }),
    kvDelete(folderKey(id)),
    kvDelete(filterKey(id)),
  ])
}

/** Supprime tous les dossiers (et donc leurs tags, cartes et images). */
export async function deleteAllFolders(): Promise<void> {
  const folders = await listFolders()
  await Promise.all(folders.map((f) => deleteFolder(f.id)))
}

/* ---------------------------- Filtre (tags actifs) ---------------------- */

const filterKey = (folderId: string) => `filter:${folderId}`

/** Tags actuellement sélectionnés pour filtrer un dossier (persistés). */
export async function getFilter(folderId: string): Promise<string[]> {
  return (await kvGet<string[]>(filterKey(folderId))) ?? []
}

export async function setFilter(
  folderId: string,
  tagIds: string[]
): Promise<void> {
  await kvSet(filterKey(folderId), tagIds)
}

/* --------------------------------- Tags --------------------------------- */

const tagKey = (folderId: string, id: string) => `tag:${folderId}:${id}`

export async function listTags(folderId: string): Promise<Tag[]> {
  const entries = await kvEntriesByPrefix<Tag>(`tag:${folderId}:`)
  return entries.map((e) => e.value).sort((a, b) => a.createdAt - b.createdAt)
}

export async function createTag(
  folderId: string,
  name: string,
  color: number
): Promise<Tag> {
  const tag: Tag = {
    id: uid(),
    folderId,
    name: name.trim(),
    color,
    createdAt: Date.now(),
  }
  await kvSet(tagKey(folderId, tag.id), tag)
  return tag
}

export async function updateTag(
  tag: Tag,
  patch: Partial<Pick<Tag, "name" | "color">>
): Promise<void> {
  await kvSet(tagKey(tag.folderId, tag.id), { ...tag, ...patch })
}

export async function deleteTag(tag: Tag): Promise<void> {
  // Retire le tag et le décroche de toutes les cards du dossier
  const cards = await kvEntriesByPrefix<Card>(`card:${tag.folderId}:`)
  await Promise.all(
    cards
      .filter((c) => c.value.tagIds.includes(tag.id))
      .map((c) =>
        kvSet(c.key, {
          ...c.value,
          tagIds: c.value.tagIds.filter((t) => t !== tag.id),
          updatedAt: Date.now(),
        })
      )
  )
  await kvDelete(tagKey(tag.folderId, tag.id))
}

/* --------------------------------- Cards -------------------------------- */

const cardKey = (folderId: string, id: string) => `card:${folderId}:${id}`

export async function listCards(folderId: string): Promise<Card[]> {
  const entries = await kvEntriesByPrefix<Card>(`card:${folderId}:`)
  return entries.map((e) => e.value).sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Crée la carte inversée liée à `source` (recto/verso permutés, images
 * partagées). Si `source` est un recto à trous (cloze), le verso obtenu
 * affiche le texte en clair (accolades `{{ }}` retirées).
 */
async function createReversedCard(source: Card): Promise<Card> {
  await Promise.all([
    source.frontImage ? retainImage(source.frontImage) : Promise.resolve(),
    source.backImage ? retainImage(source.backImage) : Promise.resolve(),
  ])
  const now = Date.now()
  const reversed: Card = {
    id: uid(),
    folderId: source.folderId,
    front: source.back,
    back: stripClozeBraces(source.front),
    frontImage: source.backImage,
    backImage: source.frontImage,
    tagIds: [...source.tagIds],
    reversedFrom: source.id,
    createdAt: now,
    updatedAt: now,
  }
  await kvSet(cardKey(source.folderId, reversed.id), reversed)
  return reversed
}

/** Crée une carte liée pour le trou `clozeIndex` d'un groupe cloze. */
async function createClozeSibling(
  original: Card,
  clozeIndex: number
): Promise<Card> {
  await Promise.all([
    original.frontImage ? retainImage(original.frontImage) : Promise.resolve(),
    original.backImage ? retainImage(original.backImage) : Promise.resolve(),
  ])
  const now = Date.now()
  const sibling: Card = {
    id: uid(),
    folderId: original.folderId,
    front: original.front,
    back: original.back,
    frontImage: original.frontImage,
    backImage: original.backImage,
    tagIds: [...original.tagIds],
    clozeOf: original.id,
    clozeIndex,
    createdAt: now,
    updatedAt: now,
  }
  await kvSet(cardKey(original.folderId, sibling.id), sibling)
  return sibling
}

/**
 * Crée une carte et, si `createReversed` est vrai, sa carte inversée liée
 * (recto/verso permutés, mêmes tags, images partagées par référence). La
 * carte inversée n'est ni modifiable, ni supprimable, ni duplicable
 * indépendamment — son contenu suit celui de l'originale (voir
 * `updateCard`/`deleteCard`/`duplicateCard`) — mais sa progression de
 * révision lui est propre.
 *
 * Si le recto contient des `{{trous}}`, une carte liée est en plus créée
 * par trou au-delà du premier (même mécanisme de liaison/synchronisation
 * que la carte inversée) — chacune masque un trou différent à l'étude.
 */
export async function createCard(
  folderId: string,
  data: CardInput,
  createReversed = false
): Promise<Card> {
  const now = Date.now()
  const front = data.front.trim()
  const blanks = parseClozeBlanks(front)
  const card: Card = {
    id: uid(),
    folderId,
    front,
    back: data.back.trim(),
    frontImage: data.frontImage,
    backImage: data.backImage,
    tagIds: data.tagIds,
    clozeIndex: blanks.length > 0 ? 0 : undefined,
    createdAt: now,
    updatedAt: now,
  }
  await kvSet(cardKey(folderId, card.id), card)

  for (let i = 1; i < blanks.length; i++) {
    await createClozeSibling(card, i)
  }

  if (createReversed) await createReversedCard(card)

  return card
}

/**
 * Crée la carte inversée liée d'une carte existante qui n'en a pas encore
 * (no-op si elle en a déjà une).
 */
export async function addReverseCard(card: Card): Promise<Card | undefined> {
  const siblings = await listCards(card.folderId)
  if (siblings.some((c) => c.reversedFrom === card.id)) return undefined
  return createReversedCard(card)
}

/** Ajuste le compteur de références quand une image mirroir change. */
async function syncMirroredImage(
  oldId: string | undefined,
  newId: string | undefined
): Promise<void> {
  if (oldId === newId) return
  await Promise.all([
    oldId ? releaseImage(oldId) : Promise.resolve(),
    newId ? retainImage(newId) : Promise.resolve(),
  ])
}

/**
 * Met à jour une carte. Si une carte inversée lui est liée, son contenu
 * (recto/verso/images/tags permutés, « {{ }} » retirés côté verso) est
 * automatiquement synchronisé. Si c'est l'originale d'un groupe cloze
 * (clozeIndex 0), ses cartes liées par trou sont elles aussi resynchro-
 * nisées — recréées ou supprimées si le nombre de `{{trous}}` a changé.
 * Les progressions de révision respectives ne sont jamais affectées.
 */
export async function updateCard(card: Card, data: CardInput): Promise<void> {
  const front = data.front.trim()
  const back = data.back.trim()
  const blanks = parseClozeBlanks(front)

  await kvSet(cardKey(card.folderId, card.id), {
    ...card,
    front,
    back,
    frontImage: data.frontImage,
    backImage: data.backImage,
    tagIds: data.tagIds,
    clozeIndex:
      card.clozeOf !== undefined
        ? card.clozeIndex
        : blanks.length > 0
          ? 0
          : undefined,
    updatedAt: Date.now(),
  })

  const siblings = await listCards(card.folderId)

  const reversed = siblings.find((c) => c.reversedFrom === card.id)
  if (reversed) {
    const newFrontImage = data.backImage
    const newBackImage = data.frontImage
    await Promise.all([
      syncMirroredImage(reversed.frontImage, newFrontImage),
      syncMirroredImage(reversed.backImage, newBackImage),
    ])
    await kvSet(cardKey(reversed.folderId, reversed.id), {
      ...reversed,
      front: back,
      back: stripClozeBraces(front),
      frontImage: newFrontImage,
      backImage: newBackImage,
      tagIds: [...data.tagIds],
      updatedAt: Date.now(),
    })
  }

  // Cartes liées par trou : uniquement synchronisées depuis l'originale
  // d'un groupe cloze (pas depuis un trou lié, non modifiable directement).
  if (card.clozeOf === undefined) {
    const clozeSiblings = siblings
      .filter((c) => c.clozeOf === card.id)
      .sort((a, b) => (a.clozeIndex ?? 0) - (b.clozeIndex ?? 0))
    const neededCount = Math.max(0, blanks.length - 1)

    for (let i = 0; i < neededCount; i++) {
      const existing = clozeSiblings[i]
      if (existing) {
        await Promise.all([
          syncMirroredImage(existing.frontImage, data.frontImage),
          syncMirroredImage(existing.backImage, data.backImage),
        ])
        await kvSet(cardKey(existing.folderId, existing.id), {
          ...existing,
          front,
          back,
          frontImage: data.frontImage,
          backImage: data.backImage,
          tagIds: [...data.tagIds],
          updatedAt: Date.now(),
        })
      } else {
        await createClozeSibling({ ...card, front, back, frontImage: data.frontImage, backImage: data.backImage }, i + 1)
      }
    }

    // Trous retirés du texte : les cartes liées en trop sont supprimées.
    for (let i = neededCount; i < clozeSiblings.length; i++) {
      await deleteCardRaw(clozeSiblings[i])
    }
  }
}

/** Copie brute d'une carte (images partagées par référence). */
async function copyCardRaw(
  card: Card,
  overrides: {
    reversedFrom?: string
    clozeOf?: string
    clozeIndex?: number
  } = {}
): Promise<Card> {
  await Promise.all([
    card.frontImage ? retainImage(card.frontImage) : Promise.resolve(),
    card.backImage ? retainImage(card.backImage) : Promise.resolve(),
  ])
  const now = Date.now()
  const newCard: Card = {
    id: uid(),
    folderId: card.folderId,
    front: card.front,
    back: card.back,
    frontImage: card.frontImage,
    backImage: card.backImage,
    tagIds: [...card.tagIds],
    reversedFrom: overrides.reversedFrom,
    clozeOf: overrides.clozeOf,
    clozeIndex: overrides.clozeIndex,
    createdAt: now,
    updatedAt: now,
  }
  await kvSet(cardKey(card.folderId, newCard.id), newCard)
  return newCard
}

/**
 * Duplique une flashcard au sein du même dossier (recto/verso, tags,
 * images, et son groupe lié le cas échéant : carte inversée, cartes cloze
 * par trou). Les images ne sont pas recopiées : la copie référence le même
 * blob (compteur de références incrémenté via `retainImage`). La
 * progression de révision n'est jamais copiée : la copie démarre neuve,
 * comme si elle n'avait jamais été étudiée.
 */
export async function duplicateCard(card: Card): Promise<Card> {
  const siblings = await listCards(card.folderId)
  const reversed = siblings.find((c) => c.reversedFrom === card.id)
  const clozeSiblings =
    card.clozeOf === undefined
      ? siblings
          .filter((c) => c.clozeOf === card.id)
          .sort((a, b) => (a.clozeIndex ?? 0) - (b.clozeIndex ?? 0))
      : []

  const newCard = await copyCardRaw(card, { clozeIndex: card.clozeIndex })
  for (const sib of clozeSiblings) {
    await copyCardRaw(sib, { clozeOf: newCard.id, clozeIndex: sib.clozeIndex })
  }
  if (reversed) await copyCardRaw(reversed, { reversedFrom: newCard.id })
  return newCard
}

/**
 * Supprime une carte, en relâchant la référence sur ses images attachées
 * (le blob n'est supprimé que si plus aucune carte, dans aucun dossier, ne
 * le référence).
 */
async function deleteCardRaw(card: Card): Promise<void> {
  await Promise.all([
    kvDelete(cardKey(card.folderId, card.id)),
    card.frontImage ? releaseImage(card.frontImage) : Promise.resolve(),
    card.backImage ? releaseImage(card.backImage) : Promise.resolve(),
  ])
}

/**
 * Supprime une carte. Si une carte inversée et/ou des cartes cloze liées
 * (autres trous du même groupe) lui sont liées, elles sont supprimées avec
 * elle (elles ne peuvent pas être gérées indépendamment).
 */
export async function deleteCard(card: Card): Promise<void> {
  const siblings = await listCards(card.folderId)
  const reversed = siblings.find((c) => c.reversedFrom === card.id)
  const clozeSiblings =
    card.clozeOf === undefined
      ? siblings.filter((c) => c.clozeOf === card.id)
      : []

  await deleteCardRaw(card)
  if (reversed) await deleteCardRaw(reversed)
  for (const sib of clozeSiblings) await deleteCardRaw(sib)
}

/**
 * Supprime uniquement la carte inversée liée à `card`, sans toucher à
 * `card` elle-même (no-op si elle n'en a pas).
 */
export async function removeReverseCard(card: Card): Promise<void> {
  const siblings = await listCards(card.folderId)
  const reversed = siblings.find((c) => c.reversedFrom === card.id)
  if (reversed) await deleteCardRaw(reversed)
}

export async function countCards(folderId: string): Promise<number> {
  const entries = await kvEntriesByPrefix<Card>(`card:${folderId}:`)
  return entries.length
}

/**
 * Enregistre le résultat d'une révision pour une stratégie donnée. L'état
 * des autres stratégies (le cas échéant) est préservé intact.
 */
export async function recordCardReview(
  card: Card,
  strategyId: string,
  state: CardReviewState
): Promise<Card> {
  const updated: Card = {
    ...card,
    reviewState: { ...card.reviewState, [strategyId]: state },
    updatedAt: Date.now(),
  }
  await kvSet(cardKey(card.folderId, card.id), updated)
  return updated
}

/**
 * Réinitialise complètement la progression d'une carte pour une stratégie
 * donnée : intervalle, ease factor et échéance sont effacés, comme si la
 * carte n'avait jamais été révisée sous cette stratégie. Les autres
 * stratégies (le cas échéant) ne sont pas affectées.
 */
export async function resetCardDue(
  card: Card,
  strategyId: string
): Promise<Card> {
  const reviewState = { ...card.reviewState }
  delete reviewState[strategyId]
  const updated: Card = { ...card, reviewState, updatedAt: Date.now() }
  await kvSet(cardKey(card.folderId, card.id), updated)
  return updated
}

/* --------------------------------- Images -------------------------------
 * Stockage global (non scopé par dossier), avec un compteur de références :
 * une carte dupliquée (voir duplicateFolder) partage le même blob plutôt
 * que d'en recopier le contenu. Le blob n'est effectivement supprimé que
 * lorsque plus aucune carte, dans aucun dossier, ne le référence.
 * ------------------------------------------------------------------------- */

interface StoredImage {
  blob: Blob
  refCount: number
}

const imageKey = (id: string) => `image:${id}`

/** Stocke un nouveau blob image (une seule référence) et retourne son id. */
export async function putImage(blob: Blob): Promise<string> {
  const id = uid()
  await kvSet<StoredImage>(imageKey(id), { blob, refCount: 1 })
  return id
}

export async function getImage(id: string): Promise<Blob | undefined> {
  const stored = await kvGet<StoredImage>(imageKey(id))
  return stored?.blob
}

/** Incrémente le compteur de références (partage, ex. duplication de carte). */
export async function retainImage(id: string): Promise<void> {
  const stored = await kvGet<StoredImage>(imageKey(id))
  if (!stored) return
  await kvSet<StoredImage>(imageKey(id), {
    ...stored,
    refCount: stored.refCount + 1,
  })
}

/** Décrémente le compteur de références ; supprime le blob à zéro référence. */
export async function releaseImage(id: string): Promise<void> {
  const stored = await kvGet<StoredImage>(imageKey(id))
  if (!stored) return
  if (stored.refCount <= 1) {
    await kvDelete(imageKey(id))
  } else {
    await kvSet<StoredImage>(imageKey(id), {
      ...stored,
      refCount: stored.refCount - 1,
    })
  }
}
