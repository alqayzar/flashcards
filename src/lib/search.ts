/**
 * Recherche par mots-clés (façon Google/GitHub) : les mots simples sont
 * combinés en ET (tous doivent apparaître, n'importe où) ; un groupe entre
 * guillemets `"..."` doit apparaître tel quel (phrase exacte, avec espaces).
 */

export interface SearchOptions {
  /** Respecter la casse (défaut : recherche insensible à la casse). */
  caseSensitive?: boolean
  /** N'accepter le terme que comme mot complet, pas en sous-chaîne d'un autre mot. */
  wholeWord?: boolean
}

/** Découpe une requête en termes : guillemets = phrase exacte, sinon mot à mot. */
export function parseSearchTerms(query: string, caseSensitive = false): string[] {
  const terms: string[] = []
  const re = /"([^"]+)"|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(query))) {
    let term = (m[1] ?? m[2]).trim()
    if (!caseSensitive) term = term.toLowerCase()
    if (term) terms.push(term)
  }
  return terms
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Vrai si tous les termes de `query` apparaissent (en ET) dans `haystacks`. */
export function matchesSearch(
  haystacks: string[],
  query: string,
  options: SearchOptions = {}
): boolean {
  const { caseSensitive = false, wholeWord = false } = options
  const terms = parseSearchTerms(query, caseSensitive)
  if (terms.length === 0) return true

  const combined = haystacks.join(" \n ")
  const text = caseSensitive ? combined : combined.toLowerCase()

  return terms.every((term) => {
    if (!wholeWord) return text.includes(term)
    // Limites de « mot » façon Unicode : ni lettre/chiffre/underscore avant ou après.
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(term)}(?![\\p{L}\\p{N}_])`, "u")
    return re.test(text)
  })
}
