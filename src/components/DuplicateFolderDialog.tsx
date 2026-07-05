import { useEffect, useState } from "react"
import { Copy } from "lucide-react"

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

interface DuplicateFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder?: Folder
  onDuplicate: (includeReviewState: boolean) => Promise<void>
}

export function DuplicateFolderDialog({
  open,
  onOpenChange,
  folder,
  onDuplicate,
}: DuplicateFolderDialogProps) {
  const [includeReviewState, setIncludeReviewState] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setIncludeReviewState(false)
  }, [open])

  async function handleConfirm() {
    setSaving(true)
    try {
      await onDuplicate(includeReviewState)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dupliquer « {folder?.name} »</DialogTitle>
          <DialogDescription>
            Le dossier, ses tags et ses flashcards (avec leurs images) seront
            copiés dans un nouveau dossier.
          </DialogDescription>
        </DialogHeader>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-card/40 p-3 text-sm">
          <input
            type="checkbox"
            checked={includeReviewState}
            onChange={(e) => setIncludeReviewState(e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            Inclure aussi la progression de révision
            <span className="block text-xs text-muted-foreground">
              Échéances et ease factor. Sans cette option, les cartes
              dupliquées démarrent neuves.
            </span>
          </span>
        </label>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            <Copy /> Dupliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
