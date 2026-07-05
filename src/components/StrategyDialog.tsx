import { useEffect, useState } from "react"
import { Check, Plus, Trash2 } from "lucide-react"

import { TIME_UNITS } from "@/lib/srs/types"
import type {
  Duration,
  DurationUnit,
  GraduateButton,
  RelearnButton,
  SrsButton,
  SrsStrategy,
} from "@/lib/srs/types"
import {
  createBlankButton,
  createDefaultButtons,
  formatShortDuration,
  isButtonValid,
  isStrategyValid,
  previewInitialInterval,
} from "@/lib/srs/engine"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const KIND_OPTIONS: { value: SrsButton["kind"]; label: string }[] = [
  { value: "relearn", label: "Réapparition fixe" },
  { value: "graduate", label: "Progression (ease / intervalle)" },
]

interface StrategyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** stratégie à éditer, ou undefined pour une création */
  strategy?: SrsStrategy
  onSave: (data: { name: string; buttons: SrsButton[] }) => Promise<void>
}

export function StrategyDialog({
  open,
  onOpenChange,
  strategy,
  onSave,
}: StrategyDialogProps) {
  const [name, setName] = useState("")
  const [buttons, setButtons] = useState<SrsButton[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(strategy?.name ?? "")
      setButtons(strategy?.buttons ?? createDefaultButtons())
    }
  }, [open, strategy])

  function updateLabel(id: string, label: string) {
    setButtons((cur) => cur.map((b) => (b.id === id ? { ...b, label } : b)))
  }

  function updateEaseDelta(id: string, easeDelta: number) {
    setButtons((cur) =>
      cur.map((b) => (b.id === id ? { ...b, easeDelta } : b))
    )
  }

  function updateRelearnDelay(id: string, patch: Partial<Duration>) {
    setButtons((cur) =>
      cur.map((b) =>
        b.id === id && b.kind === "relearn"
          ? { ...b, relearnDelay: { ...b.relearnDelay, ...patch } }
          : b
      )
    )
  }

  function updateIntervalMultiplier(id: string, intervalMultiplier: number) {
    setButtons((cur) =>
      cur.map((b) =>
        b.id === id && b.kind === "graduate" ? { ...b, intervalMultiplier } : b
      )
    )
  }

  function setKind(id: string, kind: SrsButton["kind"]) {
    setButtons((cur) =>
      cur.map((b) => {
        if (b.id !== id || b.kind === kind) return b
        if (kind === "relearn") {
          const next: RelearnButton = {
            id: b.id,
            label: b.label,
            kind: "relearn",
            easeDelta: b.easeDelta,
            relearnDelay: { value: 30, unit: "seconds" },
          }
          return next
        }
        const next: GraduateButton = {
          id: b.id,
          label: b.label,
          kind: "graduate",
          easeDelta: b.easeDelta,
          intervalMultiplier: 1,
        }
        return next
      })
    )
  }

  function addButton() {
    setButtons((cur) => [...cur, createBlankButton()])
  }

  function removeButton(id: string) {
    setButtons((cur) => (cur.length > 1 ? cur.filter((b) => b.id !== id) : cur))
  }

  const valid = isStrategyValid({ name, buttons })

  async function handleSave() {
    if (!valid) return
    setSaving(true)
    try {
      await onSave({ name, buttons })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>
            {strategy ? "Modifier la stratégie" : "Nouvelle stratégie"}
          </DialogTitle>
          <DialogDescription>
            Un choix « réapparition fixe » (façon Encore) reprogramme la
            carte après un délai. Un choix « progression » ajuste l'ease
            factor de la carte et multiplie son intervalle précédent.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="strategy-name">Nom</Label>
            <Input
              id="strategy-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Révision intensive"
            />
          </div>

          <div className="grid gap-2">
            <Label>Choix</Label>
            <div className="flex flex-col gap-2">
              {buttons.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/40 bg-muted/40 p-3"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={b.label}
                      onChange={(e) => updateLabel(b.id, e.target.value)}
                      placeholder="Libellé"
                      className="h-9 flex-1"
                    />
                    <span
                      className="shrink-0 text-xs text-muted-foreground"
                      title="Aperçu pour une carte neuve"
                    >
                      {formatShortDuration(previewInitialInterval(b))}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeButton(b.id)}
                      disabled={buttons.length <= 1}
                      title="Retirer ce choix"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  <Select
                    value={b.kind}
                    onValueChange={(kind: SrsButton["kind"]) =>
                      setKind(b.id, kind)
                    }
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KIND_OPTIONS.map((k) => (
                        <SelectItem key={k.value} value={k.value}>
                          {k.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {b.kind === "graduate" ? (
                    <div className="flex flex-col gap-2">
                      <div>
                        <span className="text-[11px] text-muted-foreground">
                          Ajustement ease (%)
                        </span>
                        <Input
                          type="number"
                          step="any"
                          value={b.easeDelta}
                          onChange={(e) =>
                            updateEaseDelta(b.id, e.target.valueAsNumber || 0)
                          }
                          className="h-9"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground">
                          Multiplicateur d'intervalle (×)
                        </span>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={b.intervalMultiplier}
                          onChange={(e) =>
                            updateIntervalMultiplier(
                              b.id,
                              e.target.valueAsNumber || 0
                            )
                          }
                          className="h-9"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <span className="text-[11px] text-muted-foreground">
                          Ajustement ease (%)
                        </span>
                        <Input
                          type="number"
                          step="any"
                          value={b.easeDelta}
                          onChange={(e) =>
                            updateEaseDelta(b.id, e.target.valueAsNumber || 0)
                          }
                          className="h-9"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <span className="text-[11px] text-muted-foreground">
                            Réapparaît après
                          </span>
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            value={b.relearnDelay.value}
                            onChange={(e) =>
                              updateRelearnDelay(b.id, {
                                value: e.target.valueAsNumber || 0,
                              })
                            }
                            className="h-9"
                          />
                        </div>
                        <Select
                          value={b.relearnDelay.unit}
                          onValueChange={(unit: DurationUnit) =>
                            updateRelearnDelay(b.id, { unit })
                          }
                        >
                          <SelectTrigger className="h-9 flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_UNITS.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            {buttons.some((b) => !isButtonValid(b)) && (
              <p className="text-xs text-destructive">
                Chaque choix doit avoir un libellé, et un délai ou un
                multiplicateur supérieur à 0.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addButton}
              className="self-start"
            >
              <Plus /> Ajouter un choix
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || !valid}>
            <Check /> {strategy ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
