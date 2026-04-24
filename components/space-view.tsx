"use client"

import * as React from "react"
import useSWR from "swr"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  BookOpen,
  Dices,
  PhoneCall,
  RefreshCcw,
  Shuffle,
  Sparkles,
  Video,
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
import { VideoCall } from "@/components/video-call"
import { ThemeToggle } from "@/components/theme-toggle"
import { AdminRequestsBanner } from "@/components/admin-requests-banner"
import type { RoulettePick, SpacePublic } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  randomizeAction,
  resetAction,
  requestSpinAction,
  approveSpinRequestAction,
  denySpinRequestAction,
  grantVersePresenterAction,
  reclaimVersePresenterAction,
  denyPresenterRequestAction,
  setJoinModeAction,
  approveJoinRequestAction,
  denyJoinRequestAction,
  startCallAction,
  endCallAction,
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
  const [myJoinId, setMyJoinId] = React.useState<string | null>(null)
  const [adminToken, setAdminToken] = React.useState<string | null>(null)
  const [revealOpen, setRevealOpen] = React.useState(false)
  const [rouletteOpen, setRouletteOpen] = React.useState(false)
  const [verseOpen, setVerseOpen] = React.useState(false)
  const [callOpen, setCallOpen] = React.useState(false)
  const [callUserMinimized, setCallUserMinimized] = React.useState(false)
  // Auto-shrink the call into the floating mini while another view is
  // open, so the user can still see verses / pairs / roulette while
  // staying in the call (audio keeps flowing from the hidden tiles).
  const callMinimized =
    callOpen &&
    (callUserMinimized || revealOpen || rouletteOpen || verseOpen)
  const [randomizing, setRandomizing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const isAdmin = !!adminToken

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(
        `prayer-web:my-join:${space.code}`,
      )
      setMyJoinId(stored)
    } catch {
      /* ignore */
    }
  }, [space.code])

  // If my queued join was approved, my myId ref will cover it; clear the
  // my-join flag once we're actually in.
  React.useEffect(() => {
    if (myId && myJoinId) {
      try {
        localStorage.removeItem(`prayer-web:my-join:${space.code}`)
      } catch {
        /* ignore */
      }
      setMyJoinId(null)
    }
  }, [myId, myJoinId, space.code])

  // If my queued request was denied (no longer in the server list), clear.
  React.useEffect(() => {
    if (!myJoinId) return
    const stillQueued = space.joinRequests?.some((r) => r.id === myJoinId)
    if (!stillQueued) {
      try {
        localStorage.removeItem(`prayer-web:my-join:${space.code}`)
      } catch {
        /* ignore */
      }
      setMyJoinId(null)
    }
  }, [space.joinRequests, myJoinId, space.code])

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

  // Notify everyone when the admin ends the call (URL flips to null).
  const prevCallRoomUrlRef = React.useRef<string | null>(
    initial.callRoomUrl ?? null,
  )
  React.useEffect(() => {
    const prev = prevCallRoomUrlRef.current
    const current = space.callRoomUrl ?? null
    if (prev && !current) {
      toast("The prayer call has ended", {
        description: "The admin closed the room for everyone.",
      })
    } else if (!prev && current) {
      toast("Prayer call started", {
        description: "Tap Join call to hop in.",
      })
    }
    prevCallRoomUrlRef.current = current
  }, [space.callRoomUrl])

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

  async function onToggleJoinMode() {
    if (!isAdmin) return
    const next = space.joinMode === "request" ? "open" : "request"
    await setJoinModeAction(space.code, adminToken, next)
    await mutate()
  }

  async function onApproveJoin(requestId: string) {
    if (!isAdmin) return
    const result = await approveJoinRequestAction(
      space.code,
      adminToken,
      requestId,
    )
    if (result.ok) await mutate()
  }

  async function onDenyJoin(requestId: string) {
    if (!isAdmin) return
    await denyJoinRequestAction(space.code, adminToken, requestId)
    await mutate()
  }

  async function onStartCall() {
    if (!isAdmin || !myId) return
    const result = await startCallAction(space.code, adminToken)
    if (!result.ok) {
      setError(result.error ?? "Couldn't start the call")
      return
    }
    await mutate()
    setCallOpen(true)
  }

  async function onEndCall() {
    if (!isAdmin) return
    await endCallAction(space.code, adminToken)
    await mutate()
    setCallOpen(false)
  }

  function onJoinCall() {
    if (!myId) return
    setCallOpen(true)
  }

  const presentCount = space.participants.filter((p) => p.present).length
  const canRandomize = space.participants.length >= 2 && presentCount >= 1
  const canRoulette = presentCount >= 1

  return (
    <main className="min-h-svh">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft data-icon="inline-start" />
              Home
            </Link>
          </Button>
          <div className="flex flex-1 items-center justify-end gap-2 sm:max-w-sm">
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

        {isAdmin && space.joinRequests.length > 0 ? (
          <div className="flex flex-col gap-2">
            {[...space.joinRequests]
              .sort((a, b) => a.requestedAt - b.requestedAt)
              .map((req) => (
                <div
                  key={req.id}
                  className="border-amber-500/40 bg-amber-500/10 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {req.name} wants to join
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Approve to add them to the circle with their request.
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" onClick={() => onApproveJoin(req.id)}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDenyJoin(req.id)}
                    >
                      Deny
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="flex flex-col gap-4 lg:col-span-3">
            <Card className="lg:flex lg:h-[60vh] lg:flex-col lg:overflow-hidden">
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
                        className="backdrop-blur-sm backdrop-saturate-150"
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
                          className="backdrop-blur-sm"
                        >
                          <RefreshCcw data-icon="inline-start" />
                          Reset
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="min-h-0 lg:flex-1 lg:overflow-y-auto">
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

            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-5 sm:py-6">
                <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <Button
                    size="lg"
                    onClick={onRandomize}
                    disabled={!canRandomize || randomizing || !myId}
                    className="h-12 w-full bg-gradient-to-br from-indigo-600 via-violet-600 to-pink-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 hover:from-indigo-500 hover:via-violet-500 hover:to-pink-500 disabled:opacity-60"
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
                    className="h-12 w-full border-amber-500/40 bg-amber-500/15 px-4 text-sm font-medium text-amber-900 shadow-sm shadow-amber-500/10 backdrop-blur-sm backdrop-saturate-150 hover:bg-amber-500/25 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
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
                    className="h-12 w-full border-sky-500/40 bg-sky-500/15 px-4 text-sm font-medium text-sky-900 shadow-sm shadow-sky-500/10 backdrop-blur-sm backdrop-saturate-150 hover:bg-sky-500/25 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200 dark:hover:bg-sky-500/20"
                    title="Open the shared verse view"
                  >
                    <BookOpen data-icon="inline-start" />
                    Verse View
                  </Button>
                  {space.callRoomUrl ? (
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={onJoinCall}
                      disabled={!myId}
                      className="h-12 w-full border-emerald-500/40 bg-emerald-500/15 px-4 text-sm font-medium text-emerald-900 shadow-sm shadow-emerald-500/10 backdrop-blur-sm backdrop-saturate-150 hover:bg-emerald-500/25 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                      title="Join the live video call"
                    >
                      <Video data-icon="inline-start" />
                      Join call
                      <span className="ml-1 inline-block size-2 animate-pulse rounded-full bg-emerald-500" />
                    </Button>
                  ) : isAdmin ? (
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={onStartCall}
                      disabled={!myId}
                      className="h-12 w-full border-emerald-500/40 bg-emerald-500/15 px-4 text-sm font-medium text-emerald-900 shadow-sm shadow-emerald-500/10 backdrop-blur-sm backdrop-saturate-150 hover:bg-emerald-500/25 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                      title="Start a video call for the group"
                    >
                      <PhoneCall data-icon="inline-start" />
                      Start call
                    </Button>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-center text-xs">
                  {canRandomize
                    ? "Generate prayer pairs to cover everyone, spin the roulette to pick a leader, or open Verse View to share scripture."
                    : "Add people to enable pair generation. Roulette needs 1+. Verse View works anytime."}
                </p>
                {error ? (
                  <p className="text-destructive text-sm">{error}</p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4 lg:col-span-2">
            {myId ? (
              <Card>
                <StatusPills
                  isAdmin={isAdmin}
                  joinMode={space.joinMode}
                  onToggleJoinMode={onToggleJoinMode}
                />
                <CardHeader>
                  <CardTitle>You&apos;re in the circle</CardTitle>
                  <CardDescription>
                    Use &quot;Remove yourself&quot; on your row if you want to
                    change your name or request.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : myJoinId ? (
              <Card>
                <StatusPills
                  isAdmin={isAdmin}
                  joinMode={space.joinMode}
                  onToggleJoinMode={onToggleJoinMode}
                />
                <CardHeader>
                  <CardTitle>Waiting for the admin…</CardTitle>
                  <CardDescription>
                    Your join request was sent. The admin will approve you
                    shortly. This page updates automatically.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <Card>
                <StatusPills
                  isAdmin={isAdmin}
                  joinMode={space.joinMode}
                  onToggleJoinMode={onToggleJoinMode}
                />
                <CardHeader>
                  <CardTitle>Add yourself</CardTitle>
                  <CardDescription>
                    {space.joinMode === "request"
                      ? "The admin is gating new joins. Enter your info and they'll approve you."
                      : "Enter your name and the prayer request you'd like others to cover."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AddParticipant
                    code={space.code}
                    mode="self"
                    adminToken={adminToken}
                    onAdded={(id) => {
                      saveMyId(id)
                      void mutate()
                    }}
                    onQueued={(id) => {
                      setMyJoinId(id)
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

      <VideoCall
        open={callOpen}
        code={space.code}
        roomUrl={space.callRoomUrl ?? null}
        myId={myId}
        adminToken={adminToken}
        minimized={callMinimized}
        hasAssignments={!!space.assignments}
        onClose={() => {
          setCallOpen(false)
          setCallUserMinimized(false)
        }}
        onMinimize={() => setCallUserMinimized(true)}
        onMaximize={() => {
          setCallUserMinimized(false)
          setRevealOpen(false)
          setRouletteOpen(false)
          setVerseOpen(false)
        }}
        onOpenView={(view) => {
          if (view === "verse") setVerseOpen(true)
          else if (view === "roulette") setRouletteOpen(true)
          else if (view === "pairs") setRevealOpen(true)
        }}
      />
    </main>
  )
}

function StatusPills({
  isAdmin,
  joinMode,
  onToggleJoinMode,
}: {
  isAdmin: boolean
  joinMode: SpacePublic["joinMode"]
  onToggleJoinMode: () => void
}) {
  if (!isAdmin) return null
  return (
    <div className="flex flex-wrap items-center gap-2 px-6">
      <span className="bg-primary/15 text-primary inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
        Admin
      </span>
      <button
        type="button"
        onClick={onToggleJoinMode}
        className={cn(
          "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors backdrop-blur-sm",
          joinMode === "request"
            ? "border-amber-500/40 bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:text-amber-200"
            : "border-border bg-muted/60 text-muted-foreground hover:bg-muted",
        )}
        title={
          joinMode === "request"
            ? "Request mode: you approve new joiners. Click to switch to open."
            : "Open mode: anyone with the code can join. Click to switch to request mode."
        }
      >
        {joinMode === "request" ? "Request mode" : "Open mode"}
      </button>
    </div>
  )
}
