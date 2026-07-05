/**
 * Source unique de vérité pour les unités de temps : conversion en
 * millisecondes, libellés (singulier/pluriel, sélecteur, abrégé).
 * Pour ajouter/retirer une unité, modifier uniquement ce tableau — tout le
 * reste (type, conversions, affichage, options du <Select>) en découle.
 */
export const TIME_UNITS = [
  {
    id: "seconds",
    ms: 1_000,
    one: "seconde",
    many: "secondes",
    label: "Secondes",
    short: "s",
  },
  {
    id: "minutes",
    ms: 60_000,
    one: "minute",
    many: "minutes",
    label: "Minutes",
    short: "m",
  },
  {
    id: "hours",
    ms: 3_600_000,
    one: "heure",
    many: "heures",
    label: "Heures",
    short: "h",
  },
  {
    id: "days",
    ms: 86_400_000,
    one: "jour",
    many: "jours",
    label: "Jours",
    short: "j",
  },
  {
    id: "weeks",
    ms: 604_800_000,
    one: "semaine",
    many: "semaines",
    label: "Semaines",
    short: "sem",
  },
  {
    id: "months",
    // Approximé à 30 jours (pas de notion de calendrier dans le moteur SRS)
    ms: 2_592_000_000,
    one: "mois",
    many: "mois",
    label: "Mois",
    short: "mois",
  },
] as const

export type DurationUnit = (typeof TIME_UNITS)[number]["id"]

export interface Duration {
  value: number
  unit: DurationUnit
}

interface SrsButtonBase {
  id: string
  label: string
  /**
   * Ajustement (en points de %) appliqué au ease factor de la carte quand ce
   * choix est pressé. Ex. -15 = ease factor × (1 - 0.15).
   */
  easeDelta: number
}

/**
 * Choix « relance » (façon Encore) : la carte repart en apprentissage et
 * réapparaît après un délai fixe, indépendant de son historique.
 */
export interface RelearnButton extends SrsButtonBase {
  kind: "relearn"
  relearnDelay: Duration
}

/**
 * Choix « progression » (façon Difficile/Bien/Facile) : le prochain
 * intervalle se calcule à partir de l'intervalle précédent de la carte,
 * multiplié par son ease factor (mis à jour) puis par `intervalMultiplier`.
 * C'est ce qui rend la croissance exponentielle plutôt qu'additive.
 */
export interface GraduateButton extends SrsButtonBase {
  kind: "graduate"
  intervalMultiplier: number
}

export type SrsButton = RelearnButton | GraduateButton

export interface SrsStrategy {
  id: string
  name: string
  /** ordre d'affichage = ordre croissant de difficulté (ex. Encore → Facile) */
  buttons: SrsButton[]
  createdAt: number
  /**
   * Stratégie verrouillée (la stratégie « Par défaut » seedée au premier
   * lancement) : ni modifiable, ni supprimable. Elle reste duplicable — la
   * copie obtenue, elle, n'est pas verrouillée.
   */
  locked?: boolean
}

/** État (minimal, pur) d'une carte du point de vue du SRS. */
export interface EaseState {
  /** intervalle précédemment programmé, en ms (0 pour une carte neuve) */
  intervalMs: number
  /** ease factor courant (ex. 2.5 = 250%) */
  easeFactor: number
}

/**
 * État de révision d'une carte pour une stratégie donnée : `EaseState` +
 * l'échéance programmée. Une carte stocke un `CardReviewState` par
 * stratégie (voir `Card.reviewState` dans lib/types.ts), de sorte que
 * changer de stratégie active n'écrase pas la progression accumulée sous
 * une autre stratégie.
 */
export interface CardReviewState extends EaseState {
  /** horodatage (ms epoch) de la prochaine apparition programmée */
  dueAt: number
  /**
   * horodatage (ms epoch) de la révision qui a produit cette échéance —
   * sert de point de départ pour calculer une progression (ex. barre de
   * progression) entre cette révision et `dueAt`.
   */
  reviewedAt: number
}
