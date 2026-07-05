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
