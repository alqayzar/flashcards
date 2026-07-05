import { Check, Copy, MoreVertical, Pencil, Trash2 } from "lucide-react"

import type { SrsStrategy } from "@/lib/srs/types"
import { formatButtonEffect, formatShortDuration, previewInitialInterval } from "@/lib/srs/engine"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface StrategyCardProps {
  strategy: SrsStrategy
  active: boolean
  canDelete: boolean
  onEdit: () => void
  onSetActive: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export function StrategyCard({
  strategy,
  active,
  canDelete,
  onEdit,
  onSetActive,
  onDuplicate,
  onDelete,
}: StrategyCardProps) {
  return (
    <Card
      onClick={onSetActive}
      className={cn(
        "cursor-pointer gap-0 overflow-hidden py-0 transition-colors",
        active
          ? "border-primary/50 bg-primary/6"
          : "hover:border-primary/30"
      )}
    >
      <CardHeader className="gap-1 px-5 pt-5">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <CardTitle className="min-w-0 truncate font-serif text-lg">
              {strategy.name}
            </CardTitle>
            {active && <Check className="size-4 shrink-0 text-primary" />}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem onClick={onEdit} disabled={strategy.locked}>
                <Pencil /> Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy /> Dupliquer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={onDelete}
                disabled={!canDelete || strategy.locked}
              >
                <Trash2 /> Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="flex flex-col gap-1.5">
          {strategy.buttons.map((b) => (
            <Badge
              key={b.id}
              variant="outline"
              className="w-full justify-between font-normal"
            >
              <span className="truncate">
                {b.label} · {formatButtonEffect(b)}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {formatShortDuration(previewInitialInterval(b))}
              </span>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
