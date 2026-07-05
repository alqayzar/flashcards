import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

interface SettingsSectionProps {
  title: string
  description?: string
  action?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * Section repliable de la page Paramètres. Repliée, seul le titre reste
 * visible (description et action masquées) ; dépliée, tout apparaît.
 */
export function SettingsSection({
  title,
  description,
  action,
  defaultOpen = true,
  children,
}: SettingsSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="border-b border-border/50 py-6 first:pt-0 last:border-b-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 items-start gap-2 text-left cursor-pointer"
        >
          <ChevronDown
            className={cn(
              "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
              !open && "-rotate-90"
            )}
          />
          <div className="min-w-0">
            <h2 className="font-serif text-xl font-semibold">{title}</h2>
            {open && description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </button>
        {open && action && <div className="shrink-0">{action}</div>}
      </div>
      {open && <div className="mt-4">{children}</div>}
    </section>
  )
}
