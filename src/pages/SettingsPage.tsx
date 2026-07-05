import { useEffect, useState } from "react"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"

import type { SrsButton, SrsStrategy } from "@/lib/srs/types"
import { deleteAllFolders } from "@/lib/repo"
import {
  cloneStrategy,
  createStrategy,
  deleteAllStrategies,
  deleteStrategy,
  ensureDefaultStrategy,
  getActiveStrategyId,
  listStrategies,
  setActiveStrategyId,
  updateStrategy,
} from "@/lib/srs/repo"
import { navigate } from "@/lib/useHashRoute"
import { Button } from "@/components/ui/button"
import { SettingsSection } from "@/components/SettingsSection"
import { StrategyCard } from "@/components/StrategyCard"
import { StrategyDialog } from "@/components/StrategyDialog"
import { ConfirmDialog } from "@/components/ConfirmDialog"

export function SettingsPage() {
  const [strategies, setStrategies] = useState<SrsStrategy[]>([])
  const [activeId, setActiveId] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStrategy, setEditingStrategy] = useState<SrsStrategy | undefined>()
  const [deletingStrategy, setDeletingStrategy] = useState<SrsStrategy | undefined>()
  const [wipeAllOpen, setWipeAllOpen] = useState(false)
  const [resetStrategiesOpen, setResetStrategiesOpen] = useState(false)

  async function refresh() {
    const [list, active] = await Promise.all([
      listStrategies(),
      getActiveStrategyId(),
    ])
    setStrategies(list)
    setActiveId(active)
    setLoading(false)
  }

  useEffect(() => {
    ensureDefaultStrategy().then(refresh)
  }, [])

  function openCreate() {
    setEditingStrategy(undefined)
    setDialogOpen(true)
  }

  function openEdit(strategy: SrsStrategy) {
    setEditingStrategy(strategy)
    setDialogOpen(true)
  }

  async function handleSave(data: { name: string; buttons: SrsButton[] }) {
    if (editingStrategy) await updateStrategy(editingStrategy, data)
    else await createStrategy(data)
    await refresh()
  }

  async function handleSetActive(id: string) {
    await setActiveStrategyId(id)
    await refresh()
  }

  async function handleDelete() {
    if (!deletingStrategy) return
    await deleteStrategy(deletingStrategy.id)
    await refresh()
  }

  async function handleDuplicate(strategy: SrsStrategy) {
    await cloneStrategy(strategy)
    await refresh()
  }

  async function handleWipeAll() {
    await deleteAllFolders()
  }

  async function handleResetStrategies() {
    await deleteAllStrategies()
    await ensureDefaultStrategy()
    await refresh()
  }

  return (
    <div className="mx-auto flex h-dvh max-w-5xl flex-col px-4 py-8 sm:py-10">
      <div className="shrink-0">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="size-4" /> Retour
        </button>

        <header className="mb-8">
          <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            Paramètres
          </h1>
        </header>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-8">
        <SettingsSection
          title="Stratégies de révision"
          description="Chaque choix de révision programme la prochaine apparition d'une carte après un délai. Personnalise-les ou crée tes propres stratégies."
          action={
            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus /> Nouvelle stratégie
            </Button>
          }
          defaultOpen
        >
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-40 animate-pulse rounded-xl border border-border/50 bg-card/50"
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {strategies.map((strategy) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  active={strategy.id === activeId}
                  canDelete={strategies.length > 1}
                  onEdit={() => openEdit(strategy)}
                  onSetActive={() => handleSetActive(strategy.id)}
                  onDuplicate={() => handleDuplicate(strategy)}
                  onDelete={() => setDeletingStrategy(strategy)}
                />
              ))}
            </div>
          )}
        </SettingsSection>

        <SettingsSection
          title="Avancées"
          defaultOpen={false}
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="destructive"
              onClick={() => setWipeAllOpen(true)}
              className="w-full sm:w-auto"
            >
              <Trash2 /> Tout supprimer (dossiers, tags, images)
            </Button>
            <Button
              variant="destructive"
              onClick={() => setResetStrategiesOpen(true)}
              className="w-full sm:w-auto"
            >
              <Trash2 /> Réinitialiser les stratégies
            </Button>
          </div>
        </SettingsSection>
      </div>

      <StrategyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        strategy={editingStrategy}
        onSave={handleSave}
      />
      <ConfirmDialog
        open={!!deletingStrategy}
        onOpenChange={(o) => !o && setDeletingStrategy(undefined)}
        title="Supprimer cette stratégie ?"
        description={`« ${deletingStrategy?.name} » sera définitivement supprimée.`}
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={wipeAllOpen}
        onOpenChange={setWipeAllOpen}
        title="Tout supprimer ?"
        description="Tous les dossiers, tags, flashcards et images seront définitivement supprimés. Cette action est irréversible."
        confirmLabel="Tout supprimer"
        onConfirm={handleWipeAll}
      />
      <ConfirmDialog
        open={resetStrategiesOpen}
        onOpenChange={setResetStrategiesOpen}
        title="Réinitialiser les stratégies ?"
        description="Toutes tes stratégies de révision personnalisées seront supprimées ; seule la stratégie « Par défaut » sera conservée."
        confirmLabel="Réinitialiser"
        onConfirm={handleResetStrategies}
      />
    </div>
  )
}
