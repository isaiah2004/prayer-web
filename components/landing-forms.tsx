"use client"

import * as React from "react"
import { useFormStatus } from "react-dom"
import { useRouter } from "next/navigation"
import { ArrowRight, Plus, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSpaceAction, joinSpaceAction } from "@/app/actions"

const ADMIN_KEY = (code: string) => `prayer-web:admin-token:${code}`

function clearSpaceLocalState() {
  if (typeof window === "undefined") return
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith("prayer-web:")) keys.push(k)
    }
    for (const k of keys) localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}

export function CreateSpaceForm() {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onCreate() {
    setError(null)
    setPending(true)
    try {
      clearSpaceLocalState()
      const result = await createSpaceAction()
      try {
        localStorage.setItem(ADMIN_KEY(result.code), result.adminToken)
      } catch {
        /* ignore */
      }
      router.push(`/space/${result.code}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create space")
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Start a new space and invite your friends with the code.
      </p>
      <Button size="lg" onClick={onCreate} disabled={pending}>
        <Plus data-icon="inline-start" />
        {pending ? "Creating…" : "Create a new space"}
      </Button>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  )
}

export function JoinSpaceForm() {
  const [state, formAction] = React.useActionState(joinSpaceAction, {
    error: undefined,
  })
  return (
    <form
      action={formAction}
      onSubmit={clearSpaceLocalState}
      className="flex flex-col gap-3"
    >
      <Label htmlFor="code" className="text-muted-foreground">
        Have a code? Join a friend&apos;s space.
      </Label>
      <div className="flex gap-2">
        <Input
          id="code"
          name="code"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="ABC123"
          maxLength={10}
          className="font-mono tracking-widest uppercase"
        />
        <JoinSubmit />
      </div>
      {state?.error ? (
        <p className="text-destructive text-sm">{state.error}</p>
      ) : null}
    </form>
  )
}

function JoinSubmit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? "Joining…" : "Join"}
      <ArrowRight data-icon="inline-end" />
    </Button>
  )
}

export function LandingHero() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
        <Users className="size-3.5" />
        Pray for one another
      </div>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Prayer Request Randomizer
      </h1>
      <p className="text-muted-foreground max-w-xl text-balance">
        Create a space, share the code with friends, add your prayer requests,
        and let the randomizer pair each person with someone to pray for.
      </p>
    </div>
  )
}
