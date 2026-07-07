import type { CardReviewState } from "./srs/types"

export interface Folder {
  id: string
  name: string
  createdAt: number
}

export interface Tag {
  id: string
  folderId: string
  name: string
  /** index 1..8 dans la palette candy */
  color: number
  createdAt: number
}

export interface Card {
  id: string
  folderId: string
  front: string
  back: string
  /** id de l'image (blob) associée au recto, si présente */
  frontImage?: string
  /** id de l'image (blob) associée au verso, si présente */
  backImage?: string
  tagIds: string[]
  createdAt: number
  updatedAt: number
  /**
   * Id de la carte d'origine dont celle-ci est l'inverse (recto/verso
   * permutés). Contenu (recto/verso/images/tags) synchronisé automatiquement
   * à chaque modification de l'originale ; non modifiable/supprimable/
   * duplicable indépendamment. La progression de révision, elle, reste
   * indépendante entre les deux cartes.
   */
  reversedFrom?: string
  /**
   * Recto « texte à trous » (cloze) : présent dès que `front` contient au
   * moins un `{{...}}`. Indique quel trou (par ordre d'apparition dans
   * `front`) cette carte masque à l'étude ; les autres trous du même texte
   * apparaissent en clair. `front` stocke toujours le gabarit brut complet
   * (avec les accolades), identique sur toutes les cartes d'un même groupe.
   */
  clozeIndex?: number
  /**
   * Id de la carte d'origine (le 1er trou, clozeIndex 0) dont celle-ci est
   * l'un des trous liés (clozeIndex ≥ 1). Contenu synchronisé automatique-
   * ment ; non modifiable/supprimable/duplicable indépendamment. La
   * progression de révision, elle, reste indépendante entre les cartes.
   */
  clozeOf?: string
  /**
   * État de révision SRS, indexé par id de stratégie. Une carte peut avoir
   * une progression différente selon la stratégie utilisée pour la réviser
   * — changer de stratégie active n'écrase donc pas l'historique accumulé
   * sous une autre.
   */
  reviewState?: Record<string, CardReviewState>
}

export interface CardInput {
  front: string
  back: string
  tagIds: string[]
  frontImage?: string
  backImage?: string
}
