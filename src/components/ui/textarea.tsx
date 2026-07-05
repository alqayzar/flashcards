import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground flex min-h-20 w-full rounded-md border border-input bg-input/20 px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none field-sizing-content",
        "focus-visible:border-primary/60 focus-visible:ring-primary/30 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/30 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
