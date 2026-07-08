import { useSyncExternalStore } from "react"

/**
 * Routing par hash (#/…) : choisi car l'app est 100% front-end statique.
 * Aucun serveur → pas de réécriture d'URL nécessaire, rechargement sûr.
 */
function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb)
  return () => window.removeEventListener("hashchange", cb)
}

function getHash() {
  return window.location.hash.replace(/^#/, "") || "/"
}

export function useHashRoute() {
  return useSyncExternalStore(subscribe, getHash, getHash)
}

export function navigate(path: string) {
  window.location.hash = path
}

/** Extrait l'id de dossier d'une route #/folder/{id}(?page=N). */
export function parseRoute(hash: string):
  | { name: "home" }
  | { name: "folder"; folderId: string }
  | { name: "settings" } {
  // `[^/?]+` : s'arrête avant un éventuel `?page=N`, qui ne fait pas partie de l'id
  const folderMatch = hash.match(/^\/folder\/([^/?]+)/)
  if (folderMatch) {
    return { name: "folder", folderId: decodeURIComponent(folderMatch[1]) }
  }
  if (hash.match(/^\/settings\/?$/)) return { name: "settings" }
  return { name: "home" }
}

/** Extrait le paramètre `?page=N` d'un hash (défaut 1 si absent/invalide). */
export function parsePageParam(hash: string): number {
  const match = hash.match(/[?&]page=(\d+)/)
  const page = match ? parseInt(match[1], 10) : 1
  return Number.isFinite(page) && page > 0 ? page : 1
}
