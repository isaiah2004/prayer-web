"use client"

import * as React from "react"
import { Trash2, User, UserX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Participant } from "@/lib/types"
import { removeParticipantAction } from "@/app/actions"

export function ParticipantsList({
  code,
  participants,
  myId,
  onChange,
  onClaim,
}: {
  code: string
  participants: Participant[]
  myId: string | null
  onChange?: () => void
  onClaim?: (participantId: string) => void
}) {
  if (participants.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
        No one has joined yet. Add yourself on the left to get started.
      </div>
    )
  }
  // If no one is claimed as "me" on this client, present people can be
  // claimed — useful when localStorage was cleared or the initial self-add
  // didn't persist.
  const claimAvailable = myId == null
  return (
    <ul className="flex flex-col gap-3">
      {participants.map((p) => (
        <ParticipantRow
          key={p.id}
          code={code}
          participant={p}
          isMe={p.id === myId}
          claimAvailable={claimAvailable}
          onChange={onChange}
          onClaim={onClaim}
        />
      ))}
    </ul>
  )
}

function ParticipantRow({
  code,
  participant,
  isMe,
  claimAvailable,
  onChange,
  onClaim,
}: {
  code: string
  participant: Participant
  isMe: boolean
  claimAvailable: boolean
  onChange?: () => void
  onClaim?: (participantId: string) => void
}) {
  const [removing, setRemoving] = React.useState(false)
  const [expanded, setExpanded] = React.useState(false)

  async function remove() {
    setRemoving(true)
    try {
      await removeParticipantAction(code, participant.id)
      onChange?.()
    } finally {
      setRemoving(false)
    }
  }

  const absent = !participant.present
  return (
    <li
      className={cn(
        "bg-card rounded-xl border p-4 shadow-sm transition-colors",
        isMe && "ring-primary/30 ring-2",
        absent && "opacity-75",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            absent
              ? "bg-muted text-muted-foreground"
              : "bg-primary/10 text-primary",
          )}
          aria-hidden
        >
          {absent ? <UserX className="size-4" /> : <User className="size-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{participant.name}</span>
            {isMe ? (
              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                you
              </span>
            ) : null}
            {absent ? (
              <span
                className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium"
                title="Not in the room. Others will pray for them but they won't be assigned to pray."
              >
                not present
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setExpanded((s) => !s)}
            className="text-muted-foreground hover:text-foreground mt-1 text-xs underline-offset-4 hover:underline"
          >
            {expanded ? "Hide request" : "Show request"}
          </button>
          {expanded ? (
            <div
              className="tiptap-editor text-foreground mt-2 rounded-md border bg-background/60 p-3"
              dangerouslySetInnerHTML={{ __html: participant.request }}
            />
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {claimAvailable && !absent ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onClaim?.(participant.id)}
              title="Claim this row as you. Useful if the app forgot who you are."
            >
              This is me
            </Button>
          ) : null}
          {isMe || absent ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={remove}
              disabled={removing}
              aria-label={isMe ? "Remove yourself" : "Remove this person"}
            >
              <Trash2 />
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  )
}
