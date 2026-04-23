"use client"

import * as React from "react"
import { UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PrayerEditor } from "@/components/prayer-editor"
import {
  addParticipantAction,
  addOtherParticipantAction,
} from "@/app/actions"

const LAST_NAME_KEY = "prayer-web:last-name"
const MY_ID_KEY = (code: string) => `prayer-web:my-id:${code}`

type Mode = "self" | "other"

export function AddParticipant({
  code,
  mode = "self",
  onAdded,
}: {
  code: string
  mode?: Mode
  onAdded?: (participantId: string) => void
}) {
  const [name, setName] = React.useState("")
  const [request, setRequest] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const [isReset, setIsReset] = React.useState(0)

  React.useEffect(() => {
    if (mode !== "self") return
    try {
      const saved = localStorage.getItem(LAST_NAME_KEY)
      if (saved) setName(saved)
    } catch {
      /* ignore */
    }
  }, [mode])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const action =
        mode === "self" ? addParticipantAction : addOtherParticipantAction
      const result = await action(code, name, request)
      if (!result.ok) {
        setError(result.error ?? "Something went wrong")
        return
      }
      if (mode === "self") {
        try {
          localStorage.setItem(LAST_NAME_KEY, name)
          // Also write my-id here so the key is guaranteed to be persisted
          // even if the parent onAdded is lost to a fast re-render.
          if (result.participantId) {
            localStorage.setItem(MY_ID_KEY(code), result.participantId)
          }
        } catch {
          /* ignore */
        }
      }
      setName(mode === "self" ? name : "")
      setRequest("")
      setIsReset((n) => n + 1)
      if (result.participantId) onAdded?.(result.participantId)
    } finally {
      setPending(false)
    }
  }

  const nameLabel = mode === "self" ? "Your name" : "Their name"
  const requestLabel =
    mode === "self" ? "Your prayer request" : "Their prayer request"
  const placeholder =
    mode === "self"
      ? "What would you like others to pray for?"
      : "What would they like prayer for?"
  const buttonLabel =
    mode === "self"
      ? pending
        ? "Adding…"
        : "Add me to space"
      : pending
        ? "Adding…"
        : "Add to space"

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`participant-name-${mode}`}>{nameLabel}</Label>
        <Input
          id={`participant-name-${mode}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={mode === "self" ? "e.g. Alex" : "e.g. Sam (not here)"}
          maxLength={60}
          required
          autoComplete={mode === "self" ? "name" : "off"}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{requestLabel}</Label>
        <PrayerEditor
          key={isReset}
          value={request}
          onChange={setRequest}
          placeholder={placeholder}
        />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" disabled={pending} className="self-start">
        <UserPlus data-icon="inline-start" />
        {buttonLabel}
      </Button>
    </form>
  )
}
