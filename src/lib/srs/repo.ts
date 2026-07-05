/**
 * Persistance des stratégies SRS dans IndexedDB.
 * Convention de clés :
 *   strategy:{id}              → SrsStrategy
 *   settings:activeStrategyId  → string (id de la stratégie active)
 */
import { kvDelete, kvEntriesByPrefix, kvGet, kvSet } from "@/lib/idb"
import { uid } from "@/lib/id"
import { createDefaultStrategy } from "./engine"
import type { SrsButton, SrsStrategy } from "./types"

const strategyKey = (id: string) => `strategy:${id}`
const ACTIVE_STRATEGY_KEY = "settings:activeStrategyId"

export async function listStrategies(): Promise<SrsStrategy[]> {
  const entries = await kvEntriesByPrefix<SrsStrategy>("strategy:")
  return entries.map((e) => e.value).sort((a, b) => a.createdAt - b.createdAt)
}

export async function getStrategy(id: string): Promise<SrsStrategy | undefined> {
  return kvGet<SrsStrategy>(strategyKey(id))
}

export async function createStrategy(input: {
  name: string
  buttons: SrsButton[]
}): Promise<SrsStrategy> {
  const strategy: SrsStrategy = {
    id: uid(),
    name: input.name.trim(),
    buttons: input.buttons,
    createdAt: Date.now(),
  }
  await kvSet(strategyKey(strategy.id), strategy)
  return strategy
}

export async function updateStrategy(
  strategy: SrsStrategy,
  patch: { name: string; buttons: SrsButton[] }
): Promise<void> {
  if (strategy.locked) return // stratégie par défaut : non modifiable
  await kvSet(strategyKey(strategy.id), {
    ...strategy,
    name: patch.name.trim(),
    buttons: patch.buttons,
  })
}

/**
 * Duplique une stratégie : mêmes choix (avec de nouveaux id, pour rester
 * indépendants de l'original), nom suffixé « (copie) ».
 */
export async function cloneStrategy(strategy: SrsStrategy): Promise<SrsStrategy> {
  const buttons: SrsButton[] = strategy.buttons.map((b) => ({ ...b, id: uid() }))
  return createStrategy({ name: `${strategy.name} (copie)`, buttons })
}

export async function deleteStrategy(id: string): Promise<void> {
  const all = await listStrategies()
  if (all.length <= 1) {
    // On garde toujours au moins une stratégie disponible.
    return
  }
  const target = all.find((s) => s.id === id)
  if (target?.locked) return // stratégie par défaut : non supprimable
  await kvDelete(strategyKey(id))

  const activeId = await getActiveStrategyId()
  if (activeId === id) {
    const fallback = all.find((s) => s.id !== id)
    if (fallback) await setActiveStrategyId(fallback.id)
  }
}

/**
 * Supprime toutes les stratégies. La stratégie « Par défaut » est
 * automatiquement recréée par `ensureDefaultStrategy` (au moins une
 * stratégie doit toujours exister) : cela réinitialise donc les stratégies
 * plutôt que de laisser l'app sans aucune.
 */
export async function deleteAllStrategies(): Promise<void> {
  const all = await kvEntriesByPrefix<SrsStrategy>("strategy:")
  await Promise.all(all.map((e) => kvDelete(e.key)))
  await kvDelete(ACTIVE_STRATEGY_KEY)
}

export async function getActiveStrategyId(): Promise<string | undefined> {
  return kvGet<string>(ACTIVE_STRATEGY_KEY)
}

export async function setActiveStrategyId(id: string): Promise<void> {
  await kvSet(ACTIVE_STRATEGY_KEY, id)
}

let ensureDefaultStrategyPromise: Promise<void> | null = null

/**
 * Garantit qu'au moins une stratégie existe (seed « Par défaut » au premier
 * lancement) et qu'une stratégie active est définie. Idempotent.
 *
 * Les appels concurrents (ex. double-montage en React StrictMode) partagent
 * la même promesse pour éviter une course où deux appels liraient tous les
 * deux « aucune stratégie » avant que l'un des deux n'ait eu le temps
 * d'écrire la sienne — ce qui créerait deux stratégies « Par défaut ».
 */
export function ensureDefaultStrategy(): Promise<void> {
  if (!ensureDefaultStrategyPromise) {
    ensureDefaultStrategyPromise = ensureDefaultStrategyOnce().finally(() => {
      ensureDefaultStrategyPromise = null
    })
  }
  return ensureDefaultStrategyPromise
}

async function ensureDefaultStrategyOnce(): Promise<void> {
  const existing = await listStrategies()
  if (existing.length === 0) {
    const strategy = createDefaultStrategy()
    await kvSet(strategyKey(strategy.id), strategy)
    await setActiveStrategyId(strategy.id)
    return
  }
  const activeId = await getActiveStrategyId()
  if (!activeId || !existing.some((s) => s.id === activeId)) {
    await setActiveStrategyId(existing[0].id)
  }
}
