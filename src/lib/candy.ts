import type { CSSProperties } from "react"

/** Palette candy-pop (doit rester alignée avec les --candy-N de index.css). */
export const CANDY: string[] = [
  "oklch(0.74 0.19 350)", // 1 rose
  "oklch(0.78 0.16 195)", // 2 cyan
  "oklch(0.82 0.16 95)", // 3 jaune
  "oklch(0.72 0.17 145)", // 4 menthe
  "oklch(0.7 0.18 285)", // 5 violet
  "oklch(0.75 0.18 40)", // 6 corail
  "oklch(0.76 0.15 240)", // 7 bleu ciel
  "oklch(0.78 0.17 330)", // 8 magenta
]

export const CANDY_COUNT = CANDY.length

/** Retourne la couleur (oklch) pour un index 1..8. */
export function candyColor(index: number): string {
  return CANDY[(index - 1 + CANDY_COUNT) % CANDY_COUNT]
}

/** Suggère une couleur à partir d'un texte, pour varier automatiquement. */
export function suggestColor(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return (h % CANDY_COUNT) + 1
}

/** Style d'une puce de tag selon état sélectionné. */
export function tagChipStyle(
  colorIndex: number,
  selected: boolean
): CSSProperties {
  const c = candyColor(colorIndex)
  if (selected) {
    return {
      backgroundColor: `color-mix(in oklch, ${c} 85%, transparent)`,
      color: "oklch(0.16 0.02 300)",
      borderColor: c,
      boxShadow: `0 0 0 1px ${c}, 0 4px 14px -4px color-mix(in oklch, ${c} 60%, transparent)`,
    }
  }
  return {
    backgroundColor: `color-mix(in oklch, ${c} 14%, transparent)`,
    color: `color-mix(in oklch, ${c} 82%, white)`,
    borderColor: `color-mix(in oklch, ${c} 35%, transparent)`,
  }
}
