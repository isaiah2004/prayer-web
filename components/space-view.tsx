"use client"

import * as React from "react"
import useSWR from "swr"
import Link from "next/link"
import {
  ArrowLeft,
  BookOpen,
  Dices,
  RefreshCcw,
  Shuffle,
  Sparkles,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AddParticipant } from "@/components/add-participant"
import { CopyCode } from "@/components/copy-code"
import { ParticipantsList } from "@/components/participants-list"
import { RandomizeReveal } from "@/components/randomize-reveal"
import { PrayerRoulette } from "@/components/prayer-roulette"
import { VerseView } from "@/components/verse-view"
import { ThemeToggle } from "@/components/theme-toggle"
import { AdminRequestsBanner } from "@/components/admin-requests-banner"
import type { RoulettePick, SpacePublic } from "@/lib/types"
import {
  randomizeAction,
  resetAction,
  requestSpinAction,
  approveSpinRequestAction,
  denySpinRequestAction,
  grantVersePresenterAction,
  reclaimVersePresenterAction,
  denyPresenterRequestAction,
} from "@/app/actions"

const MY_ID_KEY = (code: string) => `prayer-web:my-id:${code}`
const LAST_NAME_KEY = "prayer-web:last-name"
const ADMIN_KEY = (code: string) => `prayer-web:admin-token:${code}`

async function fetcher(url: string) {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load space")
  return (await res.json()) as SpacePublic
}

export function SpaceView({ initial }: { initial: SpacePublic }) {
  const { data, mutate } = useSWR<SpacePublic>(
    `/api/space/${initial.code}`,
    fetcher,
    {
      fallbackData: initial,
      refreshInterval: 1500,
      revalidateOnFocus: true,
    },
  )

  const space = data ?? initial
  const [myId, setMyId] = React.useState<string | null>(null)
  const [adminToken, setAdminToken] = React.useState<string | null>(null)
  const [revealOpen, setRevealOpen] = React.useState(false)
  const [rouletteOpen, setRouletteOpen] = React.useState(false)
  const [verseOpen, setVerseOpen] = React.useState(false)
  const [randomizing, setRandomizing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const isAdmin = !!adminToken

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(ADMIN_KEY(space.code))
      if (stored) setAdminToken(stored)
    } catch {
      /* ignore */
    }
  }, [space.code])

  // Broadcast sync: remember which events we've already surfaced, so the
  // next SWR tick can auto-open the matching modal for everyone in the room.
  const seenRandomizedAtRef = React.useRef<number | null>(
    initial.randomizedAt ?? null,
  )
  const seenSpinAtRef = React.useRef<number | null>(
    initial.roulette?.history?.[0]?.pickedAt ?? null,
  )
  const latestSpin: RoulettePick | null =
    space.roulette?.history?.[0] ?? null
  const [pendingPick, setPendingPick] = React.useState<RoulettePick | null>(
    null,
  )

  React.useEffect(() => {
    if (!space.randomizedAt) return
    if (
      seenRandomizedAtRef.current == null ||
      space.randomizedAt > seenRandomizedAtRef.current
    ) {
      seenRandomizedAtRef.current = space.randomizedAt
      setRevealOpen(true)
    }
  }, [space.randomizedAt])

  React.useEffect(() => {
    if (!latestSpin) return
    if (
      seenSpinAtRef.current == null ||
      latestSpin.pickedAt > seenSpinAtRef.current
    ) {
      seenSpinAtRef.current = latestSpin.pickedAt
      setRouletteOpen(true)
      setPendingPick(latestSpin)
    }
  }, [latestSpin])

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(MY_ID_KEY(space.code))
      if (stored) {
        if (space.participants.some((p) => p.id === stored)) {
          setMyId(stored)
          return
        } else if (space.participants.length > 0) {
          // Participants loaded but our stored id isn't among them — they
          // were removed. Clear so we don't falsely claim someone else's
          // identity.
          localStorage.removeItem(MY_ID_KEY(space.code))
        }
      }
      // Fallback: match by last-name that this browser used when adding
      // someone else (e.g. if saveMyId was lost to a race, or localStorage
      // was cleared between sessions). Only auto-claim when exactly one
      // present participant has that name.
      const lastName = localStorage.getItem(LAST_NAME_KEY)?.trim().toLowerCase()
      if (!lastName) {
        setMyId(null)
        return
      }
      const matches = space.participants.filter(
        (p) => p.present && p.name.trim().toLowerCase() === lastName,
      )
      if (matches.length === 1) {
        const match = matches[0]
        localStorage.setItem(MY_ID_KEY(space.code), match.id)
        setMyId(match.id)
      } else {
        setMyId(null)
      }
    } catch {
      /* ignore */
    }
  }, [space.code, space.participants])

  function saveMyId(id: string) {
    try {
      localStorage.setItem(MY_ID_KEY(space.code), id)
    } catch {
      /* ignore */
    }
    setMyId(id)
  }

  async function onRandomize() {
    setError(null)
    if (!myId) {
      setError("Add yourself to the space before triggering anything.")
      return
    }
    setRandomizing(true)
    try {
      if (isAdmin) {
        const result = await randomizeAction(space.code, adminToken)
        if (!result.ok) {
          setError(result.error ?? "Couldn't generate pairs")
          return
        }
        await mutate()
        setRevealOpen(true)
      } else {
        const result = await requestSpinAction(space.code, "pair", myId)
        if (!result.ok) {
          setError(result.error ?? "Couldn't request")
          return
        }
        await mutate()
      }
    } finally {
      setRandomizing(false)
    }
  }

  async function onReset() {
    if (!isAdmin) return
    await resetAction(space.code, adminToken)
    await mutate()
  }

  async function onApproveSpin(kind: "pair" | "roulette") {
    if (!isAdmin) return
    await approveSpinRequestAction(space.code, kind, adminToken)
    await mutate()
    if (kind === "pair") setRevealOpen(true)
  }

  async function onDenySpin(kind: "pair" | "roulette") {
    if (!isAdmin) return
    await denySpinRequestAction(space.code, kind, adminToken)
    await mutate()
  }

  async function onGrantPresenter(participantId: string) {
    if (!isAdmin) return
    await grantVersePresenterAction(space.code, adminToken, participantId)
    await mutate()
  }

  async function onReclaimPresenter() {
    if (!isAdmin) return
    await reclaimVersePresenterAction(space.code, adminToken)
    await mutate()
  }

  async function onDenyPresenter(participantId: string) {
    if (!isAdmin) return
    await denyPresenterRequestAction(space.code, participantId, adminToken)
    await mutate()
  }

  const presentCount = space.participants.filter((p) => p.present).length
  const canRandomize = space.participants.length >= 2 && presentCount >= 1
  const canRoulette = presentCount >= 1

  return (
    <main className="animated-gradient min-h-svh bg-gradient-to-br from-indigo-50 via-violet-50 to-pink-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft data-icon="inline-start" />
              Home
            </Link>
          </Button>
          <div className="flex flex-1 items-center justify-end gap-2 sm:max-w-sm">
            {isAdmin ? (
              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                admin
              </span>
            ) : null}
            <CopyCode code={space.code} className="flex-1" />
            <ThemeToggle />
          </div>
        </div>

        {isAdmin && space.spinRequests.length > 0 ? (
          <AdminRequestsBanner
            spinRequests={space.spinRequests}
            onApprove={onApproveSpin}
            onDeny={onDenySpin}
          />
        ) : null}

        {!isAdmin && space.spinRequests.length > 0 ? (
          <div className="bg-muted text-muted-foreground rounded-xl border px-4 py-3 text-sm">
            {space.spinRequests.length === 1
              ? `A ${space.spinRequests[0].kind === "pair" ? "prayer-pair" : "roulette"} request is waiting for the admin to approve.`
              : `${space.spinRequests.length} spin requests are waiting for the admin.`}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="flex flex-col gap-4 lg:col-span-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="text-primary size-4" />
                    The prayer circle
                  </CardTitle>
                  <CardDescription>
                    {space.participants.length}{" "}
                    {space.participants.length === 1 ? "person" : "people"} so
                    far
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {space.assignments ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRevealOpen(true)}
                      >
                        <Sparkles data-icon="inline-start" />
                        View pairs
                      </Button>
                      {isAdmin ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={onReset}
                          title="Clear current pairs"
                        >
                          <RefreshCcw data-icon="inline-start" />
                          Reset
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                <ParticipantsList
                  code={space.code}
                  participants={space.participants}
                  myId={myId}
                  versePresenterId={space.versePresenterId ?? null}
                  presenterRequests={space.presenterRequests ?? []}
                  isAdmin={isAdmin}
                  onChange={() => {
                    void mutate()
                  }}
                  onGrantPresenter={onGrantPresenter}
                  onReclaimPresenter={onReclaimPresenter}
                  onDenyPresenter={onDenyPresenter}
                />
              </CardContent>
            </Card>

            <div className="flex flex-col items-center gap-3 py-2">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  size="lg"
                  onClick={onRandomize}
                  disabled={!canRandomize || randomizing || !myId}
                  className="group relative h-14 min-w-64 bg-gradient-to-br from-indigo-600 via-violet-600 to-pink-600 text-base font-semibold text-white hover:from-indigo-500 hover:via-violet-500 hover:to-pink-500 disabled:opacity-60"
                  title={!myId ? "Add yourself first" : undefined}
                >
                  <Shuffle data-icon="inline-start" />
                  {randomizing
                    ? "Shuffling…"
                    : isAdmin
                      ? space.assignments
                        ? "Regenerate prayer pairs"
                        : "Generate prayer pairs"
                      : "Request prayer pairs"}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setRouletteOpen(true)}
                  disabled={!canRoulette || !myId}
                  className="h-14 min-w-48 text-base"
                  title={
                    !myId
                      ? "Add yourself first"
                      : "Pick a random person to lead prayer"
                  }
                >
                  <Dices data-icon="inline-start" />
                  Prayer Roulette
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setVerseOpen(true)}
                  className="h-14 min-w-48 text-base"
                  title="Open the shared verse view"
                >
                  <BookOpen data-icon="inline-start" />
                  Verse View
                  {space.verse ? (
                    <span className="bg-primary/10 text-primary ml-2 rounded-full px-2 py-0.5 text-xs font-medium">
                      {space.verse.reference}
                    </span>
                  ) : null}
                </Button>
              </div>
              <p className="text-muted-foreground text-center text-xs">
                {canRandomize
                  ? "Generate prayer pairs to cover everyone, spin the roulette to pick a leader, or open Verse View to share scripture."
                  : "Add people to enable pair generation. Roulette needs 1+. Verse View works anytime."}
              </p>
              {error ? (
                <p className="text-destructive text-sm">{error}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:col-span-2">
            {myId ? (
              <Card>
                <CardHeader>
                  <CardTitle>You&apos;re in the circle</CardTitle>
                  <CardDescription>
                    Use &quot;Remove yourself&quot; on your row if you want to
                    change your name or request.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Add yourself</CardTitle>
                  <CardDescription>
                    Enter your name and the prayer request you&apos;d like
                    others to cover.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AddParticipant
                    code={space.code}
                    mode="self"
                    onAdded={(id) => {
                      saveMyId(id)
                      void mutate()
                    }}
                  />
                </CardContent>
              </Card>
            )}

            {myId ? (
              <Card>
                <CardHeader>
                  <CardTitle>Add someone not here</CardTitle>
                  <CardDescription>
                    Add a friend who isn&apos;t in the room so everyone can
                    still pray for their request. They won&apos;t be assigned
                    to pray and won&apos;t show up in the roulette.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AddParticipant
                    code={space.code}
                    mode="other"
                    onAdded={() => {
                      void mutate()
                    }}
                  />
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>

      <RandomizeReveal
        open={revealOpen && !!space.assignments}
        participants={space.participants}
        assignments={space.assignments ?? []}
        prayerOrder={space.prayerOrder ?? null}
        myId={myId}
        onClose={() => setRevealOpen(false)}
      />

      <PrayerRoulette
        open={rouletteOpen}
        code={space.code}
        participants={space.participants}
        history={space.roulette?.history ?? []}
        weights={space.roulette?.weights ?? {}}
        pendingPick={pendingPick}
        myId={myId}
        adminToken={adminToken}
        onPickShown={() => setPendingPick(null)}
        onClose={() => setRouletteOpen(false)}
        onChange={() => {
          void mutate()
        }}
      />

      <VerseView
        open={verseOpen}
        code={space.code}
        spaceVerse={space.verse ?? null}
        myId={myId}
        adminToken={adminToken}
        versePresenterId={space.versePresenterId ?? null}
        onClose={() => setVerseOpen(false)}
        onChange={() => {
          void mutate()
        }}
      />
    </main>
  )
}
