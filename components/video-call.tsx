"use client"

import * as React from "react"
import DailyIframe, {
  type DailyCall,
  type DailyEventObjectParticipant,
  type DailyEventObjectParticipantLeft,
  type DailyParticipant,
} from "@daily-co/daily-js"
import {
  Mic,
  MicOff,
  PhoneOff,
  Settings,
  Video,
  VideoOff,
  Volume2,
  X,
} from "lucide-react"

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

  const [devices, setDevices] = React.useState<{
    cameras: MediaDeviceInfo[]
    mics: MediaDeviceInfo[]
    speakers: MediaDeviceInfo[]
  }>({ cameras: [], mics: [], speakers: [] })
  const [selected, setSelected] = React.useState<{
    cameraId?: string
    micId?: string
    speakerId?: string
  }>({})
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const isAdmin = !!adminToken

  async function refreshDevices() {
    const call = callRef.current
    if (!call) return
    try {
      const list = await call.enumerateDevices()
      const all = (list.devices ?? []) as MediaDeviceInfo[]
      setDevices({
        cameras: all.filter((d) => d.kind === "videoinput" && d.deviceId),
        mics: all.filter((d) => d.kind === "audioinput" && d.deviceId),
        speakers: all.filter((d) => d.kind === "audiooutput" && d.deviceId),
      })
      const current = await call.getInputDevices()
      setSelected((prev) => ({
        ...prev,
        cameraId:
          (current.camera && "deviceId" in current.camera
            ? current.camera.deviceId
            : undefined) ?? prev.cameraId,
        micId:
          (current.mic && "deviceId" in current.mic
            ? current.mic.deviceId
            : undefined) ?? prev.micId,
      }))
    } catch {
      /* ignore */
    }
  }

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
          void refreshDevices()
        })
        call.on("available-devices-updated", () => {
          void refreshDevices()
        })
        call.on("selected-devices-updated", () => {
          void refreshDevices()
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
    callRef.current = null
    setStatus("leaving")
    // Best-effort cleanup with a hard timeout. If we never fully joined
    // (e.g. getUserMedia never resolved), call.leave()/destroy() can hang
    // forever — don't let that pin the UI.
    if (call) {
      void Promise.race([
        (async () => {
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
        })(),
        new Promise<void>((resolve) => setTimeout(resolve, 1500)),
      ])
    }
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

  async function selectCamera(deviceId: string) {
    const call = callRef.current
    if (!call) return
    try {
      await call.setInputDevicesAsync({ videoDeviceId: deviceId })
      setSelected((s) => ({ ...s, cameraId: deviceId }))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't switch camera")
    }
  }

  async function selectMic(deviceId: string) {
    const call = callRef.current
    if (!call) return
    try {
      await call.setInputDevicesAsync({ audioDeviceId: deviceId })
      setSelected((s) => ({ ...s, micId: deviceId }))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't switch microphone")
    }
  }

  async function selectSpeaker(deviceId: string) {
    const call = callRef.current
    if (!call) return
    try {
      await call.setOutputDeviceAsync({ outputDeviceId: deviceId })
      setSelected((s) => ({ ...s, speakerId: deviceId }))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't switch speaker")
    }
  }

  async function adminEndForAll() {
    if (!isAdmin) return
    // End the server-side room first so clients can't stay connected and
    // so the UI exits immediately even if the local Daily cleanup hangs.
    await endCallAction(code, adminToken)
    await leave()
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
          <VideoGrid
            participants={entries}
            speakerId={selected.speakerId ?? null}
          />
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
        <DeviceSettings
          open={settingsOpen}
          setOpen={setSettingsOpen}
          devices={devices}
          selected={selected}
          onSelectCamera={selectCamera}
          onSelectMic={selectMic}
          onSelectSpeaker={selectSpeaker}
        />
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

function VideoGrid({
  participants,
  speakerId,
}: {
  participants: DailyParticipant[]
  speakerId: string | null
}) {
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
        <ParticipantTile
          key={p.session_id}
          participant={p}
          speakerId={speakerId}
        />
      ))}
    </div>
  )
}

function DeviceSettings({
  open,
  setOpen,
  devices,
  selected,
  onSelectCamera,
  onSelectMic,
  onSelectSpeaker,
}: {
  open: boolean
  setOpen: (v: boolean) => void
  devices: {
    cameras: MediaDeviceInfo[]
    mics: MediaDeviceInfo[]
    speakers: MediaDeviceInfo[]
  }
  selected: {
    cameraId?: string
    micId?: string
    speakerId?: string
  }
  onSelectCamera: (id: string) => void | Promise<void>
  onSelectMic: (id: string) => void | Promise<void>
  onSelectSpeaker: (id: string) => void | Promise<void>
}) {
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
  }, [open, setOpen])

  const speakerSupported =
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        size="icon-lg"
        onClick={() => setOpen(!open)}
        aria-label="Device settings"
        title="Mic / camera / speaker"
        className={cn(
          "rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20",
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Settings />
      </Button>
      {open ? (
        <div
          role="dialog"
          aria-label="Device settings"
          className="bg-card absolute bottom-full right-0 z-20 mb-2 flex w-80 flex-col gap-3 rounded-xl border p-4 shadow-xl"
        >
          <DeviceSelect
            icon={<Video className="size-4" />}
            label="Camera"
            items={devices.cameras}
            value={selected.cameraId}
            onChange={onSelectCamera}
          />
          <DeviceSelect
            icon={<Mic className="size-4" />}
            label="Microphone"
            items={devices.mics}
            value={selected.micId}
            onChange={onSelectMic}
          />
          {devices.speakers.length > 0 ? (
            <DeviceSelect
              icon={<Volume2 className="size-4" />}
              label="Speaker"
              items={devices.speakers}
              value={selected.speakerId}
              onChange={onSelectSpeaker}
              disabled={!speakerSupported}
              disabledHint={
                !speakerSupported
                  ? "Your browser doesn't allow switching output devices."
                  : undefined
              }
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function DeviceSelect({
  icon,
  label,
  items,
  value,
  onChange,
  disabled,
  disabledHint,
}: {
  icon: React.ReactNode
  label: string
  items: MediaDeviceInfo[]
  value?: string
  onChange: (id: string) => void | Promise<void>
  disabled?: boolean
  disabledHint?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
        {icon}
        {label}
      </div>
      <select
        value={value ?? ""}
        onChange={(e) => {
          if (!disabled) void onChange(e.target.value)
        }}
        disabled={disabled}
        className={cn(
          "bg-background border-input h-9 appearance-none rounded-md border px-3 text-sm font-medium",
          "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px] focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {items.length === 0 ? (
          <option value="">No devices found</option>
        ) : (
          <>
            {!value ? <option value="">Default</option> : null}
            {items.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `${label} (${d.deviceId.slice(0, 6)})`}
              </option>
            ))}
          </>
        )}
      </select>
      {disabledHint ? (
        <p className="text-muted-foreground text-xs">{disabledHint}</p>
      ) : null}
    </div>
  )
}

function ParticipantTile({
  participant,
  speakerId,
}: {
  participant: DailyParticipant
  speakerId: string | null
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

  // Route remote audio to the selected speaker, where supported.
  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio || participant.local) return
    const anyAudio = audio as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>
    }
    if (speakerId && typeof anyAudio.setSinkId === "function") {
      anyAudio.setSinkId(speakerId).catch(() => {})
    }
  }, [speakerId, participant.local])

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
