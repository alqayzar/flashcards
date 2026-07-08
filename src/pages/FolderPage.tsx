import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  GraduationCap,
  Search,
  Tag as TagIcon,
  Layers,
} from "lucide-react"

import type { Card, CardInput, Folder, Tag } from "@/lib/types"
import {
  addReverseCard,
  createCard,
  createTag,
  deleteCard,
  deleteTag,
  duplicateCard,
  getFilter,
  getFolder,
  listCards,
  listTags,
  removeReverseCard,
  resetCardDue,
  setFilter,
  updateCard,
  updateTag,
} from "@/lib/repo"
import { isCardDue } from "@/lib/srs/engine"
import {
  ensureDefaultStrategy,
  ensureFastStrategy,
  getActiveStrategyId,
} from "@/lib/srs/repo"
import { stripClozeBraces } from "@/lib/cloze"
import { matchesSearch } from "@/lib/search"
import { navigate, parsePageParam, useHashRoute } from "@/lib/useHashRoute"
import { useNow } from "@/lib/useNow"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CardItem } from "@/components/CardItem"
import { CardDialog } from "@/components/CardDialog"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { InfoDialog } from "@/components/InfoDialog"
import { StudyDialog } from "@/components/StudyDialog"
import { TagChip } from "@/components/TagChip"
import { TagsDialog } from "@/components/TagsDialog"

interface FolderPageProps {
  folderId: string
}

const GROUPS_PER_PAGE = 50

export function FolderPage({ folderId }: FolderPageProps) {
  // Page courante lue depuis l'URL (#/folder/{id}?page=N), pour pouvoir
  // partager/rafraîchir un lien vers une page précise.
  const hash = useHashRoute()
  const requestedPage = parsePageParam(hash)

  const [folder, setFolder] = useState<Folder | null | undefined>(undefined)
  const [tags, setTags] = useState<Tag[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tagsOpen, setTagsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  // Empêche d'écraser le filtre persisté avant de l'avoir chargé
  const filterHydrated = useRef(false)

  const [cardDialogOpen, setCardDialogOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<Card | undefined>()
  const [deletingCard, setDeletingCard] = useState<Card | undefined>()
  const [deletingTag, setDeletingTag] = useState<Tag | undefined>()
  const [deletingReverseOf, setDeletingReverseOf] = useState<Card | undefined>()
  const [studyOpen, setStudyOpen] = useState(false)
  const [nothingToReviewOpen, setNothingToReviewOpen] = useState(false)
  const [activeStrategyId, setActiveStrategyId] = useState<string>()
  // « Maintenant », mis à jour en temps réel pour les échéances/barres de progression
  const now = useNow()

  useEffect(() => {
    ensureDefaultStrategy()
      .then(ensureFastStrategy)
      .then(async () => {
        setActiveStrategyId(await getActiveStrategyId())
      })
  }, [])

  const loadFolder = useCallback(async () => {
    setFolder((await getFolder(folderId)) ?? null)
  }, [folderId])

  const loadTags = useCallback(async () => {
    setTags(await listTags(folderId))
  }, [folderId])

  const loadCards = useCallback(async () => {
    setCards(await listCards(folderId))
  }, [folderId])

  useEffect(() => {
    loadFolder()
    loadTags()
    loadCards()
    // Restaure les tags actifs persistés pour ce dossier
    filterHydrated.current = false
    getFilter(folderId).then((ids) => {
      setSelected(new Set(ids))
      filterHydrated.current = true
    })
  }, [folderId, loadFolder, loadTags, loadCards])

  // Persiste les tags actifs (une fois le filtre hydraté)
  useEffect(() => {
    if (!filterHydrated.current) return
    setFilter(folderId, [...selected])
  }, [folderId, selected])

  // Nettoie la sélection si un tag disparaît
  useEffect(() => {
    setSelected((cur) => {
      const valid = new Set(tags.map((t) => t.id))
      const next = new Set([...cur].filter((id) => valid.has(id)))
      return next.size === cur.size ? cur : next
    })
  }, [tags])

  const filteredCards = useMemo(() => {
    if (selected.size === 0) return cards
    // union : une carte est visible si elle possède au moins un tag sélectionné
    return cards.filter((c) => c.tagIds.some((id) => selected.has(id)))
  }, [cards, selected])

  // Regroupe chaque originale avec sa carte inversée et ses cartes cloze
  // (une par trou) liées, le cas échéant : affichées comme une seule cellule
  // de grille, empilées juste sous l'originale — quel que soit le nombre de
  // colonnes de la grille.
  const cardGroups = useMemo(() => {
    const reversedByOriginal = new Map<string, Card>()
    const clozeSiblingsByOriginal = new Map<string, Card[]>()
    for (const c of filteredCards) {
      if (c.reversedFrom) reversedByOriginal.set(c.reversedFrom, c)
      if (c.clozeOf) {
        const list = clozeSiblingsByOriginal.get(c.clozeOf) ?? []
        list.push(c)
        clozeSiblingsByOriginal.set(c.clozeOf, list)
      }
    }
    return filteredCards
      .filter((c) => !c.reversedFrom && c.clozeOf === undefined)
      .map((original) => ({
        original,
        clozeSiblings: (clozeSiblingsByOriginal.get(original.id) ?? []).sort(
          (a, b) => (a.clozeIndex ?? 0) - (b.clozeIndex ?? 0)
        ),
        reversed: reversedByOriginal.get(original.id),
      }))
  }, [filteredCards])

  // Recherche par mots-clés (guillemets = phrase exacte) : un groupe reste
  // visible si le terme apparaît dans n'importe laquelle de ses cartes
  // (originale, trous cloze liés, ou carte inversée).
  const searchedGroups = useMemo(() => {
    if (!searchQuery.trim()) return cardGroups
    return cardGroups.filter(({ original, clozeSiblings, reversed }) => {
      const group = [original, ...clozeSiblings, ...(reversed ? [reversed] : [])]
      const haystacks = group.flatMap((c) => [stripClozeBraces(c.front), c.back])
      return matchesSearch(haystacks, searchQuery)
    })
  }, [cardGroups, searchQuery])

  // Pagination : les cartes liées comptent avec leur originale pour 1 seul
  // groupe. La page demandée par l'URL est plafonnée au nombre réel de
  // pages (peut varier si le filtre ou la recherche change).
  const totalPages = Math.max(1, Math.ceil(searchedGroups.length / GROUPS_PER_PAGE))
  const page = Math.min(Math.max(1, requestedPage), totalPages)
  const pageGroups = useMemo(
    () => searchedGroups.slice((page - 1) * GROUPS_PER_PAGE, page * GROUPS_PER_PAGE),
    [searchedGroups, page]
  )

  function goToPage(p: number) {
    const clamped = Math.min(Math.max(1, p), totalPages)
    navigate(`/folder/${folderId}${clamped > 1 ? `?page=${clamped}` : ""}`)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Cartes proposées en révision : neuves ou dont l'échéance (pour la
  // stratégie active) est passée. Tant que la stratégie active n'est pas
  // encore chargée, aucune carte n'est due.
  const dueCards = useMemo(() => {
    if (!activeStrategyId) return []
    return filteredCards.filter((c) =>
      isCardDue(c.reviewState?.[activeStrategyId], now)
    )
  }, [filteredCards, activeStrategyId, now])

  const selectedTags = useMemo(
    () => tags.filter((t) => selected.has(t.id)),
    [tags, selected]
  )

  function toggleFilter(id: string) {
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openCreate() {
    setEditingCard(undefined)
    setCardDialogOpen(true)
  }

  function openEdit(card: Card) {
    setEditingCard(card)
    setCardDialogOpen(true)
  }

  const handleCreateTag = useCallback(
    async (name: string, color: number) => {
      const tag = await createTag(folderId, name, color)
      await loadTags()
      return tag
    },
    [folderId, loadTags]
  )

  async function handleSaveCard(data: CardInput, createReversed: boolean) {
    if (editingCard) await updateCard(editingCard, data)
    else await createCard(folderId, data, createReversed)
    await loadCards()
  }

  async function handleDuplicateCard(card: Card) {
    await duplicateCard(card)
    await loadCards()
  }

  async function handleCreateReverse(card: Card) {
    await addReverseCard(card)
    await loadCards()
  }

  async function handleDeleteReverse() {
    if (!deletingReverseOf) return
    await removeReverseCard(deletingReverseOf)
    await loadCards()
  }

  async function handleResetDue(card: Card) {
    if (!activeStrategyId) return
    await resetCardDue(card, activeStrategyId)
    await loadCards()
  }

  async function handleDeleteCard() {
    if (!deletingCard) return
    await deleteCard(deletingCard)
    await loadCards()
  }

  async function handleDeleteTag() {
    if (!deletingTag) return
    await deleteTag(deletingTag)
    await Promise.all([loadTags(), loadCards()])
  }

  async function handleRenameTag(tag: Tag, name: string) {
    await updateTag(tag, { name })
    await loadTags()
  }

  if (folder === undefined) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="h-8 w-40 animate-pulse rounded-md bg-card" />
      </div>
    )
  }

  if (folder === null) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-20 text-center">
        <p className="text-muted-foreground">Ce dossier n'existe pas.</p>
        <Button className="mt-4" onClick={() => navigate("/")}>
          <ArrowLeft /> Retour aux dossiers
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-28 sm:py-10 sm:pb-28">
      {/* En-tête */}
      <button
        type="button"
        onClick={() => navigate("/")}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
      >
        <ArrowLeft className="size-4" /> Tous les dossiers
      </button>

      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            {folder.name}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Layers className="size-4" />
              {cards.length} carte{cards.length > 1 ? "s" : ""}
              {selected.size > 0 && (
                <span className="text-primary">
                  · {filteredCards.length} filtrée
                  {filteredCards.length > 1 ? "s" : ""}
                </span>
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTagsOpen(true)}
              className="relative overflow-visible"
            >
              <TagIcon className="size-4" />
              Tags
              {selected.size > 0 && (
                <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-primary px-1 text-[11px] font-semibold text-primary-foreground shadow-sm">
                  {selected.size}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => {
                if (searchOpen) setSearchQuery("")
                setSearchOpen((o) => !o)
              }}
              title="Rechercher"
              className={searchOpen ? "border-primary/50 text-primary" : undefined}
            >
              <Search className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Recherche par mots-clés dans le recto/verso (sur les cartes déjà filtrées par tags) */}
      {searchOpen && (
        <div className="mb-7">
          <Input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Rechercher… guillemets pour une phrase exacte, ex. "acide aminé"'
          />
        </div>
      )}

      {/* Tags actifs : scroll horizontal, sans retour à la ligne */}
      {selected.size > 0 && (
        <div className="mb-7 flex items-center gap-2">
          <div className="flex flex-1 gap-2 overflow-x-auto py-1 px-1">
            {selectedTags.map((t) => (
              <TagChip
                key={t.id}
                name={t.name}
                color={t.color}
                selected
                onClick={() => toggleFilter(t.id)}
                className="shrink-0"
              />
            ))}
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mb-4">
          <Pagination page={page} totalPages={totalPages} onNavigate={goToPage} />
        </div>
      )}

      {/* Grille de cartes */}
      {cards.length === 0 ? (
        <EmptyCards onCreate={openCreate} />
      ) : cardGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-card/30 px-6 py-16 text-center text-sm text-muted-foreground">
          Aucune flashcard ne correspond aux tags sélectionnés.
        </div>
      ) : searchedGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-card/30 px-6 py-16 text-center text-sm text-muted-foreground">
          Aucune flashcard ne correspond à la recherche.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageGroups.map(({ original, clozeSiblings, reversed }) => {
            const stackSize = 1 + clozeSiblings.length + (reversed ? 1 : 0)
            return (
              <div key={original.id} className="min-w-0">
                <CardItem
                  card={original}
                  tags={tags}
                  activeStrategyId={activeStrategyId}
                  now={now}
                  hasReversedPair={!!reversed}
                  clozeSiblingCount={clozeSiblings.length}
                  className={stackSize > 1 ? "relative" : undefined}
                  style={stackSize > 1 ? { zIndex: stackSize } : undefined}
                  onEdit={() => openEdit(original)}
                  onDuplicate={() => handleDuplicateCard(original)}
                  onDelete={() => setDeletingCard(original)}
                  onResetDue={() => handleResetDue(original)}
                  onCreateReverse={() => handleCreateReverse(original)}
                  onDeleteReverse={() => setDeletingReverseOf(original)}
                />
                {clozeSiblings.map((sib, i) => (
                  <CardItem
                    key={sib.id}
                    card={sib}
                    tags={tags}
                    activeStrategyId={activeStrategyId}
                    now={now}
                    clozeOriginal={original}
                    className="relative -mt-3 mx-1 shadow-none"
                    style={{ zIndex: stackSize - 1 - i }}
                    onEdit={() => openEdit(sib)}
                    onDuplicate={() => handleDuplicateCard(sib)}
                    onDelete={() => setDeletingCard(sib)}
                    onResetDue={() => handleResetDue(sib)}
                    onCreateReverse={() => handleCreateReverse(sib)}
                    onDeleteReverse={() => setDeletingReverseOf(sib)}
                  />
                ))}
                {reversed && (
                  <CardItem
                    card={reversed}
                    tags={tags}
                    activeStrategyId={activeStrategyId}
                    now={now}
                    linkedOriginal={original}
                    className="relative -mt-3 mx-1 shadow-none"
                    style={{ zIndex: 0 }}
                    onEdit={() => openEdit(reversed)}
                    onDuplicate={() => handleDuplicateCard(reversed)}
                    onDelete={() => setDeletingCard(reversed)}
                    onResetDue={() => handleResetDue(reversed)}
                    onCreateReverse={() => handleCreateReverse(reversed)}
                    onDeleteReverse={() => setDeletingReverseOf(reversed)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onNavigate={goToPage} />
      )}

      {/* Dialogs */}
      <TagsDialog
        open={tagsOpen}
        onOpenChange={setTagsOpen}
        tags={tags}
        selected={selected}
        onToggle={toggleFilter}
        onReset={() => setSelected(new Set())}
        onRequestDelete={setDeletingTag}
        onRename={handleRenameTag}
        onCreateTag={handleCreateTag}
      />
      <CardDialog
        open={cardDialogOpen}
        onOpenChange={setCardDialogOpen}
        card={editingCard}
        tags={tags}
        defaultTagIds={[...selected]}
        onCreateTag={handleCreateTag}
        onSave={handleSaveCard}
      />
      <ConfirmDialog
        open={!!deletingCard}
        onOpenChange={(o) => !o && setDeletingCard(undefined)}
        title="Supprimer cette flashcard ?"
        description="Cette action est irréversible."
        onConfirm={handleDeleteCard}
      />
      <ConfirmDialog
        open={!!deletingTag}
        onOpenChange={(o) => !o && setDeletingTag(undefined)}
        title="Supprimer ce tag ?"
        description={`Le tag « ${deletingTag?.name} » sera retiré de toutes les flashcards du dossier.`}
        onConfirm={handleDeleteTag}
      />
      <ConfirmDialog
        open={!!deletingReverseOf}
        onOpenChange={(o) => !o && setDeletingReverseOf(undefined)}
        title="Supprimer la carte inversée ?"
        description="Seule la carte inversée liée est supprimée ; l'originale reste intacte."
        onConfirm={handleDeleteReverse}
      />
      <InfoDialog
        open={nothingToReviewOpen}
        onOpenChange={setNothingToReviewOpen}
        title="Rien à réviser"
        description="Toutes les cartes de ce dossier sont à jour pour l'instant. Reviens plus tard !"
      />
      <StudyDialog
        open={studyOpen}
        onOpenChange={(o) => {
          setStudyOpen(o)
          // Recharge les cartes à la fermeture pour refléter les échéances
          // mises à jour pendant la session (le bouton Réviser doit
          // immédiatement retomber juste si tout a été révisé).
          if (!o) loadCards()
        }}
        cards={dueCards}
      />

      {/* Barre d'actions fixe en bas de fenêtre */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl gap-2 px-4 py-3">
          <Button
            variant="outline"
            onClick={() => {
              if (dueCards.length === 0) setNothingToReviewOpen(true)
              else setStudyOpen(true)
            }}
            className="flex-1 border-emerald-500/40 bg-emerald-500/5 text-emerald-300 hover:border-emerald-400/60 hover:bg-emerald-500/15 hover:text-emerald-200"
          >
            <GraduationCap /> Réviser
          </Button>
          <Button onClick={openCreate} className="flex-1">
            <Plus /> Flashcard
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Liste de pages à afficher, avec « … » pour les trous (façon pagination classique). */
function pageList(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const keep = new Set([1, totalPages, page - 1, page, page + 1])
  const sorted = [...keep].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const result: (number | "…")[] = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("…")
    result.push(p)
    prev = p
  }
  return result
}

function Pagination({
  page,
  totalPages,
  onNavigate,
}: {
  page: number
  totalPages: number
  onNavigate: (page: number) => void
}) {
  return (
    <div className="mt-6 flex items-center justify-center gap-1">
      <Button
        variant="outline"
        size="icon-sm"
        disabled={page <= 1}
        onClick={() => onNavigate(page - 1)}
        title="Page précédente"
      >
        <ChevronLeft className="size-4" />
      </Button>
      {pageList(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`dots-${i}`} className="px-1 text-sm text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="icon-sm"
            onClick={() => onNavigate(p)}
          >
            {p}
          </Button>
        )
      )}
      <Button
        variant="outline"
        size="icon-sm"
        disabled={page >= totalPages}
        onClick={() => onNavigate(page + 1)}
        title="Page suivante"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}

function EmptyCards({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/30 px-4 py-20 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Plus className="size-8" />
      </div>
      <h2 className="font-serif text-xl font-semibold">Dossier vide</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Ajoute ta première flashcard avec un recto et un verso.
      </p>
      <Button className="mt-5" onClick={onCreate}>
        <Plus /> Nouvelle flashcard
      </Button>
    </div>
  )
}
