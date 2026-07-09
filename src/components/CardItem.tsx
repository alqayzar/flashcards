import { useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import {
  ArrowLeftRight,
  CalendarPlus,
  ChevronDown,
  Clock,
  Copy,
  MoreVertical,
  Pencil,
  PencilLine,
  SquareAsterisk,
  Trash2,
} from "lucide-react"

import type { Card as CardType, Tag } from "@/lib/types"
import { cn } from "@/lib/utils"
import { parseClozeBlanks } from "@/lib/cloze"
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
  /**
   * Carte d'origine du groupe cloze, si `card` est l'une de ses cartes liées
   * par trou (texte à trous). Mêmes restrictions que `linkedOriginal`.
   */
  clozeOriginal?: CardType
  /** cette carte (originale d'un groupe cloze) a ce nombre de trous liés */
  clozeSiblingCount?: number
  className?: string
  /** ex. z-index, pour empiler plusieurs cartes liées (voir FolderPage) */
  style?: CSSProperties
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

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

function formatDate(ts: number): string {
  return dateFormatter.format(new Date(ts))
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
 * Affiche un texte à trous en clair, avec le trou `activeIndex` (le sien)
 * surligné/souligné, et les autres trous du même groupe dans un style plus
 * discret (soulignage pointillé) pour rester visibles sans se confondre.
 */
function ClozeText({
  text,
  activeIndex,
}: {
  text: string
  activeIndex?: number
}) {
  if (activeIndex === undefined) return <>{text}</>
  const blanks = parseClozeBlanks(text)
  const nodes: ReactNode[] = []
  let cursor = 0
  blanks.forEach((b, i) => {
    nodes.push(text.slice(cursor, b.start))
    nodes.push(
      i === activeIndex ? (
        <mark
          key={i}
          className="rounded bg-primary/25 px-0.5 text-foreground underline decoration-primary decoration-2 underline-offset-2"
        >
          {b.text}
        </mark>
      ) : (
        <span
          key={i}
          className="underline decoration-dotted decoration-primary/50 underline-offset-2"
        >
          {b.text}
        </span>
      )
    )
    cursor = b.end
  })
  nodes.push(text.slice(cursor))
  return <>{nodes}</>
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
  clozeOriginal,
  clozeSiblingCount,
  className,
  style,
  onEdit,
  onDuplicate,
  onDelete,
  onResetDue,
  onCreateReverse,
  onDeleteReverse,
}: CardItemProps) {
  const [expanded, setExpanded] = useState(false)
  const isReversed = !!linkedOriginal
  const isClozeSibling = !!clozeOriginal
  const isLinked = isReversed || isClozeSibling
  const cardTags = tags.filter((t) => card.tagIds.includes(t.id))
  const dueInfo = computeDueInfo(card, activeStrategyId, now)
  const frontImageUrl = useImageUrl(card.frontImage)
  const backImageUrl = useImageUrl(card.backImage)

  return (
    <div
      style={style}
      className={cn(
        "min-w-0 flex flex-col rounded-xl border-2 p-4 shadow-sm transition-colors",
        isLinked
          ? "border-border/70 bg-[color-mix(in_oklch,var(--card)_50%,var(--background)_50%)] hover:border-primary/30"
          : "border-border bg-card hover:border-primary/40",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <DueProgress dueInfo={dueInfo} />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {(!!clozeSiblingCount || isClozeSibling) && (
            <span title="Texte à trous : cartes liées par trou">
              <SquareAsterisk className="size-3.5 text-muted-foreground" />
            </span>
          )}
          {(hasReversedPair || isReversed) && (
            <span title="A une carte inversée liée">
              <ArrowLeftRight className="size-3.5 text-muted-foreground" />
            </span>
          )}
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
              {!isLinked && (
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
              {!isLinked && (
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
              <ClozeText text={card.front} activeIndex={card.clozeIndex} />
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

      {!isLinked && cardTags.length > 0 && (
        <div className="no-scrollbar flex flex-nowrap gap-1 overflow-x-auto pt-1 pb-0.5">
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

      {expanded && (
        <div className="mt-2 flex flex-wrap justify-end gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground/60">
          <span className="flex items-center gap-1">
            <CalendarPlus className="size-3" />
            {formatDate(card.createdAt)}
          </span>
          {card.updatedAt !== card.createdAt && (
            <span className="flex items-center gap-1">
              <PencilLine className="size-3" />
              {formatDate(card.updatedAt)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
