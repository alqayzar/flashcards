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

/** Extrait l'id de dossier d'une route #/folder/{id}. */
export function parseRoute(hash: string):
  | { name: "home" }
  | { name: "folder"; folderId: string }
  | { name: "settings" } {
  const folderMatch = hash.match(/^\/folder\/([^/]+)/)
  if (folderMatch) {
    return { name: "folder", folderId: decodeURIComponent(folderMatch[1]) }
  }
  if (hash.match(/^\/settings\/?$/)) return { name: "settings" }
  return { name: "home" }
}
