"use client"

import * as React from "react"
import {
  Megaphone,
  MoreHorizontal,
  Radio,
  Trash2,
  User,
  UserX,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Participant, PresenterRequest } from "@/lib/types"
import { removeParticipantAction } from "@/app/actions"

export function ParticipantsList({
  code,
  participants,
  myId,
  versePresenterId,
  presenterRequests,
  isAdmin,
  onChange,
  onGrantPresenter,
  onReclaimPresenter,
  onDenyPresenter,
}: {
  code: string
  participants: Participant[]
  myId: string | null
  versePresenterId: string | null
  presenterRequests: PresenterRequest[]
  isAdmin: boolean
  onChange?: () => void
  onGrantPresenter?: (participantId: string) => void
  onReclaimPresenter?: () => void
  onDenyPresenter?: (participantId: string) => void
}) {
  if (participants.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
        No one has joined yet. Add yourself on the left to get started.
      </div>
    )
  }
  // Oldest request first — spam-proof order that matches the spec.
  const requestByPid = new Map(
    presenterRequests.map((r) => [r.participantId, r]),
  )
  const sorted = [...participants].sort((a, b) => {
    const ra = requestByPid.get(a.id)?.firstRequestedAt
    const rb = requestByPid.get(b.id)?.firstRequestedAt
    if (ra && rb) return ra - rb
    if (ra) return -1
    if (rb) return 1
    return 0
  })
  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((p) => (
        <ParticipantRow
          key={p.id}
          code={code}
          participant={p}
          isMe={p.id === myId}
          isPresenter={p.id === versePresenterId}
          isRequestingPresenter={requestByPid.has(p.id)}
          isAdmin={isAdmin}
          onChange={onChange}
          onGrantPresenter={onGrantPresenter}
          onReclaimPresenter={onReclaimPresenter}
          onDenyPresenter={onDenyPresenter}
        />
      ))}
    </ul>
  )
}

function ParticipantRow({
  code,
  participant,
  isMe,
  isPresenter,
  isRequestingPresenter,
  isAdmin,
  onChange,
  onGrantPresenter,
  onReclaimPresenter,
  onDenyPresenter,
}: {
  code: string
  participant: Participant
  isMe: boolean
  isPresenter: boolean
  isRequestingPresenter: boolean
  isAdmin: boolean
  onChange?: () => void
  onGrantPresenter?: (participantId: string) => void
  onReclaimPresenter?: () => void
  onDenyPresenter?: (participantId: string) => void
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
        "pw-surface rounded-xl p-4 shadow-sm transition-colors",
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
            {isPresenter ? (
              <span className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                <Radio className="size-3" />
                presenter
              </span>
            ) : null}
            {isRequestingPresenter && !isPresenter ? (
              <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                <Megaphone className="size-3" />
                wants floor
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
          {isAdmin && isRequestingPresenter && !isPresenter ? (
            <Button
              type="button"
              size="xs"
              onClick={() => onGrantPresenter?.(participant.id)}
            >
              Grant
            </Button>
          ) : null}
          {isAdmin ? (
            <RowMenu
              isPresenter={isPresenter}
              absent={absent}
              onGrant={() => onGrantPresenter?.(participant.id)}
              onReclaim={() => onReclaimPresenter?.()}
              onDenyRequest={
                isRequestingPresenter
                  ? () => onDenyPresenter?.(participant.id)
                  : undefined
              }
              onRemove={remove}
              removing={removing}
            />
          ) : (isMe || absent) ? (
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

function RowMenu({
  isPresenter,
  absent,
  onGrant,
  onReclaim,
  onDenyRequest,
  onRemove,
  removing,
}: {
  isPresenter: boolean
  absent: boolean
  onGrant: () => void
  onReclaim: () => void
  onDenyRequest?: () => void
  onRemove: () => void
  removing: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onEsc)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen((s) => !s)}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal />
      </Button>
      {open ? (
        <div
          role="menu"
          className="bg-popover absolute right-0 z-20 mt-1 flex w-56 flex-col overflow-hidden rounded-md border shadow-lg"
        >
          {!absent ? (
            isPresenter ? (
              <MenuItem
                onClick={() => {
                  onReclaim()
                  setOpen(false)
                }}
              >
                Reclaim the floor
              </MenuItem>
            ) : (
              <MenuItem
                onClick={() => {
                  onGrant()
                  setOpen(false)
                }}
              >
                Grant verse floor
              </MenuItem>
            )
          ) : null}
          {onDenyRequest ? (
            <MenuItem
              onClick={() => {
                onDenyRequest()
                setOpen(false)
              }}
            >
              Deny request
            </MenuItem>
          ) : null}
          <MenuItem
            destructive
            disabled={removing}
            onClick={() => {
              onRemove()
              setOpen(false)
            }}
          >
            Remove from space
          </MenuItem>
        </div>
      ) : null}
    </div>
  )
}

function MenuItem({
  children,
  onClick,
  destructive,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "hover:bg-muted px-3 py-2 text-left text-sm transition-colors disabled:opacity-50",
        destructive && "text-destructive hover:bg-destructive/10",
      )}
    >
      {children}
    </button>
  )
}
