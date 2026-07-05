import { useEffect, useState } from "react"
import { Check } from "lucide-react"

import type { Folder } from "@/lib/types"
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
  onSave: (name: string) => Promise<void>
}

export function FolderDialog({
  open,
  onOpenChange,
  folder,
  onSave,
}: FolderDialogProps) {
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setName(folder?.name ?? "")
  }, [open, folder])

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave(name.trim())
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
