/**
 * Feature cachée (dev/démo) : quand le nom d'un dossier en cours de création
 * vaut exactement `$$test`, des options supplémentaires apparaissent dans
 * FolderDialog pour remplir automatiquement le dossier de flashcards
 * aléatoires (lorem ipsum, tags, cartes inversées et cloze au hasard).
 */
import { createCard, createTag } from "./repo"

export const TEST_FOLDER_TRIGGER = "$$test"

export interface TestSeedOptions {
  cardCount: number
  tagCount: number
  minChars: number
  maxChars: number
  minTagsPerCard: number
  maxTagsPerCard: number
}

const LOREM_WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
  "magna", "aliqua", "enim", "veniam", "quis", "nostrud", "exercitation", "ullamco",
  "laboris", "nisi", "aliquip", "ex", "ea", "commodo", "consequat", "duis", "aute",
  "irure", "reprehenderit", "voluptate", "velit", "esse", "cillum", "fugiat",
  "nulla", "pariatur", "excepteur", "sint", "occaecat", "cupidatat", "non", "proident",
  "sunt", "culpa", "qui", "officia", "deserunt", "mollit", "anim", "id", "est",
  "laborum",
]

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)]
}

/** Tire `count` éléments distincts de `arr` (clampé à sa taille), sans ordre particulier. */
function sampleDistinct<T>(arr: T[], count: number): T[] {
  const n = Math.min(Math.max(0, count), arr.length)
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** `count` noms de tags lorem ipsum aléatoires (un mot, sans doublon). */
function randomTagNames(count: number): string[] {
  const names = new Set<string>()
  let guard = 0
  while (names.size < count && guard < count * 20) {
    names.add(capitalize(pick(LOREM_WORDS)))
    guard++
  }
  return [...names]
}

function capitalizeSentence(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) + "." : s
}

/** Construit un texte lorem ipsum dont la longueur reste entre `min` et `max`. */
function loremWords(min: number, max: number): string[] {
  const hi = Math.max(1, max)
  const lo = Math.max(0, Math.min(min, hi))
  const words = [pick(LOREM_WORDS)]
  let length = words[0].length
  while (length < lo) {
    const w = pick(LOREM_WORDS)
    words.push(w)
    length += 1 + w.length
  }
  while (length > hi && words.length > 1) {
    const removed = words.pop()!
    length -= 1 + removed.length
  }
  if (length > hi) words[0] = words[0].slice(0, hi)
  return words
}

function loremText(min: number, max: number): string {
  return capitalizeSentence(loremWords(min, max).join(" "))
}

/** Texte lorem ipsum avec 1 à 3 mots encadrés en `{{...}}` (cloze). */
function loremClozeText(min: number, max: number): string {
  const words = loremWords(min, max)
  const blankCount = randomInt(1, Math.min(3, Math.max(1, Math.floor(words.length / 3))))
  const indices = new Set<number>()
  while (indices.size < blankCount && indices.size < words.length) {
    indices.add(randomInt(0, words.length - 1))
  }
  const withBlanks = words.map((w, i) => (indices.has(i) ? `{{${w}}}` : w))
  return capitalizeSentence(withBlanks.join(" "))
}

/** Remplit un dossier fraîchement créé avec des flashcards aléatoires. */
export async function seedTestFolder(
  folderId: string,
  options: TestSeedOptions
): Promise<void> {
  const cardCount = Math.min(500, Math.max(0, Math.round(options.cardCount)))
  if (cardCount <= 0) return
  const tagCount = Math.max(0, Math.round(options.tagCount))
  const minChars = Math.max(0, Math.round(options.minChars))
  const maxChars = Math.max(minChars, Math.round(options.maxChars))
  const minTagsPerCard = Math.max(0, Math.round(options.minTagsPerCard))
  const maxTagsPerCard = Math.max(minTagsPerCard, Math.round(options.maxTagsPerCard))

  // Petit pool de tags partagés entre les cartes, façon vrai dossier.
  const tagNames = randomTagNames(tagCount)
  const tagPool = []
  for (const name of tagNames) {
    tagPool.push(await createTag(folderId, name, randomInt(1, 8)))
  }

  for (let i = 0; i < cardCount; i++) {
    const isCloze = Math.random() < 0.25
    const front = isCloze
      ? loremClozeText(minChars, maxChars)
      : loremText(minChars, maxChars)
    const back = loremText(minChars, maxChars)
    const tagsForCard = sampleDistinct(
      tagPool,
      randomInt(
        Math.min(minTagsPerCard, tagPool.length),
        Math.min(maxTagsPerCard, tagPool.length)
      )
    )
    const tagIds = tagsForCard.map((t) => t.id)
    // Une carte cloze génère déjà ses propres cartes liées : pas la peine
    // d'ajouter une carte inversée par-dessus, ça resterait cohérent mais
    // inutilement chargé.
    const createReversed = !isCloze && Math.random() < 0.25
    await createCard(folderId, { front, back, tagIds }, createReversed)
  }
}
