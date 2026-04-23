"use client"

import * as React from "react"
import gsap from "gsap"
import { Sparkles, X, HeartHandshake } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Assignment, Participant } from "@/lib/types"

type Props = {
  open: boolean
  participants: Participant[]
  assignments: Assignment[]
  myId: string | null
  onClose: () => void
}

type Phase = "idle" | "shuffling" | "revealing" | "done"

export function RandomizeReveal({
  open,
  participants,
  assignments,
  myId,
  onClose,
}: Props) {
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  const shuffleRef = React.useRef<HTMLDivElement | null>(null)
  const resultRef = React.useRef<HTMLDivElement | null>(null)
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [revealIndex, setRevealIndex] = React.useState(0)

  const myAssignments = React.useMemo(
    () => (myId ? assignments.filter((a) => a.prayerId === myId) : []),
    [assignments, myId],
  )

  const orderedAssignments = React.useMemo(() => {
    if (myAssignments.length === 0) return assignments
    const mySet = new Set(myAssignments)
    return [...myAssignments, ...assignments.filter((a) => !mySet.has(a))]
  }, [assignments, myAssignments])

  React.useEffect(() => {
    if (!open) {
      setPhase("idle")
      setRevealIndex(0)
      return
    }

    const overlay = overlayRef.current
    const shuffle = shuffleRef.current
    if (!overlay || !shuffle) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        overlay,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.3, ease: "power2.out" },
      )

      const cards = shuffle.querySelectorAll("[data-shuffle-card]")
      gsap.set(cards, {
        y: 30,
        opacity: 0,
        rotation: () => gsap.utils.random(-12, 12),
      })
      const tl = gsap.timeline({
        onComplete: () => {
          setPhase("revealing")
        },
      })
      tl.to(cards, {
        y: 0,
        opacity: 1,
        duration: 0.4,
        stagger: 0.04,
        ease: "back.out(1.6)",
      })
      tl.to(cards, {
        keyframes: [
          { x: () => gsap.utils.random(-20, 20), y: () => gsap.utils.random(-10, 10), rotation: () => gsap.utils.random(-10, 10), duration: 0.18, ease: "sine.inOut" },
          { x: () => gsap.utils.random(-20, 20), y: () => gsap.utils.random(-10, 10), rotation: () => gsap.utils.random(-10, 10), duration: 0.18, ease: "sine.inOut" },
          { x: () => gsap.utils.random(-20, 20), y: () => gsap.utils.random(-10, 10), rotation: () => gsap.utils.random(-10, 10), duration: 0.18, ease: "sine.inOut" },
          { x: 0, y: 0, rotation: 0, duration: 0.25, ease: "power2.out" },
        ],
        stagger: { each: 0.03, from: "random" },
      })
      tl.to(cards, {
        scale: 0.8,
        opacity: 0,
        duration: 0.25,
        stagger: 0.02,
        ease: "power2.in",
      })
    }, overlay)

    setPhase("shuffling")
    return () => ctx.revert()
  }, [open])

  React.useEffect(() => {
    if (phase !== "revealing") return
    const result = resultRef.current
    if (!result) return

    const cards = result.querySelectorAll("[data-reveal-card]")
    if (cards.length === 0) return

    const ctx = gsap.context(() => {
      gsap.set(cards, { y: 20, opacity: 0, scale: 0.95 })
      const tl = gsap.timeline({
        onUpdate: () => {
          setRevealIndex((prev) => Math.max(prev, Math.round(tl.progress() * cards.length)))
        },
        onComplete: () => {
          setPhase("done")
          setRevealIndex(cards.length)
        },
      })
      cards.forEach((card, i) => {
        tl.to(
          card,
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.5,
            ease: "back.out(1.6)",
          },
          i === 0 ? 0 : "+=0.25",
        )
      })
    }, result)

    return () => ctx.revert()
  }, [phase])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Prayer assignments"
    >
      <div className="bg-card relative flex h-[92vh] w-[min(100%-2rem,48rem)] flex-col overflow-hidden rounded-2xl border shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary size-4" />
            <span className="text-sm font-medium">
              {phase === "shuffling"
                ? "Generating prayer pairs…"
                : phase === "revealing"
                  ? "Revealing pairs…"
                  : "Your prayer pairs"}
            </span>
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

        <div className="relative flex-1 overflow-y-auto">
          <div
            ref={shuffleRef}
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity",
              phase !== "shuffling" && "pointer-events-none opacity-0",
            )}
          >
            <div className="relative h-64 w-full max-w-md">
              {participants.slice(0, 12).map((p, i) => (
                <div
                  key={p.id}
                  data-shuffle-card
                  className="bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500 text-primary-foreground absolute top-1/2 left-1/2 flex h-28 w-52 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl px-4 text-base font-semibold shadow-2xl ring-1 ring-white/20"
                  style={{
                    transform: `translate(-50%, -50%) rotate(${((i % 5) - 2) * 6}deg)`,
                    zIndex: i,
                  }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-medium tracking-widest uppercase opacity-70">
                      Pray for
                    </span>
                    <span className="truncate text-lg">{p.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div
            ref={resultRef}
            className={cn(
              "flex flex-col gap-3 p-5 transition-opacity",
              phase !== "revealing" && phase !== "done" &&
                "pointer-events-none opacity-0",
            )}
          >
            {orderedAssignments.map((assignment) => {
              const isMine = assignment.prayerId === myId
              return (
                <AssignmentCard
                  key={`${assignment.prayerId}->${assignment.requestId}`}
                  assignment={assignment}
                  isMine={isMine}
                />
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
          <span className="text-muted-foreground text-xs">
            {phase === "done"
              ? `${assignments.length} ${assignments.length === 1 ? "pair" : "pairs"} • take a moment to pray 🙏`
              : phase === "revealing"
                ? `${revealIndex} of ${assignments.length}`
                : "Generating pairs…"}
          </span>
          <Button onClick={onClose} variant="default">
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}

function AssignmentCard({
  assignment,
  isMine,
}: {
  assignment: Assignment
  isMine: boolean
}) {
  return (
    <div
      data-reveal-card
      className={cn(
        "rounded-xl border p-4 shadow-sm",
        isMine
          ? "border-primary/50 bg-primary/5 ring-primary/30 ring-2"
          : "bg-card",
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <HeartHandshake
          className={cn(
            "size-4",
            isMine ? "text-primary" : "text-muted-foreground",
          )}
        />
        <span className="font-medium">{assignment.prayerName}</span>
        <span className="text-muted-foreground">will pray for</span>
        <span className="font-medium">{assignment.requestName}</span>
        {isMine ? (
          <span className="bg-primary/10 text-primary ml-auto rounded-full px-2 py-0.5 text-xs font-medium">
            that&apos;s you
          </span>
        ) : null}
      </div>
      <div
        className="tiptap-editor mt-3 rounded-md border bg-background/60 p-3 text-sm"
        dangerouslySetInnerHTML={{ __html: assignment.request }}
      />
    </div>
  )
}
