import { useRef } from "react"
import { ImagePlus, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useImageUrl } from "@/lib/useImageUrl"
import { Button } from "@/components/ui/button"

/** État de l'image d'une face dans le formulaire de carte. */
export type ImgState =
  | { kind: "none" }
  | { kind: "existing"; id: string }
  | { kind: "new"; file: File; url: string }

interface ImageFieldProps {
  value: ImgState
  onChange: (next: ImgState) => void
}

export function ImageField({ value, onChange }: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const existingUrl = useImageUrl(
    value.kind === "existing" ? value.id : undefined
  )
  const previewUrl =
    value.kind === "new" ? value.url : value.kind === "existing" ? existingUrl : undefined

  function pick(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return
    // Révoque l'aperçu d'un fichier précédemment choisi
    if (value.kind === "new") URL.revokeObjectURL(value.url)
    onChange({ kind: "new", file, url: URL.createObjectURL(file) })
  }

  function remove() {
    if (value.kind === "new") URL.revokeObjectURL(value.url)
    onChange({ kind: "none" })
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {previewUrl ? (
        <div className="relative overflow-hidden rounded-md border border-border/70 bg-black/20">
          <img
            src={previewUrl}
            alt="Aperçu"
            className="mx-auto max-h-44 w-auto object-contain"
          />
          <div className="absolute right-1.5 top-1.5 flex gap-1">
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              onClick={() => inputRef.current?.click()}
              title="Remplacer l'image"
            >
              <ImagePlus className="size-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              onClick={remove}
              title="Retirer l'image"
            >
              <X className="size-4" />
            </Button>
          </div>
          {value.kind === "existing" && (
            <p className="absolute bottom-1 left-1.5 rounded bg-black/40 px-1 font-mono text-[9px] text-white/50">
              {value.id}
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border/70 bg-input/10 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground cursor-pointer"
          )}
        >
          <ImagePlus className="size-4" /> Ajouter une image
        </button>
      )}
    </div>
  )
}
