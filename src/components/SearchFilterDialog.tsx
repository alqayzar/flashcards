import { Filter, RotateCcw } from "lucide-react"

import type { Tag } from "@/lib/types"
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
import { TagChip } from "@/components/TagChip"

/**
 * Bornes date+heure au format `yyyy-mm-ddThh:mm:ss` (valeur brute d'un
 * `<input type="datetime-local">`), vide = pas de borne.
 */
export interface SearchDateRange {
  createdFrom: string
  createdTo: string
  updatedFrom: string
  updatedTo: string
}

export const EMPTY_SEARCH_DATE_RANGE: SearchDateRange = {
  createdFrom: "",
  createdTo: "",
  updatedFrom: "",
  updatedTo: "",
}

export function hasActiveDateRange(range: SearchDateRange): boolean {
  return !!(range.createdFrom || range.createdTo || range.updatedFrom || range.updatedTo)
}

interface SearchFilterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tags: Tag[]
  selectedTagIds: Set<string>
  onToggleTag: (id: string) => void
  dateRange: SearchDateRange
  onChangeDateRange: (range: SearchDateRange) => void
  caseSensitive: boolean
  onChangeCaseSensitive: (value: boolean) => void
  wholeWord: boolean
  onChangeWholeWord: (value: boolean) => void
  onReset: () => void
}

export function SearchFilterDialog({
  open,
  onOpenChange,
  tags,
  selectedTagIds,
  onToggleTag,
  dateRange,
  onChangeDateRange,
  caseSensitive,
  onChangeCaseSensitive,
  wholeWord,
  onChangeWholeWord,
  onReset,
}: SearchFilterDialogProps) {
  function setField(field: keyof SearchDateRange, value: string) {
    onChangeDateRange({ ...dateRange, [field]: value })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="size-4" /> Filtres de recherche
          </DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[65vh] gap-4 overflow-y-auto px-1 py-1">
          <div className="grid gap-2">
            <Label>Mot-clé</Label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => onChangeCaseSensitive(e.target.checked)}
                className="size-4 accent-primary"
              />
              Respecter la casse
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={wholeWord}
                onChange={(e) => onChangeWholeWord(e.target.checked)}
                className="size-4 accent-primary"
              />
              Mot complet uniquement
            </label>
          </div>

          {tags.length > 0 && (
            <div className="grid gap-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <TagChip
                    key={t.id}
                    name={t.name}
                    color={t.color}
                    selected={selectedTagIds.has(t.id)}
                    onClick={() => onToggleTag(t.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Créée entre</Label>
            <div className="flex flex-col gap-2">
              <Input
                type="datetime-local"
                step="1"
                value={dateRange.createdFrom}
                onChange={(e) => setField("createdFrom", e.target.value)}
                className="h-9"
              />
              <Input
                type="datetime-local"
                step="1"
                value={dateRange.createdTo}
                onChange={(e) => setField("createdTo", e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Modifiée entre</Label>
            <div className="flex flex-col gap-2">
              <Input
                type="datetime-local"
                step="1"
                value={dateRange.updatedFrom}
                onChange={(e) => setField("updatedFrom", e.target.value)}
                className="h-9"
              />
              <Input
                type="datetime-local"
                step="1"
                value={dateRange.updatedTo}
                onChange={(e) => setField("updatedTo", e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onReset}>
            <RotateCcw /> Réinitialiser
          </Button>
          <Button onClick={() => onOpenChange(false)}>Appliquer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
