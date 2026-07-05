import * as React from "react"

import { cn } from "@/lib/utils"
import { tagChipStyle } from "@/lib/candy"

interface TagChipProps extends Omit<React.ComponentProps<"button">, "color"> {
  name: string
  color: number
  selected?: boolean
  size?: "sm" | "md"
}

export const TagChip = React.forwardRef<HTMLButtonElement, TagChipProps>(
  function TagChip(
    { name, color, selected = false, className, size = "md", ...props },
    ref
  ) {
    const interactive = !!props.onClick
    return (
      <button
        ref={ref}
        type="button"
        style={tagChipStyle(color, selected)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap transition-all",
          size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
          interactive
            ? "cursor-pointer hover:brightness-110 active:scale-95"
            : "cursor-default",
          className
        )}
        {...props}
      >
        <span
          className="inline-block size-1.5 rounded-full"
          style={{
            backgroundColor: "currentColor",
            opacity: selected ? 0.6 : 0.9,
          }}
        />
        {name}
      </button>
    )
  }
)
