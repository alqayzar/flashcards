import { useState } from "react"
import {
  ArrowLeftRight,
  ChevronDown,
  Clock,
  Copy,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react"

import type { Card as CardType, Tag } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useImageUrl } from "@/lib/useImageUrl"
import { isCardDue, formatCountdown } from "@/lib/srs/engine"
import { Button } from "@/components/ui/button"
import { TagChip } from "@/components/TagChip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface CardItemProps {
  card: CardType
  tags: Tag[]
  activeStrategyId?: string
  /** horodatage courant (mis à jour en temps réel par l'appelant) */
  now: number
  /**
   * Carte d'origine, si `card` est sa carte inversée liée. Dans ce cas,
   * modifier/dupliquer/supprimer ne sont pas proposés (gérés uniquement
   * depuis l'originale) — seule la progression de révision reste indépendante.
   */
  linkedOriginal?: CardType
  /** cette carte (originale) a une carte inversée liée juste en dessous */
  hasReversedPair?: boolean
  className?: string
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onResetDue: () => void
  onCreateReverse: () => void
  onDeleteReverse: () => void
}

interface DueInfo {
  due: boolean
  /** 0 (vient d'être révisée) → 1 (disponible) */
  progress: number
  label: string
  /** compte à rebours compact avant échéance (ex. « 2j 3h 45m 12s ») */
  countdown?: string
}

function computeDueInfo(
  card: CardType,
  activeStrategyId: string | undefined,
  now: number
): DueInfo {
  const state = activeStrategyId ? card.reviewState?.[activeStrategyId] : undefined
  if (isCardDue(state, now)) {
    return { due: true, progress: 1, label: "Disponible" }
  }
  const s = state!
  const start = s.reviewedAt ?? s.dueAt - s.intervalMs
  const span = s.dueAt - start
  const progress = span > 0 ? Math.min(1, Math.max(0, (now - start) / span)) : 1
  const countdown = formatCountdown(s.dueAt - now)
  return { due: false, progress, label: `Dans ${countdown}`, countdown }
}

/**
 * Image pleine largeur : réduite, seul le haut est visible (rognée, avec un
 * dégradé signalant qu'elle continue) ; dépliée, l'image entière apparaît.
 */
function CardImage({ src, expanded }: { src: string; expanded: boolean }) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        !expanded && "max-h-20"
      )}
    >
      <img src={src} alt="" className="w-full rounded-md" />
      {!expanded && (
        <div className="absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-card to-transparent" />
      )}
    </div>
  )
}

function DueProgress({ dueInfo }: { dueInfo: DueInfo }) {
  if (dueInfo.due) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[10px] text-emerald-400/90">
        <span className="size-1.5 rounded-full bg-emerald-400" />
        Disponible
      </span>
    )
  }
  return (
    <span
      className="flex min-w-0 flex-1 items-center gap-1.5"
      title={dueInfo.label}
      aria-label={dueInfo.label}
    >
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-primary/70 transition-[width]"
          style={{ width: `${dueInfo.progress * 100}%` }}
        />
      </span>
      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
        {dueInfo.countdown}
      </span>
    </span>
  )
}

export function CardItem({
  card,
  tags,
  activeStrategyId,
  now,
  linkedOriginal,
  hasReversedPair,
  className,
  onEdit,
  onDuplicate,
  onDelete,
  onResetDue,
  onCreateReverse,
  onDeleteReverse,
}: CardItemProps) {
  const [expanded, setExpanded] = useState(false)
  const isReversed = !!linkedOriginal
  const cardTags = tags.filter((t) => card.tagIds.includes(t.id))
  const dueInfo = computeDueInfo(card, activeStrategyId, now)
  const frontImageUrl = useImageUrl(card.frontImage)
  const backImageUrl = useImageUrl(card.backImage)

  return (
    <div
      className={cn(
        "min-w-0 flex flex-col rounded-xl border-2 p-4 shadow-sm transition-colors",
        isReversed
          ? "border-border/70 bg-card/50 hover:border-primary/30"
          : "border-border bg-card hover:border-primary/40",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <DueProgress dueInfo={dueInfo} />
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setExpanded((e) => !e)}
            title={expanded ? "Réduire" : "Développer"}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                expanded && "rotate-180"
              )}
            />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isReversed && (
                <>
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil /> Modifier
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy /> Dupliquer
                  </DropdownMenuItem>
                  {!hasReversedPair ? (
                    <DropdownMenuItem onClick={onCreateReverse}>
                      <ArrowLeftRight /> Créer la carte inversée
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem variant="destructive" onClick={onDeleteReverse}>
                      <ArrowLeftRight /> Supprimer la carte inversée
                    </DropdownMenuItem>
                  )}
                </>
              )}
              <DropdownMenuItem onClick={onResetDue}>
                <Clock /> Réinitialiser l'échéance
              </DropdownMenuItem>
              {!isReversed && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={onDelete}>
                    <Trash2 /> Supprimer
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={cn(
          "flex flex-1 flex-col justify-center gap-2 py-2 text-left cursor-pointer transition-transform active:scale-[0.99]",
          !expanded && "overflow-hidden"
        )}
      >
        {/* Recto */}
        <div className="flex flex-col gap-1.5">
          {card.front ? (
            <p
              className={cn(
                "font-serif leading-snug [overflow-wrap:anywhere]",
                !expanded && "line-clamp-2"
              )}
            >
              {card.front}
            </p>
          ) : (
            <span className="text-sm text-muted-foreground italic">(vide)</span>
          )}
          {frontImageUrl && (
            <CardImage src={frontImageUrl} expanded={expanded} />
          )}
        </div>

        {/* Verso, atténué */}
        {(card.back || backImageUrl) && (
          <div className="flex flex-col gap-1.5 border-t border-border/50 pt-2 opacity-60">
            {card.back && (
              <p
                className={cn(
                  "font-serif text-sm leading-snug [overflow-wrap:anywhere]",
                  !expanded && "line-clamp-2"
                )}
              >
                {card.back}
              </p>
            )}
            {backImageUrl && (
              <CardImage src={backImageUrl} expanded={expanded} />
            )}
          </div>
        )}
      </button>

      {cardTags.length > 0 && (
        <div className="flex flex-nowrap gap-1 overflow-x-auto pt-1 pb-0.5">
          {cardTags.map((t) => (
            <TagChip
              key={t.id}
              name={t.name}
              color={t.color}
              size="sm"
              className="shrink-0"
            />
          ))}
        </div>
      )}

      {hasReversedPair && (
        <div className="relative z-20 flex justify-center">
          <span
            className="absolute -bottom-7 flex size-6 items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground shadow-sm"
            title="A une carte inversée liée"
          >
            <ArrowLeftRight className="size-3.5" />
          </span>
        </div>
      )}
    </div>
  )
}
