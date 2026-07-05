import { useEffect, useState } from "react"
import { Copy, GraduationCap, MoreVertical, Pencil, Trash2, Layers } from "lucide-react"

import type { Folder } from "@/lib/types"
import { countCards } from "@/lib/repo"
import { candyColor } from "@/lib/candy"
import { navigate } from "@/lib/useHashRoute"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface FolderCardProps {
  folder: Folder
  accent: number
  onEdit: () => void
  onDuplicate: () => void
  onReview: () => void
  onDelete: () => void
}

export function FolderCard({
  folder,
  accent,
  onEdit,
  onDuplicate,
  onReview,
  onDelete,
}: FolderCardProps) {
  const [count, setCount] = useState<number | null>(null)
  const color = candyColor(accent)

  useEffect(() => {
    countCards(folder.id).then(setCount)
  }, [folder.id])

  return (
    <Card
      onClick={() => navigate(`/folder/${folder.id}`)}
      className="group relative cursor-pointer gap-0 overflow-hidden py-0 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2 p-5">
        <div className="flex items-start gap-3 overflow-hidden">
          <div
            className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg"
            style={{
              backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)`,
              color,
            }}
          >
            <Layers className="size-5" />
          </div>
          <div className="overflow-hidden">
            <h3 className="truncate font-serif text-lg font-semibold leading-tight">
              {folder.name}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {count === null
                ? "…"
                : `${count} carte${count > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem onClick={onReview}>
              <GraduationCap /> Réviser
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil /> Renommer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy /> Dupliquer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 /> Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  )
}
