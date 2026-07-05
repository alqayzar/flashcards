import { useEffect, useState } from "react"
import { Plus, Check } from "lucide-react"

import type { Card, CardInput, Tag } from "@/lib/types"
import { suggestColor } from "@/lib/candy"
import { putImage, releaseImage } from "@/lib/repo"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { TagChip } from "@/components/TagChip"
import { ImageField, type ImgState } from "@/components/ImageField"

interface CardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** carte à éditer, ou undefined pour une création */
  card?: Card
  tags: Tag[]
  onCreateTag: (name: string, color: number) => Promise<Tag>
  onSave: (data: CardInput) => Promise<void>
}

function initialImg(id: string | undefined): ImgState {
  return id ? { kind: "existing", id } : { kind: "none" }
}

export function CardDialog({
  open,
  onOpenChange,
  card,
  tags,
  onCreateTag,
  onSave,
}: CardDialogProps) {
  const [front, setFront] = useState("")
  const [back, setBack] = useState("")
  const [frontImg, setFrontImg] = useState<ImgState>({ kind: "none" })
  const [backImg, setBackImg] = useState<ImgState>({ kind: "none" })
  const [tagIds, setTagIds] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setFront(card?.front ?? "")
      setBack(card?.back ?? "")
      setFrontImg(initialImg(card?.frontImage))
      setBackImg(initialImg(card?.backImage))
      setTagIds(card?.tagIds ?? [])
      setNewTag("")
    }
  }, [open, card])

  function toggleTag(id: string) {
    setTagIds((cur) =>
      cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]
    )
  }

  async function handleCreateTag() {
    const name = newTag.trim()
    if (!name) return
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (!tagIds.includes(existing.id)) toggleTag(existing.id)
      setNewTag("")
      return
    }
    const tag = await onCreateTag(name, suggestColor(name))
    setTagIds((cur) => [...cur, tag.id])
    setNewTag("")
  }

  const isEmpty =
    !front.trim() &&
    !back.trim() &&
    frontImg.kind === "none" &&
    backImg.kind === "none"

  // Résout une face : stocke le nouveau fichier, relâche l'ancien si
  // remplacé/retiré (le blob n'est supprimé que si plus rien n'y fait
  // référence — une autre carte dupliquée peut encore l'utiliser).
  async function resolveImage(
    img: ImgState,
    originalId: string | undefined
  ): Promise<string | undefined> {
    if (img.kind === "new") {
      const id = await putImage(img.file)
      if (originalId) await releaseImage(originalId)
      return id
    }
    if (img.kind === "existing") return img.id
    // none
    if (originalId) await releaseImage(originalId)
    return undefined
  }

  async function handleSave() {
    if (isEmpty) return
    setSaving(true)
    try {
      const [frontImage, backImage] = await Promise.all([
        resolveImage(frontImg, card?.frontImage),
        resolveImage(backImg, card?.backImage),
      ])
      await onSave({ front, back, tagIds, frontImage, backImage })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="top-0 left-0 flex h-dvh w-screen max-w-none max-h-none translate-x-0 translate-y-0 flex-col rounded-none border-0"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {card ? "Modifier la flashcard" : "Nouvelle flashcard"}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-1">
          <div className="mx-auto grid max-w-xl gap-4">
            <div className="grid gap-2">
              <Label htmlFor="front">Recto</Label>
              <Textarea
                id="front"
                value={front}
                onChange={(e) => setFront(e.target.value)}
                placeholder="La question, le terme, le mot…"
              />
              <ImageField
                value={frontImg}
                onChange={setFrontImg}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="back">Verso</Label>
              <Textarea
                id="back"
                value={back}
                onChange={(e) => setBack(e.target.value)}
                placeholder="La réponse, la définition…"
              />
              <ImageField
                value={backImg}
                onChange={setBackImg}
              />
            </div>

            <div className="grid gap-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleCreateTag()
                    }
                  }}
                  placeholder="Créer / ajouter un tag…"
                  className="h-9"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCreateTag}
                  disabled={!newTag.trim()}
                  className="h-9"
                >
                  <Plus /> Ajouter
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <TagChip
                      key={t.id}
                      name={t.name}
                      color={t.color}
                      selected={tagIds.includes(t.id)}
                      onClick={() => toggleTag(t.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || isEmpty}>
            <Check /> {card ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
