"use client"

import * as React from "react"
import { useFormStatus } from "react-dom"
import { ArrowRight, Plus, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSpaceAction, joinSpaceAction } from "@/app/actions"

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
  return (
    <form
      action={createSpaceAction}
      onSubmit={clearSpaceLocalState}
      className="flex flex-col gap-3"
    >
      <p className="text-muted-foreground text-sm">
        Start a new space and invite your friends with the code.
      </p>
      <CreateSubmit />
    </form>
  )
}

function CreateSubmit() {
  const { pending } = useFormStatus()
  return (
    <Button size="lg" type="submit" disabled={pending}>
      <Plus data-icon="inline-start" />
      {pending ? "Creating…" : "Create a new space"}
    </Button>
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
