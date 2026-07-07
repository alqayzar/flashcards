/**
 * Texte à trous (cloze) : un recto écrit avec des `{{mot}}` génère plusieurs
 * cartes liées, une par trou (indexées par ordre d'apparition dans le
 * texte) — chacune masque son propre trou et affiche les autres en clair.
 */

export interface ClozeBlank {
  start: number
  end: number
  /** contenu du trou, sans les accolades */
  text: string
}

/** Repère tous les `{{...}}` d'un texte, dans l'ordre d'apparition. */
export function parseClozeBlanks(text: string): ClozeBlank[] {
  const blanks: ClozeBlank[] = []
  const re = /\{\{(.+?)\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    blanks.push({ start: m.index, end: m.index + m[0].length, text: m[1] })
  }
  return blanks
}

/** Nombre de trous `{{...}}` dans un texte. */
export function countClozeBlanks(text: string): number {
  return parseClozeBlanks(text).length
}

/**
 * Rend un texte à trous pour l'affichage : le trou `activeIndex` est masqué
 * (« [...] ») si `masked` est vrai, tous les autres trous apparaissent en
 * clair (accolades retirées) — comme les autres numéros de cloze chez Anki.
 */
export function renderClozeText(
  text: string,
  activeIndex: number,
  masked: boolean
): string {
  const blanks = parseClozeBlanks(text)
  let out = ""
  let cursor = 0
  blanks.forEach((b, i) => {
    out += text.slice(cursor, b.start)
    out += i === activeIndex && masked ? "[...]" : b.text
    cursor = b.end
  })
  out += text.slice(cursor)
  return out
}

/** Retire toutes les accolades `{{ }}` d'un texte (garde le contenu en clair). */
export function stripClozeBraces(text: string): string {
  return text.replace(/\{\{(.+?)\}\}/g, "$1")
}
