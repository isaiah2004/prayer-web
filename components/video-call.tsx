"use client"

import * as React from "react"
import DailyIframe, {
  type DailyCall,
  type DailyEventObjectParticipant,
  type DailyEventObjectParticipantLeft,
  type DailyParticipant,
} from "@daily-co/daily-js"
import { Mic, MicOff, PhoneOff, Video, VideoOff, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { mintCallTokenAction, endCallAction } from "@/app/actions"

type Props = {
  open: boolean
  code: string
  roomUrl: string | null
  myId: string | null
  adminToken: string | null
  onClose: () => void
}

type PMap = Record<string, DailyParticipant>

export function VideoCall({
  open,
  code,
  roomUrl,
  myId,
  adminToken,
  onClose,
}: Props) {
  const callRef = React.useRef<DailyCall | null>(null)
  const [participants, setParticipants] = React.useState<PMap>({})
  const [status, setStatus] = React.useState<
    "idle" | "joining" | "joined" | "leaving" | "error"
  >("idle")
  const [error, setError] = React.useState<string | null>(null)
  const [micOn, setMicOn] = React.useState(true)
  const [camOn, setCamOn] = React.useState(true)

  const isAdmin = !!adminToken

  React.useEffect(() => {
    if (!open) return
    if (!roomUrl || !myId) {
      setError("You need to be in the space to join the call.")
      return
    }
    let cancelled = false

    async function join() {
      setStatus("joining")
      setError(null)
      try {
        if (!myId) return
        const token = await mintCallTokenAction(code, myId, adminToken)
        if (cancelled) return
        if (!token.ok || !token.token || !token.roomUrl) {
          throw new Error(token.error ?? "Couldn't get a meeting token")
        }

        const call = DailyIframe.createCallObject({
          dailyConfig: { useDevicePreferenceCookies: true },
        })
        callRef.current = call

        function syncParticipants() {
          const all = call.participants()
          setParticipants({ ...all })
        }

        call.on("joined-meeting", () => {
          setStatus("joined")
          syncParticipants()
        })
        call.on(
          "participant-joined",
          (_ev: DailyEventObjectParticipant | undefined) => {
            syncParticipants()
          },
        )
        call.on(
          "participant-updated",
          (_ev: DailyEventObjectParticipant | undefined) => {
            syncParticipants()
          },
        )
        call.on(
          "participant-left",
          (_ev: DailyEventObjectParticipantLeft | undefined) => {
            syncParticipants()
          },
        )
        call.on("left-meeting", () => {
          setStatus("idle")
        })
        call.on("error", (ev) => {
          setError(ev?.errorMsg ?? "Call error")
          setStatus("error")
        })

        await call.join({
          url: token.roomUrl,
          token: token.token,
          startVideoOff: false,
          startAudioOff: false,
        })
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Couldn't join call")
        setStatus("error")
      }
    }

    void join()

    return () => {
      cancelled = true
      const call = callRef.current
      if (call) {
        call.destroy().catch(() => {})
        callRef.current = null
      }
      setStatus("idle")
      setParticipants({})
    }
  }, [open, roomUrl, myId, adminToken, code])

  async function leave() {
    const call = callRef.current
    if (!call) {
      onClose()
      return
    }
    setStatus("leaving")
    try {
      await call.leave()
    } catch {
      /* ignore */
    }
    try {
      await call.destroy()
    } catch {
      /* ignore */
    }
    callRef.current = null
    onClose()
  }

  async function toggleMic() {
    const call = callRef.current
    if (!call) return
    const next = !micOn
    call.setLocalAudio(next)
    setMicOn(next)
  }

  async function toggleCam() {
    const call = callRef.current
    if (!call) return
    const next = !camOn
    call.setLocalVideo(next)
    setCamOn(next)
  }

  async function adminEndForAll() {
    if (!isAdmin) return
    await leave()
    await endCallAction(code, adminToken)
  }

  const entries = Object.values(participants)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Video call"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-white">
        <div className="text-sm font-medium">
          {status === "joining"
            ? "Joining…"
            : status === "joined"
              ? `Prayer call — ${entries.length} in room`
              : status === "leaving"
                ? "Leaving…"
                : "Video call"}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={leave}
          aria-label="Close"
          className="text-white hover:bg-white/10"
        >
          <X />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-4">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-white">
            <p className="text-destructive text-sm">{error}</p>
            <Button onClick={leave} variant="secondary">
              Close
            </Button>
          </div>
        ) : (
          <VideoGrid participants={entries} />
        )}
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-white/10 px-5 py-3">
        <Button
          variant="outline"
          size="icon-lg"
          onClick={toggleMic}
          aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
          title={micOn ? "Mute" : "Unmute"}
          className={cn(
            "rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20",
            !micOn && "bg-destructive/20 border-destructive text-destructive-foreground",
          )}
        >
          {micOn ? <Mic /> : <MicOff />}
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          onClick={toggleCam}
          aria-label={camOn ? "Turn camera off" : "Turn camera on"}
          title={camOn ? "Camera off" : "Camera on"}
          className={cn(
            "rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20",
            !camOn && "bg-destructive/20 border-destructive text-destructive-foreground",
          )}
        >
          {camOn ? <Video /> : <VideoOff />}
        </Button>
        <Button
          variant="destructive"
          size="icon-lg"
          onClick={leave}
          aria-label="Leave call"
          title="Leave"
          className="rounded-full"
        >
          <PhoneOff />
        </Button>
        {isAdmin ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={adminEndForAll}
            className="text-white/80 hover:bg-white/10 hover:text-white"
            title="End the call for everyone"
          >
            End for all
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function VideoGrid({ participants }: { participants: DailyParticipant[] }) {
  const count = participants.length
  const cols =
    count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4
  return (
    <div
      className="grid h-full w-full gap-2"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridAutoRows: "1fr",
      }}
    >
      {participants.map((p) => (
        <ParticipantTile key={p.session_id} participant={p} />
      ))}
    </div>
  )
}

function ParticipantTile({
  participant,
}: {
  participant: DailyParticipant
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const track = participant.videoTrack
    if (track) {
      const stream = new MediaStream([track])
      video.srcObject = stream
      void video.play().catch(() => {})
    } else {
      video.srcObject = null
    }
  }, [participant.videoTrack])

  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (participant.local) return // don't play your own audio
    const track = participant.audioTrack
    if (track) {
      const stream = new MediaStream([track])
      audio.srcObject = stream
      void audio.play().catch(() => {})
    } else {
      audio.srcObject = null
    }
  }, [participant.audioTrack, participant.local])

  const videoOff = !participant.video
  const micOff = !participant.audio

  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-xl bg-neutral-900 text-white shadow-lg">
      <video
        ref={videoRef}
        autoPlay
        muted={participant.local}
        playsInline
        className={cn(
          "h-full w-full object-cover",
          participant.local && "scale-x-[-1]",
          videoOff && "invisible",
        )}
      />
      {videoOff ? (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
          <div className="flex size-16 items-center justify-center rounded-full bg-white/10 text-xl font-semibold">
            {(participant.user_name ?? "?").slice(0, 1).toUpperCase()}
          </div>
        </div>
      ) : null}
      <audio ref={audioRef} autoPlay playsInline />
      <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium backdrop-blur-sm">
        {micOff ? (
          <MicOff className="size-3 text-red-400" />
        ) : (
          <Mic className="size-3" />
        )}
        <span className="truncate">
          {participant.user_name ?? "Anonymous"}
          {participant.local ? " (you)" : ""}
        </span>
      </div>
    </div>
  )
}
