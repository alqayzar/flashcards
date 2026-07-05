/**
 * Moteur SRS (répétition espacée) — logique pure, sans aucune dépendance au
 * stockage ni à l'UI.
 *
 * Une « stratégie » définit un ensemble de choix (ex. Anki : Encore /
 * Difficile / Bien / Facile). Chaque choix est de l'un des deux types
 * suivants :
 *   - « relearn » (Encore) : réapparition après un délai fixe, la carte
 *     repart en apprentissage.
 *   - « graduate » (Difficile/Bien/Facile) : le prochain intervalle se
 *     calcule à partir de l'intervalle précédent de la carte, multiplié par
 *     son ease factor (mis à jour), puis par `intervalMultiplier`. C'est ce
 *     qui rend la progression exponentielle (et non additive) d'une révision
 *     à l'autre : plus l'intervalle précédent est grand, plus le suivant
 *     l'est aussi.
 *
 * L'état d'une carte (`EaseState`) n'est ici qu'une abstraction pure — son
 * branchement sur les flashcards elles-mêmes est une étape ultérieure.
 */
import { uid } from "@/lib/id"
import { TIME_UNITS } from "./types"
import type {
  CardReviewState,
  Duration,
  EaseState,
  SrsButton,
  SrsStrategy,
} from "./types"

export type { EaseState }

function timeUnit(unit: Duration["unit"]) {
  // TIME_UNITS est la seule source de vérité : `unit` est garanti y figurer.
  return TIME_UNITS.find((u) => u.id === unit)!
}

/** Convertit une durée en millisecondes. */
export function durationToMs(duration: Duration): number {
  return duration.value * timeUnit(duration.unit).ms
}

/** Formatte une durée pour l'affichage (ex. « 30 secondes », « 1 jour »). */
export function formatDuration(duration: Duration): string {
  const { value } = duration
  const { one, many } = timeUnit(duration.unit)
  const label = Math.abs(value) <= 1 ? one : many
  // Affiche les valeurs entières sans décimale (ex. 1 et non 1.0)
  const formattedValue = Number.isInteger(value) ? value : value.toString()
  return `${formattedValue} ${label}`
}

/**
 * Formatte une durée en ms de façon compacte (ex. « 30s », « 10m », « 3j »),
 * en choisissant automatiquement la plus grande unité pertinente.
 */
export function formatShortDuration(ms: number): string {
  let best: (typeof TIME_UNITS)[number] = TIME_UNITS[0]
  for (const u of TIME_UNITS) {
    if (ms >= u.ms) best = u
  }
  const value = Math.round(ms / best.ms)
  return `${value}${best.short}`
}

/**
 * Formatte un délai en ms sous forme de compte à rebours combinant plusieurs
 * unités (ex. « 2j 3h 45m 12s »), en omettant les unités supérieures nulles
 * mais en affichant toujours les secondes.
 */
export function formatCountdown(ms: number): string {
  const clamped = Math.max(0, ms)
  const day = 86_400_000
  const hour = 3_600_000
  const minute = 60_000
  const second = 1_000
  const days = Math.floor(clamped / day)
  const hours = Math.floor((clamped % day) / hour)
  const minutes = Math.floor((clamped % hour) / minute)
  const seconds = Math.floor((clamped % minute) / second)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}j`)
  if (days > 0 || hours > 0) parts.push(`${hours}h`)
  if (days > 0 || hours > 0 || minutes > 0) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)
  return parts.join(" ")
}

/** Formatte l'effet d'un choix pour l'affichage (ex. dans la liste des stratégies). */
export function formatButtonEffect(button: SrsButton): string {
  if (button.kind === "relearn") {
    return formatDuration(button.relearnDelay)
  }
  const sign = button.easeDelta > 0 ? "+" : ""
  return `${sign}${button.easeDelta}% · ×${button.intervalMultiplier}`
}

/* ------------------------------ Ease factor ------------------------------ */

/** Ease factor de départ pour une carte neuve (250%, comme Anki). */
export const DEFAULT_EASE_FACTOR = 2.5

/** Plancher en-dessous duquel l'ease factor ne peut pas descendre. */
export const MIN_EASE_FACTOR = 1.3

function clampEaseFactor(ease: number): number {
  return Math.max(MIN_EASE_FACTOR, ease)
}

/** État initial d'une carte qui n'a encore jamais été révisée. */
export function createInitialState(): EaseState {
  return { intervalMs: 0, easeFactor: DEFAULT_EASE_FACTOR }
}

// Intervalle de base utilisé quand une carte neuve (intervalMs = 0) reçoit un
// choix « graduate » : on ne peut pas multiplier 0 par quoi que ce soit, donc
// on démarre sur une base d'un jour.
const NEW_CARD_BASE_INTERVAL_MS = durationToMs({ value: 1, unit: "days" })

export interface ApplyButtonResult {
  /**
   * Nouvel état à persister pour la carte — sert de base aux prochains
   * calculs « graduate ». Un choix « relearn » ne le modifie pas : un
   * palier d'apprentissage (ex. Encore) ne doit pas devenir la nouvelle
   * référence de croissance pour Difficile/Bien/Facile.
   */
  state: EaseState
  /** Délai (ms), à partir de maintenant, avant la prochaine apparition. */
  delayMs: number
}

/**
 * Calcule le nouvel état d'une carte après avoir appuyé sur `button`, ainsi
 * que le délai avant sa prochaine apparition.
 */
export function applyButton(
  state: EaseState,
  button: SrsButton
): ApplyButtonResult {
  const easeFactor = clampEaseFactor(state.easeFactor + button.easeDelta / 100)

  if (button.kind === "relearn") {
    const delayMs = durationToMs(button.relearnDelay)
    return { state: { intervalMs: state.intervalMs, easeFactor }, delayMs }
  }

  const baseIntervalMs =
    state.intervalMs > 0 ? state.intervalMs : NEW_CARD_BASE_INTERVAL_MS
  const intervalMs = Math.round(
    baseIntervalMs * easeFactor * button.intervalMultiplier
  )
  return { state: { intervalMs, easeFactor }, delayMs: intervalMs }
}

/**
 * Aperçu (en ms) du délai programmé par ce choix pour une carte neuve —
 * utilisé pour prévisualiser un choix dans le formulaire de stratégie, sans
 * disposer d'une vraie carte.
 */
export function previewInitialInterval(button: SrsButton): number {
  return applyButton(createInitialState(), button).delayMs
}

export interface ReviewResult {
  /** horodatage (ms epoch) de la prochaine apparition de la carte */
  nextDueAt: number
  /** nouvel état de la carte, à persister pour la révision suivante */
  state: EaseState
}

/**
 * Calcule la prochaine apparition d'une carte en réponse à l'appui du choix
 * `button`, à partir de son état courant `state`, à l'instant `now`.
 */
export function review(
  now: number,
  state: EaseState,
  button: SrsButton
): ReviewResult {
  const { state: nextState, delayMs } = applyButton(state, button)
  return { nextDueAt: now + delayMs, state: nextState }
}

/**
 * Une carte est due (à réviser) si elle n'a jamais été révisée sous cette
 * stratégie (elle est neuve), ou si son échéance programmée est passée.
 */
export function isCardDue(
  reviewState: CardReviewState | undefined,
  now: number = Date.now()
): boolean {
  return !reviewState || reviewState.dueAt <= now
}

/**
 * Calcule la prochaine apparition d'une carte en réponse à l'appui du choix
 * `buttonId` de la stratégie `strategy`, à partir de son état courant.
 */
export function reviewWithStrategy(
  strategy: SrsStrategy,
  state: EaseState,
  buttonId: string,
  now: number = Date.now()
): ReviewResult {
  const button = strategy.buttons.find((b) => b.id === buttonId)
  if (!button) {
    throw new Error(
      `Choix "${buttonId}" introuvable dans la stratégie "${strategy.name}"`
    )
  }
  return review(now, state, button)
}

/* ------------------------------ Stratégies ------------------------------- */

/** Les 4 choix par défaut, façon Anki : Encore / Difficile / Bien / Facile. */
export function createDefaultButtons(): SrsButton[] {
  return [
    {
      id: uid(),
      label: "Encore",
      kind: "relearn",
      easeDelta: -20,
      relearnDelay: { value: 30, unit: "seconds" },
    },
    {
      id: uid(),
      label: "Difficile",
      kind: "graduate",
      easeDelta: -15,
      intervalMultiplier: 0.5,
    },
    {
      id: uid(),
      label: "Bien",
      kind: "graduate",
      easeDelta: 0,
      intervalMultiplier: 1,
    },
    {
      id: uid(),
      label: "Facile",
      kind: "graduate",
      easeDelta: 15,
      intervalMultiplier: 1.3,
    },
  ]
}

/** Stratégie par défaut proposée à l'utilisateur — verrouillée. */
export function createDefaultStrategy(name = "Par défaut"): SrsStrategy {
  return {
    id: uid(),
    name,
    buttons: createDefaultButtons(),
    createdAt: Date.now(),
    locked: true,
  }
}

/** Nouveau choix vierge (type progression), point de départ dans le formulaire. */
export function createBlankButton(): SrsButton {
  return {
    id: uid(),
    label: "",
    kind: "graduate",
    easeDelta: 0,
    intervalMultiplier: 1,
  }
}

/** Une stratégie est valide si elle a un nom et au moins un choix valide. */
export function isStrategyValid(strategy: {
  name: string
  buttons: SrsButton[]
}): boolean {
  return (
    strategy.name.trim().length > 0 &&
    strategy.buttons.length > 0 &&
    strategy.buttons.every(isButtonValid)
  )
}

export function isButtonValid(button: SrsButton): boolean {
  if (button.label.trim().length === 0) return false
  if (!Number.isFinite(button.easeDelta)) return false
  if (button.kind === "relearn") return button.relearnDelay.value > 0
  return Number.isFinite(button.intervalMultiplier) && button.intervalMultiplier > 0
}
