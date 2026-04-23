"use client"

import * as React from "react"
import { UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PrayerEditor } from "@/components/prayer-editor"
import { addParticipantAction } from "@/app/actions"

const LAST_NAME_KEY = "prayer-web:last-name"

export function AddParticipant({
  code,
  onAdded,
}: {
  code: string
  onAdded?: (participantId: string) => void
}) {
  const [name, setName] = React.useState("")
  const [request, setRequest] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const [isReset, setIsReset] = React.useState(0)

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_NAME_KEY)
      if (saved) setName(saved)
    } catch {
      /* ignore */
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const result = await addParticipantAction(code, name, request)
      if (!result.ok) {
        setError(result.error ?? "Something went wrong")
        return
      }
      try {
        localStorage.setItem(LAST_NAME_KEY, name)
      } catch {
        /* ignore */
      }
      setRequest("")
      setIsReset((n) => n + 1)
      if (result.participantId) onAdded?.(result.participantId)
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="participant-name">Your name</Label>
        <Input
          id="participant-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alex"
          maxLength={60}
          required
          autoComplete="name"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Your prayer request</Label>
        <PrayerEditor
          key={isReset}
          value={request}
          onChange={setRequest}
          placeholder="What would you like others to pray for?"
        />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" disabled={pending} className="self-start">
        <UserPlus data-icon="inline-start" />
        {pending ? "Adding…" : "Add to space"}
      </Button>
    </form>
  )
}
