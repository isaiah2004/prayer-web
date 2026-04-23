"use client"

import * as React from "react"
import gsap from "gsap"
import { Dices, RotateCcw, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Participant, RoulettePick } from "@/lib/types"
import { spinRouletteAction, resetRouletteAction } from "@/app/actions"

type Props = {
  open: boolean
  code: string
  participants: Participant[]
  history: RoulettePick[]
  weights: Record<string, number>
  /**
   * When set, the modal runs the spin animation landing on this pick.
   * The parent sets this whenever a new pick arrives (local click or
   * broadcast from another client) and clears it via onPickShown after
   * the reveal completes.
   */
  pendingPick?: RoulettePick | null
  onPickShown?: (pickedAt: number) => void
  onClose: () => void
  onChange?: () => void
}

export function PrayerRoulette({
  open,
  code,
  participants,
  history,
  weights,
  pendingPick,
  onPickShown,
  onClose,
  onChange,
}: Props) {
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  const reelRef = React.useRef<HTMLDivElement | null>(null)
  const resultRef = React.useRef<HTMLDivElement | null>(null)
  const [pick, setPick] = React.useState<RoulettePick | null>(null)
  const [spinning, setSpinning] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Freeze weights displayed while the reel is spinning so odds don't leak.
  const preSpinWeightsRef = React.useRef(weights)
  React.useEffect(() => {
    if (!spinning) preSpinWeightsRef.current = weights
  }, [spinning, weights])
  const displayedWeights = spinning ? preSpinWeightsRef.current : weights

  // Track which picks we've already animated so we only show each once.
  const shownPickAtRef = React.useRef<number | null>(null)

  const runAnimation = React.useCallback(
    (picked: RoulettePick) => {
      const reel = reelRef.current
      setError(null)
      setSpinning(true)
      setPick(null)
      if (reel) {
        gsap.killTweensOf(reel)
        gsap.set(reel, { y: 0 })
      }

      const itemHeight = 64
      const stripCount = 40
      const idx = Math.max(
        0,
        participants.findIndex((p) => p.id === picked.participantId),
      )
      const landingIndex = idx + participants.length * (stripCount - 5)

      const finish = () => {
        setPick(picked)
        setSpinning(false)
        shownPickAtRef.current = picked.pickedAt
        onPickShown?.(picked.pickedAt)
        onChange?.()
      }

      if (!reel || participants.length === 0) {
        finish()
        return
      }

      gsap.to(reel, {
        y: -landingIndex * itemHeight,
        duration: 3.4,
        ease: "power4.out",
        onComplete: () => {
          finish()
          requestAnimationFrame(() => {
            const el = resultRef.current
            if (el) {
              gsap.fromTo(
                el,
                { y: 20, opacity: 0, scale: 0.96 },
                {
                  y: 0,
                  opacity: 1,
                  scale: 1,
                  duration: 0.5,
                  ease: "back.out(1.8)",
                },
              )
            }
          })
        },
      })
    },
    [participants, onChange, onPickShown],
  )

  // When the parent signals a new pending pick, run the animation once.
  React.useEffect(() => {
    if (!open || !pendingPick || spinning) return
    const seen = shownPickAtRef.current
    if (seen != null && pendingPick.pickedAt <= seen) return
    runAnimation(pendingPick)
  }, [open, pendingPick, spinning, runAnimation])

  React.useEffect(() => {
    if (!open) return
    const overlay = overlayRef.current
    if (!overlay) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        overlay,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.25, ease: "power2.out" },
      )
    }, overlay)
    return () => ctx.revert()
  }, [open])

  React.useEffect(() => {
    if (!open) {
      setPick(null)
      setError(null)
      setSpinning(false)
    }
  }, [open])

  async function spin() {
    if (spinning || participants.length === 0) return
    setError(null)
    const result = await spinRouletteAction(code)
    if (!result.ok || !result.pick) {
      setError(result.error ?? "Couldn't spin")
      return
    }
    // Notify parent so SWR refetches; that will drive the animation via the
    // "new pick arrived" effect above (same path used by remote clients).
    onChange?.()
  }

  async function resetWeights() {
    await resetRouletteAction(code)
    onChange?.()
  }

  const strip = React.useMemo(() => {
    const out: Participant[] = []
    if (participants.length === 0) return out
    for (let i = 0; i < 40; i++) {
      for (const p of participants) out.push(p)
    }
    return out
  }, [participants])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Prayer roulette"
    >
      <div className="bg-card relative flex max-h-[92vh] w-[min(100%-2rem,36rem)] flex-col overflow-hidden rounded-2xl border shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <Dices className="text-primary size-4" />
            <span className="text-sm font-medium">Prayer Roulette</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close"
          >
            <X />
          </Button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <p className="text-muted-foreground text-sm">
            Spin to randomly pick someone to lead (opening or closing prayer,
            say a word, etc.). If a person is picked, their odds of being
            picked again are halved.
          </p>

          <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-indigo-500/10 via-violet-500/10 to-pink-500/10">
            <div className="from-card pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b to-transparent" />
            <div className="from-card pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t to-transparent" />
            <div className="border-primary pointer-events-none absolute inset-x-0 top-1/2 z-10 h-16 -translate-y-1/2 border-y-2" />
            <div className="relative h-48 overflow-hidden">
              <div
                ref={reelRef}
                className="absolute inset-x-0 top-[calc(50%-32px)] flex flex-col will-change-transform"
              >
                {strip.map((p, i) => (
                  <div
                    key={`${p.id}-${i}`}
                    className="flex h-16 shrink-0 items-center justify-center px-4 text-xl font-semibold"
                  >
                    <span className="truncate">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {pick ? (
            <div
              ref={resultRef}
              className="from-primary/15 to-primary/5 rounded-xl border bg-gradient-to-br p-4 text-center"
            >
              <div className="text-muted-foreground text-xs tracking-wide uppercase">
                It&apos;s on
              </div>
              <div className="mt-1 text-3xl font-semibold tracking-tight">
                {pick.participantName}
              </div>
              <div className="text-muted-foreground mt-1 text-sm">
                to pray 🙏
              </div>
            </div>
          ) : null}

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              size="lg"
              onClick={spin}
              disabled={spinning || participants.length === 0}
              className="bg-gradient-to-br from-indigo-600 via-violet-600 to-pink-600 text-white hover:from-indigo-500 hover:via-violet-500 hover:to-pink-500"
            >
              <Dices data-icon="inline-start" />
              {spinning ? "Spinning…" : pick ? "Spin again" : "Spin"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetWeights}
              disabled={spinning || history.length === 0}
              title="Reset everyone's odds back to equal"
            >
              <RotateCcw data-icon="inline-start" />
              Reset odds
            </Button>
          </div>

          {participants.length > 0 ? (
            <div className="border-t pt-4">
              <div className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Current odds
              </div>
              <OddsList
                participants={participants}
                weights={displayedWeights}
              />
            </div>
          ) : null}

          {history.length > 0 ? (
            <div className="border-t pt-4">
              <div className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Recent picks
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {history.slice(0, 10).map((h, i) => (
                  <li
                    key={`${h.pickedAt}-${i}`}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs",
                      i === 0
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {h.participantName}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function OddsList({
  participants,
  weights,
}: {
  participants: Participant[]
  weights: Record<string, number>
}) {
  const total = participants.reduce((s, p) => s + (weights[p.id] ?? 1), 0) || 1
  return (
    <ul className="flex flex-col gap-1.5">
      {participants.map((p) => {
        const w = weights[p.id] ?? 1
        const pct = (w / total) * 100
        return (
          <li key={p.id} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <div className="bg-muted relative h-1.5 w-24 overflow-hidden rounded-full">
              <div
                className="bg-primary absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <span className="text-muted-foreground w-12 text-right font-mono text-xs tabular-nums">
              {pct.toFixed(0)}%
            </span>
          </li>
        )
      })}
    </ul>
  )
}
