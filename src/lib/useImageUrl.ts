import { useEffect, useState } from "react"

import { getImage } from "./repo"

/**
 * Charge une image stockée (blob dans IndexedDB) et renvoie une object URL,
 * révoquée automatiquement au démontage / changement.
 */
export function useImageUrl(imageId: string | undefined): string | undefined {
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    if (!imageId) {
      setUrl(undefined)
      return
    }
    let objectUrl: string | undefined
    let cancelled = false
    getImage(imageId).then((blob) => {
      if (cancelled || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setUrl(undefined)
    }
  }, [imageId])

  return url
}
