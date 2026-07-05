import { describe, expect, it } from "vitest"

import {
  DEFAULT_EASE_FACTOR,
  MIN_EASE_FACTOR,
  applyButton,
  createBlankButton,
  createDefaultButtons,
  createDefaultStrategy,
  createInitialState,
  durationToMs,
  formatButtonEffect,
  formatDuration,
  formatShortDuration,
  isButtonValid,
  isCardDue,
  isStrategyValid,
  previewInitialInterval,
  review,
  reviewWithStrategy,
} from "./engine"
import type { EaseState } from "./engine"
import type {
  CardReviewState,
  GraduateButton,
  RelearnButton,
  SrsStrategy,
} from "./types"

const SECOND = 1_000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY

function relearnButton(overrides: Partial<RelearnButton> = {}): RelearnButton {
  return {
    id: "btn-relearn",
    label: "Encore",
    kind: "relearn",
    easeDelta: -20,
    relearnDelay: { value: 30, unit: "seconds" },
    ...overrides,
  }
}

function graduateButton(
  overrides: Partial<GraduateButton> = {}
): GraduateButton {
  return {
    id: "btn-graduate",
    label: "Bien",
    kind: "graduate",
    easeDelta: 0,
    intervalMultiplier: 1,
    ...overrides,
  }
}

describe("durationToMs", () => {
  it("convertit des secondes", () => {
    expect(durationToMs({ value: 30, unit: "seconds" })).toBe(30 * SECOND)
  })

  it("convertit des minutes", () => {
    expect(durationToMs({ value: 5, unit: "minutes" })).toBe(5 * MINUTE)
  })

  it("convertit des heures", () => {
    expect(durationToMs({ value: 2, unit: "hours" })).toBe(2 * HOUR)
  })

  it("convertit des jours", () => {
    expect(durationToMs({ value: 1, unit: "days" })).toBe(1 * DAY)
  })

  it("convertit des semaines", () => {
    expect(durationToMs({ value: 2, unit: "weeks" })).toBe(2 * WEEK)
  })

  it("convertit des mois", () => {
    expect(durationToMs({ value: 3, unit: "months" })).toBe(3 * MONTH)
  })

  it("supporte les valeurs décimales", () => {
    expect(durationToMs({ value: 1.5, unit: "hours" })).toBe(1.5 * HOUR)
  })
})

describe("formatDuration", () => {
  it("met le singulier pour une valeur de 1", () => {
    expect(formatDuration({ value: 1, unit: "days" })).toBe("1 jour")
    expect(formatDuration({ value: 1, unit: "minutes" })).toBe("1 minute")
  })

  it("met le pluriel au-delà de 1", () => {
    expect(formatDuration({ value: 30, unit: "seconds" })).toBe("30 secondes")
    expect(formatDuration({ value: 2, unit: "hours" })).toBe("2 heures")
  })
})

describe("formatShortDuration", () => {
  it("choisit la plus grande unité pertinente", () => {
    expect(formatShortDuration(30 * SECOND)).toBe("30s")
    expect(formatShortDuration(10 * MINUTE)).toBe("10m")
    expect(formatShortDuration(3 * HOUR)).toBe("3h")
    expect(formatShortDuration(3 * DAY)).toBe("3j")
    expect(formatShortDuration(2 * WEEK)).toBe("2sem")
    expect(formatShortDuration(4 * MONTH)).toBe("4mois")
  })

  it("arrondit à l'entier le plus proche", () => {
    expect(formatShortDuration(90 * SECOND)).toBe("2m") // 1.5min arrondi
  })
})

describe("previewInitialInterval", () => {
  it("pour un choix « relearn », retourne directement son délai fixe", () => {
    const encore = relearnButton({ relearnDelay: { value: 30, unit: "seconds" } })
    expect(previewInitialInterval(encore)).toBe(30 * SECOND)
  })

  it("pour un choix « graduate », prévisualise à partir d'une carte neuve", () => {
    const bien = graduateButton({ easeDelta: 0, intervalMultiplier: 1 })
    expect(previewInitialInterval(bien)).toBe(
      applyButton(createInitialState(), bien).delayMs
    )
    expect(previewInitialInterval(bien)).toBe(Math.round(DAY * 2.5 * 1))
  })
})

describe("formatButtonEffect", () => {
  it("affiche le délai pour un choix « relearn »", () => {
    expect(
      formatButtonEffect(relearnButton({ relearnDelay: { value: 30, unit: "seconds" } }))
    ).toBe("30 secondes")
  })

  it("affiche l'ease delta et le multiplicateur pour un choix « graduate »", () => {
    expect(
      formatButtonEffect(
        graduateButton({ easeDelta: 15, intervalMultiplier: 1.3 })
      )
    ).toBe("+15% · ×1.3")
    expect(
      formatButtonEffect(
        graduateButton({ easeDelta: -15, intervalMultiplier: 0.5 })
      )
    ).toBe("-15% · ×0.5")
  })
})

describe("applyButton — choix « relearn »", () => {
  it("le délai avant réapparition est le délai fixe, indépendamment de l'historique", () => {
    const state: EaseState = { intervalMs: 30 * DAY, easeFactor: 2.8 }
    const encore = relearnButton({ relearnDelay: { value: 30, unit: "seconds" } })
    const { delayMs } = applyButton(state, encore)
    expect(delayMs).toBe(30 * SECOND)
  })

  it("ne modifie PAS l'intervalle mémorisé (base de calcul des choix « graduate »)", () => {
    const state: EaseState = { intervalMs: 30 * DAY, easeFactor: 2.8 }
    const encore = relearnButton()
    const { state: next } = applyButton(state, encore)
    expect(next.intervalMs).toBe(30 * DAY)
  })

  it("réduit l'ease factor de easeDelta", () => {
    const state: EaseState = { intervalMs: 30 * DAY, easeFactor: 2.5 }
    const encore = relearnButton({ easeDelta: -20 })
    const { state: next } = applyButton(state, encore)
    expect(next.easeFactor).toBeCloseTo(2.3)
  })
})

describe("applyButton — choix « graduate »", () => {
  it("démarre sur une base d'un jour pour une carte neuve (intervalMs = 0)", () => {
    const fresh = createInitialState()
    const bien = graduateButton({ easeDelta: 0, intervalMultiplier: 1 })
    const { delayMs, state } = applyButton(fresh, bien)
    // ease inchangé (2.5) × multiplicateur 1 × base 1 jour
    expect(delayMs).toBe(Math.round(DAY * 2.5 * 1))
    expect(state.intervalMs).toBe(delayMs)
  })

  it("multiplie l'intervalle précédent par l'ease factor et le multiplicateur", () => {
    const state: EaseState = { intervalMs: 10 * DAY, easeFactor: 2.5 }
    const bien = graduateButton({ easeDelta: 0, intervalMultiplier: 1 })
    const { delayMs } = applyButton(state, bien)
    expect(delayMs).toBe(Math.round(10 * DAY * 2.5 * 1))
  })

  it("le ease factor ne descend jamais sous MIN_EASE_FACTOR", () => {
    let state: EaseState = createInitialState()
    const difficile = graduateButton({ easeDelta: -100, intervalMultiplier: 0.5 })
    for (let i = 0; i < 10; i++) {
      state = applyButton(state, difficile).state
    }
    expect(state.easeFactor).toBe(MIN_EASE_FACTOR)
  })
})

describe("un palier « relearn » ne devient pas la base de croissance", () => {
  it("après Encore sur une carte neuve, les choix « graduate » ignorent les 30s d'Encore", () => {
    const [encore, difficile, bien, facile] = createDefaultButtons()
    const fresh = createInitialState()

    const afterEncore = applyButton(fresh, encore).state
    // L'intervalle mémorisé reste à 0 (toujours « carte neuve ») : seul
    // l'ease factor a été affecté par le passage sur Encore.
    expect(afterEncore.intervalMs).toBe(0)
    expect(afterEncore.easeFactor).toBeCloseTo(2.3)

    // Les 3 autres choix prévisualisent donc à partir de la base « carte
    // neuve » (1 jour), pas à partir du délai de 30s d'Encore.
    const previewDifficile = applyButton(afterEncore, difficile).delayMs
    const previewBien = applyButton(afterEncore, bien).delayMs
    const previewFacile = applyButton(afterEncore, facile).delayMs

    expect(previewDifficile).toBe(Math.round(DAY * 2.15 * 0.5))
    expect(previewBien).toBe(Math.round(DAY * 2.3 * 1))
    expect(previewFacile).toBe(Math.round(DAY * 2.45 * 1.3))

    // De l'ordre du jour, pas de la trentaine de secondes ou minutes.
    expect(previewDifficile).toBeGreaterThan(HOUR)
    expect(previewBien).toBeGreaterThan(HOUR)
    expect(previewFacile).toBeGreaterThan(HOUR)
  })
})

describe("la progression est multiplicative, pas additive", () => {
  it("presser « Facile » deux fois de suite ne fait pas +1 jour +1 jour", () => {
    const facile = createDefaultButtons().find((b) => b.label === "Facile")!
    expect(facile.kind).toBe("graduate")

    const fresh = createInitialState()
    const first = applyButton(fresh, facile)
    const expectedFirstEase = DEFAULT_EASE_FACTOR + 15 / 100
    const expectedFirstInterval = Math.round(DAY * expectedFirstEase * 1.3)
    expect(first.state.easeFactor).toBeCloseTo(expectedFirstEase)
    expect(first.delayMs).toBe(expectedFirstInterval)

    const second = applyButton(first.state, facile)
    const expectedSecondEase = expectedFirstEase + 15 / 100
    const expectedSecondInterval = Math.round(
      first.delayMs * expectedSecondEase * 1.3
    )
    expect(second.state.easeFactor).toBeCloseTo(expectedSecondEase)
    expect(second.delayMs).toBe(expectedSecondInterval)

    // La preuve que ce n'est pas additif : le second délai vaut plus du
    // triple du premier, pas simplement "premier délai + 1 jour".
    expect(second.delayMs).toBeGreaterThan(first.delayMs + DAY)
    expect(second.delayMs / first.delayMs).toBeGreaterThan(3)
  })
})

describe("review — la prochaine apparition attendue", () => {
  it("calcule nextDueAt = now + intervalMs du nouvel état", () => {
    const now = 1_000_000
    const state = createInitialState()
    const bien = graduateButton({ easeDelta: 0, intervalMultiplier: 1 })
    const result = review(now, state, bien)
    expect(result.nextDueAt).toBe(now + Math.round(DAY * 2.5 * 1))
    expect(result.state.easeFactor).toBe(2.5)
  })
})

describe("reviewWithStrategy", () => {
  const now = 5_000_000
  const strategy: SrsStrategy = createDefaultStrategy("Test")
  const fresh = createInitialState()

  it("retrouve le bon choix par id et calcule la bonne date", () => {
    const [encore] = strategy.buttons
    const result = reviewWithStrategy(strategy, fresh, encore.id, now)
    expect(result.nextDueAt).toBe(now + 30 * SECOND)
  })

  it("lève une erreur si le choix n'existe pas dans la stratégie", () => {
    expect(() => reviewWithStrategy(strategy, fresh, "inconnu", now)).toThrow()
  })

  it("utilise Date.now() par défaut quand `now` est omis", () => {
    const [encore] = strategy.buttons
    const before = Date.now()
    const result = reviewWithStrategy(strategy, fresh, encore.id)
    const after = Date.now()
    expect(result.nextDueAt).toBeGreaterThanOrEqual(before + 30 * SECOND)
    expect(result.nextDueAt).toBeLessThanOrEqual(after + 30 * SECOND)
  })
})

describe("createDefaultStrategy / createDefaultButtons", () => {
  it("crée exactement 4 choix dans l'ordre Encore, Difficile, Bien, Facile", () => {
    const buttons = createDefaultButtons()
    expect(buttons.map((b) => b.label)).toEqual([
      "Encore",
      "Difficile",
      "Bien",
      "Facile",
    ])
  })

  it("Encore est un choix « relearn » de 30 secondes avec ease -20%", () => {
    const [encore] = createDefaultButtons()
    expect(encore.kind).toBe("relearn")
    expect(encore.easeDelta).toBe(-20)
    expect(encore).toMatchObject({
      kind: "relearn",
      relearnDelay: { value: 30, unit: "seconds" },
    })
  })

  it("Difficile / Bien / Facile sont des choix « graduate » avec les bons réglages", () => {
    const [, difficile, bien, facile] = createDefaultButtons()
    expect(difficile).toMatchObject({
      kind: "graduate",
      easeDelta: -15,
      intervalMultiplier: 0.5,
    })
    expect(bien).toMatchObject({
      kind: "graduate",
      easeDelta: 0,
      intervalMultiplier: 1,
    })
    expect(facile).toMatchObject({
      kind: "graduate",
      easeDelta: 15,
      intervalMultiplier: 1.3,
    })
  })

  it("donne un id unique à chaque choix", () => {
    const buttons = createDefaultButtons()
    const ids = new Set(buttons.map((b) => b.id))
    expect(ids.size).toBe(buttons.length)
  })

  it("nomme la stratégie « Par défaut » sauf si un nom est fourni", () => {
    expect(createDefaultStrategy().name).toBe("Par défaut")
    expect(createDefaultStrategy("Mon nom").name).toBe("Mon nom")
  })

  it("la stratégie par défaut est verrouillée", () => {
    expect(createDefaultStrategy().locked).toBe(true)
  })
})

describe("isCardDue", () => {
  const now = 1_000_000

  it("une carte jamais révisée sous cette stratégie est toujours due", () => {
    expect(isCardDue(undefined, now)).toBe(true)
  })

  it("une carte dont l'échéance est passée est due", () => {
    const state: CardReviewState = {
      intervalMs: DAY,
      easeFactor: 2.5,
      dueAt: now - 1,
      reviewedAt: now - DAY - 1,
    }
    expect(isCardDue(state, now)).toBe(true)
  })

  it("une carte dont l'échéance est exactement maintenant est due", () => {
    const state: CardReviewState = {
      intervalMs: DAY,
      easeFactor: 2.5,
      dueAt: now,
      reviewedAt: now - DAY,
    }
    expect(isCardDue(state, now)).toBe(true)
  })

  it("une carte dont l'échéance est future n'est pas due", () => {
    const state: CardReviewState = {
      intervalMs: DAY,
      easeFactor: 2.5,
      dueAt: now + 1,
      reviewedAt: now - DAY + 1,
    }
    expect(isCardDue(state, now)).toBe(false)
  })

  it("utilise Date.now() par défaut quand `now` est omis", () => {
    expect(
      isCardDue({
        intervalMs: DAY,
        easeFactor: 2.5,
        dueAt: Date.now() + DAY,
        reviewedAt: Date.now(),
      })
    ).toBe(false)
  })
})

describe("validation", () => {
  it("rejette un choix sans libellé", () => {
    expect(isButtonValid(graduateButton({ label: "" }))).toBe(false)
    expect(isButtonValid(relearnButton({ label: "" }))).toBe(false)
  })

  it("rejette un choix « relearn » avec un délai nul ou négatif", () => {
    expect(
      isButtonValid(relearnButton({ relearnDelay: { value: 0, unit: "minutes" } }))
    ).toBe(false)
    expect(
      isButtonValid(relearnButton({ relearnDelay: { value: -5, unit: "minutes" } }))
    ).toBe(false)
  })

  it("rejette un choix « graduate » avec un multiplicateur nul ou négatif", () => {
    expect(isButtonValid(graduateButton({ intervalMultiplier: 0 }))).toBe(false)
    expect(isButtonValid(graduateButton({ intervalMultiplier: -1 }))).toBe(false)
  })

  it("accepte des choix valides", () => {
    expect(isButtonValid(graduateButton())).toBe(true)
    expect(isButtonValid(relearnButton())).toBe(true)
  })

  it("rejette une stratégie sans nom", () => {
    expect(isStrategyValid({ name: "  ", buttons: createDefaultButtons() })).toBe(
      false
    )
  })

  it("rejette une stratégie sans choix", () => {
    expect(isStrategyValid({ name: "Vide", buttons: [] })).toBe(false)
  })

  it("rejette une stratégie contenant un choix invalide", () => {
    expect(
      isStrategyValid({
        name: "Cassée",
        buttons: [graduateButton({ label: "" })],
      })
    ).toBe(false)
  })

  it("accepte une stratégie valide", () => {
    expect(
      isStrategyValid({ name: "Ok", buttons: createDefaultButtons() })
    ).toBe(true)
  })
})

describe("createBlankButton / createInitialState", () => {
  it("retourne un choix « graduate » vierge et valide dans sa structure de base", () => {
    const b = createBlankButton()
    expect(b.id).toBeTruthy()
    expect(b.label).toBe("")
    expect(b.kind).toBe("graduate")
    if (b.kind === "graduate") {
      expect(b.intervalMultiplier).toBeGreaterThan(0)
    }
  })

  it("retourne l'état initial attendu pour une carte neuve", () => {
    expect(createInitialState()).toEqual({
      intervalMs: 0,
      easeFactor: DEFAULT_EASE_FACTOR,
    })
  })
})
