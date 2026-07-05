import { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { SkipForward, X } from "lucide-react"

import type { Card } from "@/lib/types"
import { recordCardReview } from "@/lib/repo"
import type { CardReviewState, SrsButton, SrsStrategy } from "@/lib/srs/types"
import {
  applyButton,
  createInitialState,
  formatShortDuration,
  review,
} from "@/lib/srs/engine"
import {
  ensureDefaultStrategy,
  getActiveStrategyId,
  getStrategy,
} from "@/lib/srs/repo"
import { cn } from "@/lib/utils"
import { useImageUrl } from "@/lib/useImageUrl"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface StudyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cards: Card[]
}

/**
 * Dégradé à 4 points d'ancrage pour les choix : rouge → jaune → bleu → vert.
 * Avec exactement 4 choix, chacun tombe pile sur un point d'ancrage (1er
 * rouge, 2e jaune, 3e bleu, 4e vert). Avec plus de 4, chaque choix prend la
 * couleur interpolée correspondant à sa position relative entre les points.
 */
const CHOICE_GRADIENT_STOPS = ["#f87171", "#facc15", "#60a5fa", "#4ade80"]

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t)
}

function lerpHexColor(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA.slice(1), 16)
  const b = parseInt(hexB.slice(1), 16)
  const r = lerpChannel((a >> 16) & 0xff, (b >> 16) & 0xff, t)
  const g = lerpChannel((a >> 8) & 0xff, (b >> 8) & 0xff, t)
  const bl = lerpChannel(a & 0xff, b & 0xff, t)
  return `rgb(${r}, ${g}, ${bl})`
}

function choiceColor(index: number, total: number): string {
  const stops = CHOICE_GRADIENT_STOPS
  if (total <= 1) return stops[0]
  const t = index / (total - 1) // position normalisée 0..1
  const segment = t * (stops.length - 1) // 0..3
  const i = Math.min(Math.floor(segment), stops.length - 2)
  return lerpHexColor(stops[i], stops[i + 1], segment - i)
}

export function StudyDialog({ open, onOpenChange, cards }: StudyDialogProps) {
  const [deck, setDeck] = useState<Card[]>(cards)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [strategy, setStrategy] = useState<SrsStrategy | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)

  // `cards` (dérivé d'un useMemo côté parent qui dépend d'une horloge vivante)
  // change de référence à chaque tick même à contenu égal : on ne réinitialise
  // la session qu'à l'ouverture réelle du dialog, pas à chaque nouveau
  // tableau reçu pendant qu'il est déjà ouvert.
  const cardsRef = useRef(cards)
  useEffect(() => {
    cardsRef.current = cards
  })

  useEffect(() => {
    if (open) {
      setDeck(cardsRef.current)
      setIndex(0)
      setRevealed(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    ensureDefaultStrategy().then(async () => {
      const activeId = await getActiveStrategyId()
      const s = activeId ? await getStrategy(activeId) : undefined
      setStrategy(s ?? null)
    })
  }, [open])

  const card = deck[index]

  function getCardState(c: Card) {
    const stored = strategy && c.reviewState?.[strategy.id]
    return stored
      ? { intervalMs: stored.intervalMs, easeFactor: stored.easeFactor }
      : createInitialState()
  }

  // Retire une carte de la pile de cette session et passe à la suivante
  // (utilisé aussi bien après notation qu'après un simple ignorer).
  function advancePast(cardId: string) {
    setRevealed(false)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    const next = deck.filter((c) => c.id !== cardId)
    if (next.length === 0) {
      setDeck(next)
      onOpenChange(false)
      return
    }
    setDeck(next)
    setIndex((i) => i % next.length)
  }

  // Seul un choix (ou « ignorer ») fait avancer la session, pas de
  // navigation manuelle.
  async function handleGrade(target: Card, button: SrsButton) {
    if (!strategy) return
    const now = Date.now()
    const result = review(now, getCardState(target), button)
    const newState: CardReviewState = {
      ...result.state,
      dueAt: result.nextDueAt,
      reviewedAt: now,
    }
    const updated = await recordCardReview(target, strategy.id, newState)
    advancePast(updated.id)
  }

  // Passe à la carte suivante sans rien enregistrer (l'échéance de cette
  // carte n'est pas modifiée : elle restera due la prochaine fois).
  function handleIgnore(target: Card) {
    advancePast(target.id)
  }

  // Ne fait défiler jusqu'au verso que s'il n'est pas déjà entièrement visible.
  useEffect(() => {
    if (!revealed) return
    const container = scrollRef.current
    const target = backRef.current
    if (!container || !target) return
    const containerRect = container.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const fullyVisible =
      targetRect.top >= containerRect.top &&
      targetRect.bottom <= containerRect.bottom
    if (!fullyVisible) {
      target.scrollIntoView({ behavior: "smooth", block: "end" })
    }
  }, [revealed])

  // Toujours à jour, pour que le raccourci clavier (souscrit une seule fois)
  // n'utilise jamais une carte / un état périmé.
  const latest = useRef({ card, revealed, strategy })
  useEffect(() => {
    latest.current = { card, revealed, strategy }
  })

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        setRevealed(true)
        return
      }
      const { card: c, revealed: isRevealed, strategy: strat } = latest.current
      if (!isRevealed || !strat || !c) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= strat.buttons.length) {
        handleGrade(c, strat.buttons[n - 1])
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deck.length])

  if (!card) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        overlayClassName="bg-black/90 backdrop-blur-md"
        className="flex h-[90dvh] flex-col gap-0 border-none bg-transparent p-0 shadow-none sm:max-w-5xl"
      >
        <DialogTitle className="sr-only">Mode révision</DialogTitle>

        {/* Barre du haut */}
        <div className="mb-3 flex shrink-0 items-center justify-between px-1">
          <span className="text-sm font-medium text-muted-foreground">
            {index + 1} / {deck.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              title="Ignorer cette carte"
              onClick={() => handleIgnore(card)}
            >
              <SkipForward className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Recto, puis verso qui apparaît en dessous */}
        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2"
        >
          <div className="flex min-h-full w-full flex-col items-center gap-4 py-4">
            <StudyFace
              text={card.front}
              imageId={card.frontImage}
              onClick={() => setRevealed(true)}
              className="w-full flex-1"
            />
            {revealed && (
              <div ref={backRef} className="w-full shrink-0">
                <StudyFace
                  text={card.back}
                  imageId={card.backImage}
                  back
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>

        {/* Choix : tout en bas, 4 par ligne maximum, centrés */}
        {revealed && strategy && (
          <div className="mt-3 flex shrink-0 flex-wrap items-center justify-center gap-2 px-2 pb-1">
            {strategy.buttons.map((b, i) => {
              const preview = applyButton(getCardState(card), b).delayMs
              const color = choiceColor(i, strategy.buttons.length)
              return (
                <Button
                  key={b.id}
                  variant="outline"
                  onClick={() => handleGrade(card, b)}
                  style={{ "--choice-color": color } as CSSProperties}
                  className="h-auto w-36 flex-col gap-0.5 border-(--choice-color)/40 bg-(--choice-color)/10 py-2 text-(--choice-color) hover:border-(--choice-color)/60 hover:bg-(--choice-color)/20"
                >
                  <span className="text-sm font-medium">{b.label}</span>
                  <span className="text-[10px] opacity-70">
                    {formatShortDuration(preview)}
                  </span>
                </Button>
              )
            })}
          </div>
        )}

        <p className="mt-3 shrink-0 text-center text-xs text-muted-foreground">
          {revealed && strategy
            ? `1-${strategy.buttons.length} : noter`
            : "Espace : développer"}
        </p>
      </DialogContent>
    </Dialog>
  )
}

function StudyFace({
  text,
  imageId,
  back = false,
  onClick,
  className,
}: {
  text: string
  imageId?: string
  back?: boolean
  onClick?: () => void
  className?: string
}) {
  const imageUrl = useImageUrl(imageId)
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-3 rounded-2xl border p-8 text-center shadow-xl",
        back
          ? "border-primary/30 bg-gradient-to-br from-card to-primary/10"
          : "border-border/70 bg-card",
        onClick && "cursor-pointer",
        className
      )}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="max-h-52 w-auto rounded-lg object-contain"
        />
      )}
      {text ? (
        <p
          className={cn(
            "font-serif leading-snug [overflow-wrap:anywhere]",
            imageUrl ? "text-lg" : "text-2xl"
          )}
        >
          {text}
        </p>
      ) : (
        !imageUrl && (
          <span className="text-muted-foreground italic">(vide)</span>
        )
      )}
    </div>
  )
}
