/**
 * Recherche par mots-clés (façon Google/GitHub) : les mots simples sont
 * combinés en ET (tous doivent apparaître, n'importe où) ; un groupe entre
 * guillemets `"..."` doit apparaître tel quel (phrase exacte, avec espaces).
 */

/** Découpe une requête en termes : guillemets = phrase exacte, sinon mot à mot. */
export function parseSearchTerms(query: string): string[] {
  const terms: string[] = []
  const re = /"([^"]+)"|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(query))) {
    const term = (m[1] ?? m[2]).trim().toLowerCase()
    if (term) terms.push(term)
  }
  return terms
}

/** Vrai si tous les termes de `query` apparaissent (en ET) dans `haystacks`. */
export function matchesSearch(haystacks: string[], query: string): boolean {
  const terms = parseSearchTerms(query)
  if (terms.length === 0) return true
  const combined = haystacks.join(" \n ").toLowerCase()
  return terms.every((term) => combined.includes(term))
}
