import { useEffect, useState } from "react"
import { Check } from "lucide-react"

import type { Folder } from "@/lib/types"
import { TEST_FOLDER_TRIGGER, type TestSeedOptions } from "@/lib/testSeed"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface FolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder?: Folder
  onSave: (name: string, testSeed?: TestSeedOptions) => Promise<void>
}

export function FolderDialog({
  open,
  onOpenChange,
  folder,
  onSave,
}: FolderDialogProps) {
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [cardCount, setCardCount] = useState(20)
  const [tagCount, setTagCount] = useState(5)
  const [minChars, setMinChars] = useState(10)
  const [maxChars, setMaxChars] = useState(60)
  const [minTagsPerCard, setMinTagsPerCard] = useState(0)
  const [maxTagsPerCard, setMaxTagsPerCard] = useState(3)

  const isTestTrigger = !folder && name.trim() === TEST_FOLDER_TRIGGER

  useEffect(() => {
    if (open) {
      setName(folder?.name ?? "")
      setCardCount(20)
      setTagCount(5)
      setMinChars(10)
      setMaxChars(60)
      setMinTagsPerCard(0)
      setMaxTagsPerCard(3)
    }
  }, [open, folder])

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave(
        name.trim(),
        isTestTrigger
          ? { cardCount, tagCount, minChars, maxChars, minTagsPerCard, maxTagsPerCard }
          : undefined
      )
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {folder ? "Renommer le dossier" : "Nouveau dossier"}
          </DialogTitle>
          <DialogDescription>
            Un dossier regroupe des flashcards et ses propres tags.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="folder-name">Nom</Label>
          <Input
            id="folder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleSave()
              }
            }}
            placeholder="Ex. Biologie cellulaire"
            autoFocus
          />
        </div>

        {isTestTrigger && (
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-dashed border-border/60 bg-card/40 p-3">
            <div className="grid gap-1">
              <Label htmlFor="test-card-count" className="text-xs">
                Nombre de cartes
              </Label>
              <Input
                id="test-card-count"
                type="number"
                min={0}
                value={cardCount}
                onChange={(e) => setCardCount(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="test-tag-count" className="text-xs">
                Nombre de tags
              </Label>
              <Input
                id="test-tag-count"
                type="number"
                min={0}
                value={tagCount}
                onChange={(e) => setTagCount(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="test-min-chars" className="text-xs">
                Caractères minimum
              </Label>
              <Input
                id="test-min-chars"
                type="number"
                min={0}
                value={minChars}
                onChange={(e) => setMinChars(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="test-max-chars" className="text-xs">
                Caractères maximum
              </Label>
              <Input
                id="test-max-chars"
                type="number"
                min={0}
                value={maxChars}
                onChange={(e) => setMaxChars(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="test-min-tags-per-card" className="text-xs">
                Min tags par carte
              </Label>
              <Input
                id="test-min-tags-per-card"
                type="number"
                min={0}
                value={minTagsPerCard}
                onChange={(e) => setMinTagsPerCard(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="test-max-tags-per-card" className="text-xs">
                Max tags par carte
              </Label>
              <Input
                id="test-max-tags-per-card"
                type="number"
                min={0}
                value={maxTagsPerCard}
                onChange={(e) => setMaxTagsPerCard(Number(e.target.value))}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            <Check /> {folder ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
