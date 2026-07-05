import { useEffect, useState } from "react"

/**
 * Horodatage qui se met à jour périodiquement, pour re-rendre les
 * composants dépendant de « maintenant » (ex. échéances, barres de
 * progression) en temps réel. Un seul timer partagé par appelant plutôt
 * qu'un par carte affichée.
 */
export function useNow(refreshMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), refreshMs)
    return () => clearInterval(id)
  }, [refreshMs])

  return now
}
