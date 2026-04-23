"use client"

import * as React from "react"
import { Check, X as XIcon, Shuffle, Dices } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { SpinRequest } from "@/lib/types"

type Props = {
  spinRequests: SpinRequest[]
  onApprove: (kind: "pair" | "roulette") => void | Promise<void>
  onDeny: (kind: "pair" | "roulette") => void | Promise<void>
}

export function AdminRequestsBanner({
  spinRequests,
  onApprove,
  onDeny,
}: Props) {
  if (spinRequests.length === 0) return null
  // Oldest request on top — UI stable against spam reshuffling.
  const sorted = [...spinRequests].sort(
    (a, b) => a.firstRequestedAt - b.firstRequestedAt,
  )
  return (
    <div className="flex flex-col gap-2">
      {sorted.map((req) => {
        const extraCount = Math.max(0, req.requesterIds.length - 1)
        const label =
          req.kind === "pair"
            ? "Prayer-pair reroll request"
            : "Prayer-roulette spin request"
        return (
          <div
            key={req.kind}
            className="border-primary/40 bg-primary/5 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 shadow-sm"
          >
            <div className="text-primary">
              {req.kind === "pair" ? (
                <Shuffle className="size-4" />
              ) : (
                <Dices className="size-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{label}</div>
              <div className="text-muted-foreground text-xs">
                {req.firstRequesterName}
                {extraCount > 0 ? ` + ${extraCount} more` : ""}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                onClick={() => onApprove(req.kind)}
                aria-label={`Approve ${req.kind} request`}
              >
                <Check data-icon="inline-start" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDeny(req.kind)}
                aria-label={`Deny ${req.kind} request`}
              >
                <XIcon data-icon="inline-start" />
                Deny
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
