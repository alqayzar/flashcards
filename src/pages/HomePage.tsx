import { useEffect, useState } from "react"
import { Plus, FolderPlus, Settings, Sparkles } from "lucide-react"

import type { Card, Folder } from "@/lib/types"
import {
  createFolder,
  deleteFolder,
  duplicateFolder,
  listCards,
  listFolders,
  updateFolder,
} from "@/lib/repo"
import { isCardDue } from "@/lib/srs/engine"
import { ensureDefaultStrategy, getActiveStrategyId } from "@/lib/srs/repo"
import { navigate } from "@/lib/useHashRoute"
import { Button } from "@/components/ui/button"
import { FolderCard } from "@/components/FolderCard"
import { FolderDialog } from "@/components/FolderDialog"
import { DuplicateFolderDialog } from "@/components/DuplicateFolderDialog"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { InfoDialog } from "@/components/InfoDialog"
import { StudyDialog } from "@/components/StudyDialog"

export function HomePage() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Folder | undefined>()
  const [deleting, setDeleting] = useState<Folder | undefined>()
  const [duplicating, setDuplicating] = useState<Folder | undefined>()
  const [reviewCards, setReviewCards] = useState<Card[]>([])
  const [studyOpen, setStudyOpen] = useState(false)
  const [nothingToReviewOpen, setNothingToReviewOpen] = useState(false)

  async function refresh() {
    setFolders(await listFolders())
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  function openCreate() {
    setEditing(undefined)
    setDialogOpen(true)
  }

  function openEdit(folder: Folder) {
    setEditing(folder)
    setDialogOpen(true)
  }

  async function handleSave(name: string) {
    if (editing) await updateFolder(editing.id, { name })
    else await createFolder(name)
    await refresh()
  }

  async function handleDelete() {
    if (!deleting) return
    await deleteFolder(deleting.id)
    await refresh()
  }

  async function handleDuplicate(includeReviewState: boolean) {
    if (!duplicating) return
    await duplicateFolder(duplicating.id, { includeReviewState })
    await refresh()
  }

  // Même comportement que le bouton « Réviser » de la page d'un dossier,
  // déclenchable directement depuis le menu d'un dossier sans y entrer.
  async function handleReview(folder: Folder) {
    await ensureDefaultStrategy()
    const activeStrategyId = await getActiveStrategyId()
    const cards = await listCards(folder.id)
    const due = activeStrategyId
      ? cards.filter((c) => isCardDue(c.reviewState?.[activeStrategyId]))
      : []
    if (due.length === 0) {
      setNothingToReviewOpen(true)
    } else {
      setReviewCards(due)
      setStudyOpen(true)
    }
  }

  return (
    <div className="mx-auto flex h-dvh max-w-5xl flex-col px-4 py-10 sm:py-14">
      {/* En-tête */}
      <header className="mb-10 flex shrink-0 flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" /> Nocturne Academia
          </div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
            Mes dossiers
          </h1>
          <p className="mt-2 max-w-md text-muted-foreground">
            Organise ta révision par dossiers indépendants, chacun avec ses
            propres flashcards et tags.
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button size="lg" onClick={openCreate} className="flex-1 sm:flex-none">
            <Plus /> Nouveau dossier
          </Button>
          <Button
            variant="outline"
            size="icon-lg"
            onClick={() => navigate("/settings")}
            title="Paramètres"
            className="flex-1 sm:flex-none"
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </header>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto pb-8">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl border border-border/50 bg-card/50"
              />
            ))}
          </div>
        ) : folders.length === 0 ? (
          <EmptyFolders onCreate={openCreate} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {folders.map((folder, i) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                accent={i + 1}
                onEdit={() => openEdit(folder)}
                onDuplicate={() => setDuplicating(folder)}
                onReview={() => handleReview(folder)}
                onDelete={() => setDeleting(folder)}
              />
            ))}
          </div>
        )}
      </div>

      <FolderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        folder={editing}
        onSave={handleSave}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title="Supprimer ce dossier ?"
        description={`« ${deleting?.name} » ainsi que toutes ses flashcards et tags seront définitivement supprimés.`}
        onConfirm={handleDelete}
      />
      <DuplicateFolderDialog
        open={!!duplicating}
        onOpenChange={(o) => !o && setDuplicating(undefined)}
        folder={duplicating}
        onDuplicate={handleDuplicate}
      />
      <InfoDialog
        open={nothingToReviewOpen}
        onOpenChange={setNothingToReviewOpen}
        title="Rien à réviser"
        description="Toutes les cartes de ce dossier sont à jour pour l'instant. Reviens plus tard !"
      />
      <StudyDialog
        open={studyOpen}
        onOpenChange={setStudyOpen}
        cards={reviewCards}
      />
    </div>
  )
}

function EmptyFolders({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/30 px-6 py-20 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <FolderPlus className="size-8" />
      </div>
      <h2 className="font-serif text-xl font-semibold">Aucun dossier</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Crée ton premier dossier pour commencer à ajouter des flashcards.
      </p>
      <Button className="mt-5" onClick={onCreate}>
        <Plus /> Créer un dossier
      </Button>
    </div>
  )
}
