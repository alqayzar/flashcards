import { useState } from "react"
import { Pencil, Plus, Trash2, Check, X, Tag as TagIcon } from "lucide-react"

import type { Tag } from "@/lib/types"
import { suggestColor } from "@/lib/candy"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TagChip } from "@/components/TagChip"

interface TagsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tags: Tag[]
  selected: Set<string>
  onToggle: (id: string) => void
  onReset: () => void
  onRequestDelete: (tag: Tag) => void
  onRename: (tag: Tag, name: string) => Promise<void>
  onCreateTag: (name: string, color: number) => Promise<Tag>
}

export function TagsDialog({
  open,
  onOpenChange,
  tags,
  selected,
  onToggle,
  onReset,
  onRequestDelete,
  onRename,
  onCreateTag,
}: TagsDialogProps) {
  const [manage, setManage] = useState(false)
  const [editing, setEditing] = useState<Tag | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState("")
  const [newTag, setNewTag] = useState("")

  async function handleAddTag() {
    const name = newTag.trim()
    if (!name) return
    // Évite les doublons (insensible à la casse)
    if (!tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      await onCreateTag(name, suggestColor(name))
    }
    setNewTag("")
  }

  function resetManage() {
    setManage(false)
    setEditing(null)
    setRenaming(false)
  }

  function handleOpenChange(o: boolean) {
    if (!o) resetManage()
    onOpenChange(o)
  }

  function beginRename(tag: Tag) {
    setEditing(tag)
    setRenameValue(tag.name)
    setRenaming(true)
  }

  async function confirmRename() {
    if (!editing) return
    const name = renameValue.trim()
    if (name && name !== editing.name) await onRename(editing, name)
    setRenaming(false)
    setEditing(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TagIcon className="size-4" /> Tags
          </DialogTitle>
        </DialogHeader>

        {/* Barre d'actions */}
        {tags.length > 0 && (
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <Button
              variant={manage ? "secondary" : "ghost"}
              size="sm"
              onClick={() => (manage ? resetManage() : setManage(true))}
            >
              <Pencil className="size-3.5" />
              {manage ? "Terminé" : "Modifier"}
            </Button>

            <div className="flex flex-1 items-center justify-end gap-2">
              {!manage && selected.size > 0 && (
                <Button variant="ghost" size="sm" onClick={onReset}>
                  Réinitialiser
                </Button>
              )}

              {manage && renaming && editing && (
                <>
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        confirmRename()
                      } else if (e.key === "Escape") {
                        setRenaming(false)
                        setEditing(null)
                      }
                    }}
                    placeholder="Nouveau nom"
                    className="h-8 flex-1"
                    autoFocus
                  />
                  <Button
                    size="icon-sm"
                    onClick={confirmRename}
                    disabled={!renameValue.trim()}
                    title="Valider"
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setRenaming(false)
                      setEditing(null)
                    }}
                    title="Annuler"
                  >
                    <X className="size-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {tags.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Aucun tag pour l'instant. Ajoute-en en créant ou modifiant une
            flashcard.
          </p>
        ) : (
          <div className="flex max-h-[45vh] flex-wrap gap-2 overflow-y-auto py-1">
            {tags.map((t) =>
              manage ? (
                <DropdownMenu key={t.id} modal={false}>
                  <DropdownMenuTrigger asChild>
                    <TagChip
                      name={t.name}
                      color={t.color}
                      selected={editing?.id === t.id}
                      onClick={() => {}}
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    <DropdownMenuItem onClick={() => beginRename(t)}>
                      <Pencil /> Renommer
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onRequestDelete(t)}
                    >
                      <Trash2 /> Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <TagChip
                  key={t.id}
                  name={t.name}
                  color={t.color}
                  selected={selected.has(t.id)}
                  onClick={() => onToggle(t.id)}
                />
              )
            )}
          </div>
        )}

        {/* Création d'un tag */}
        <div className="flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAddTag()
              }
            }}
            placeholder="Nouveau tag…"
            className="h-9"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddTag}
            disabled={!newTag.trim()}
            className="h-9"
          >
            <Plus /> Ajouter
          </Button>
        </div>

        <DialogFooter>
          <Button size="sm" onClick={() => handleOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
