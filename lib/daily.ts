import "server-only"

const DAILY_BASE = "https://api.daily.co/v1"

function getApiKey(): string {
  const key = process.env.DAILY_API_KEY
  if (!key) throw new Error("DAILY_API_KEY is not configured")
  return key
}

function getDomain(): string {
  const d = process.env.DAILY_DOMAIN
  if (!d) throw new Error("DAILY_DOMAIN is not configured")
  return d
}

export function roomNameFor(code: string): string {
  // Daily room names must be lowercase + alphanumeric/hyphens.
  return `pw-${code.toLowerCase()}`
}

export function roomUrlFor(code: string): string {
  return `https://${getDomain()}/${roomNameFor(code)}`
}

async function dailyFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${DAILY_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getApiKey()}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  })
}

export async function ensureRoom(code: string): Promise<{
  url: string
  name: string
}> {
  const name = roomNameFor(code)
  // GET first to check existence.
  const getRes = await dailyFetch(`/rooms/${name}`)
  if (getRes.ok) {
    const data = (await getRes.json()) as { url: string; name: string }
    return { url: data.url, name }
  }

  // Create the room. 4-hour expiry — the caller can always re-create.
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 4
  const createRes = await dailyFetch("/rooms", {
    method: "POST",
    body: JSON.stringify({
      name,
      privacy: "private",
      properties: {
        exp,
        enable_knocking: false,
        enable_prejoin_ui: false,
        enable_screenshare: true,
        enable_chat: false,
        start_video_off: false,
        start_audio_off: false,
        max_participants: 12,
      },
    }),
  })
  if (!createRes.ok) {
    const text = await createRes.text()
    throw new Error(`Daily: couldn't create room (${createRes.status}): ${text}`)
  }
  const data = (await createRes.json()) as { url: string; name: string }
  return { url: data.url, name: data.name }
}

export async function deleteRoom(code: string): Promise<void> {
  const name = roomNameFor(code)
  const res = await dailyFetch(`/rooms/${name}`, { method: "DELETE" })
  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    throw new Error(`Daily: couldn't delete room (${res.status}): ${text}`)
  }
}

export async function mintMeetingToken(args: {
  code: string
  participantName: string
  participantId: string
  isOwner: boolean
}): Promise<string> {
  const name = roomNameFor(args.code)
  // 90-minute TTL — enough for a prayer meeting; they can re-mint if needed.
  const exp = Math.floor(Date.now() / 1000) + 60 * 90
  const res = await dailyFetch("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        room_name: name,
        user_id: args.participantId,
        user_name: args.participantName,
        is_owner: args.isOwner,
        enable_screenshare: true,
        exp,
      },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Daily: couldn't mint token (${res.status}): ${text}`)
  }
  const data = (await res.json()) as { token: string }
  return data.token
}
