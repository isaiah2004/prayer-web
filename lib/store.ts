import { customAlphabet } from "nanoid"
import { get, put, del } from "@vercel/blob"
import type {
  Participant,
  RoulettePick,
  Space,
  VerseSelection,
} from "./types"
import { sanitizeRequestHtml } from "./sanitize"

const SPACE_TTL_MS = 1000 * 60 * 60 * 24

const globalForStore = globalThis as unknown as {
  __prayerSpaces?: Map<string, Space>
}

const memSpaces: Map<string, Space> =
  globalForStore.__prayerSpaces ?? new Map<string, Space>()

if (!globalForStore.__prayerSpaces) {
  globalForStore.__prayerSpaces = memSpaces
}

const nanoCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6)
const nanoId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10)

const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN

function blobPath(code: string): string {
  return `spaces/${code}.json`
}

async function readSpaceFromBlob(code: string): Promise<Space | null> {
  try {
    const result = await get(blobPath(code), {
      access: "private",
      useCache: false,
    })
    if (!result || result.statusCode !== 200) return null
    const text = await new Response(result.stream).text()
    if (!text) return null
    const space = JSON.parse(text) as Space
    if (Date.now() - space.createdAt > SPACE_TTL_MS) {
      try {
        await del(blobPath(code))
      } catch {
        /* ignore */
      }
      return null
    }
    return space
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/not.found|404/i.test(message)) return null
    throw err
  }
}

async function writeSpaceToBlob(space: Space): Promise<void> {
  await put(blobPath(space.code), JSON.stringify(space), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  })
}

function gcMem() {
  const now = Date.now()
  for (const [key, space] of memSpaces) {
    if (now - space.createdAt > SPACE_TTL_MS) memSpaces.delete(key)
  }
}

async function loadSpace(code: string): Promise<Space | null> {
  const upper = code.toUpperCase()
  if (USE_BLOB) return readSpaceFromBlob(upper)
  gcMem()
  return memSpaces.get(upper) ?? null
}

async function persistSpace(space: Space): Promise<void> {
  if (USE_BLOB) {
    await writeSpaceToBlob(space)
  } else {
    memSpaces.set(space.code, space)
  }
}

export async function createSpace(): Promise<Space> {
  let code = nanoCode()
  // Avoid collisions.
  for (let i = 0; i < 5; i++) {
    const existing = await loadSpace(code)
    if (!existing) break
    code = nanoCode()
  }
  const space: Space = {
    code,
    createdAt: Date.now(),
    participants: [],
    assignments: null,
    randomizedAt: null,
    roulette: { weights: {}, history: [] },
    verse: null,
  }
  await persistSpace(space)
  return space
}

export async function getSpace(code: string): Promise<Space | null> {
  return loadSpace(code)
}

export async function addParticipant(
  code: string,
  name: string,
  request: string,
): Promise<
  { space: Space; participant: Participant } | { error: string }
> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  const cleanName = name.trim()
  if (!cleanName) return { error: "Name is required" }
  if (cleanName.length > 60) return { error: "Name is too long" }
  if (request.length > 20000) return { error: "Prayer request is too long" }
  const cleanRequest = sanitizeRequestHtml(request)
  const textOnly = cleanRequest.replace(/<[^>]*>/g, "").trim()
  if (!textOnly) return { error: "Prayer request is required" }

  const participant: Participant = {
    id: nanoId(),
    name: cleanName,
    request: cleanRequest,
    createdAt: Date.now(),
  }
  space.participants.push(participant)
  space.roulette.weights[participant.id] = 1
  space.assignments = null
  space.randomizedAt = null
  await persistSpace(space)
  return { space, participant }
}

export async function removeParticipant(
  code: string,
  participantId: string,
): Promise<{ space: Space } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  const next = space.participants.filter((p) => p.id !== participantId)
  if (next.length === space.participants.length)
    return { error: "Participant not found" }
  space.participants = next
  delete space.roulette.weights[participantId]
  space.roulette.history = space.roulette.history.filter(
    (p) => p.participantId !== participantId,
  )
  space.assignments = null
  space.randomizedAt = null
  await persistSpace(space)
  return { space }
}

function derangementOrRotation<T>(items: T[]): T[] {
  const n = items.length
  if (n < 2) return items.slice()
  for (let attempt = 0; attempt < 50; attempt++) {
    const shuffled = items.slice()
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const ok = shuffled.every((v, i) => v !== items[i])
    if (ok) return shuffled
  }
  return items.slice(1).concat(items[0])
}

export async function randomize(
  code: string,
): Promise<{ space: Space } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  if (space.participants.length < 2)
    return { error: "Need at least 2 participants to randomize" }

  const prayers = space.participants.slice()
  const targets = derangementOrRotation(space.participants.slice())

  space.assignments = prayers.map((prayer, i) => ({
    prayerId: prayer.id,
    prayerName: prayer.name,
    requestId: targets[i].id,
    requestName: targets[i].name,
    request: targets[i].request,
  }))
  space.randomizedAt = Date.now()
  await persistSpace(space)
  return { space }
}

export async function resetAssignments(
  code: string,
): Promise<{ space: Space } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  space.assignments = null
  space.randomizedAt = null
  await persistSpace(space)
  return { space }
}

const MIN_WEIGHT = 1 / 1024

export async function spinRoulette(
  code: string,
): Promise<{ space: Space; pick: RoulettePick } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  if (space.participants.length === 0)
    return { error: "Add at least one person first" }

  for (const p of space.participants) {
    if (space.roulette.weights[p.id] == null) {
      space.roulette.weights[p.id] = 1
    }
  }

  let total = 0
  for (const p of space.participants) {
    total += space.roulette.weights[p.id] ?? 0
  }
  if (total <= 0) {
    for (const p of space.participants) space.roulette.weights[p.id] = 1
    total = space.participants.length
  }

  let roll = Math.random() * total
  let picked = space.participants[space.participants.length - 1]
  for (const p of space.participants) {
    const w = space.roulette.weights[p.id] ?? 0
    if (roll < w) {
      picked = p
      break
    }
    roll -= w
  }

  const next = (space.roulette.weights[picked.id] ?? 1) / 2
  space.roulette.weights[picked.id] = next < MIN_WEIGHT ? MIN_WEIGHT : next

  const pick: RoulettePick = {
    participantId: picked.id,
    participantName: picked.name,
    request: picked.request,
    pickedAt: Date.now(),
  }
  space.roulette.history = [pick, ...space.roulette.history].slice(0, 30)
  await persistSpace(space)
  return { space, pick }
}

export async function resetRoulette(
  code: string,
): Promise<{ space: Space } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  space.roulette = {
    weights: Object.fromEntries(space.participants.map((p) => [p.id, 1])),
    history: [],
  }
  await persistSpace(space)
  return { space }
}

export async function setVerse(
  code: string,
  verse: Omit<VerseSelection, "updatedAt">,
): Promise<{ space: Space } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  space.verse = { ...verse, updatedAt: Date.now() }
  await persistSpace(space)
  return { space }
}

export async function clearVerse(
  code: string,
): Promise<{ space: Space } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  space.verse = null
  await persistSpace(space)
  return { space }
}
