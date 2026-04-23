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

function migrateSpace(space: Space): Space {
  // Older records may be missing the `present` flag — default to true so
  // existing participants are treated as being in the room.
  for (const p of space.participants) {
    if (typeof p.present !== "boolean") {
      (p as Participant).present = true
    }
  }
  return space
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
    const space = migrateSpace(JSON.parse(text) as Space)
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
  options: { present?: boolean } = {},
): Promise<
  { space: Space; participant: Participant } | { error: string }
> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  const present = options.present ?? true
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
    present,
  }
  space.participants.push(participant)
  if (present) {
    space.roulette.weights[participant.id] = 1
  }
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

function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
}

/**
 * Assign every `request` to one `prayer`, spreading the load as evenly as
 * possible and never giving a present person their own request.
 * - If prayers == 0, returns null (no one to pray).
 * - Every request is covered exactly once.
 * - Load balance: each prayer gets floor(R/P) or ceil(R/P) requests.
 * - No prayer is paired with their own request when possible.
 */
function buildAssignments(
  prayers: Participant[],
  requests: Participant[],
): Array<{ prayer: Participant; request: Participant }> | null {
  if (prayers.length === 0) return null
  const P = prayers.length
  const R = requests.length
  if (R === 0) return []

  const baseLoad = Math.floor(R / P)
  const extra = R - baseLoad * P
  // quotas[i] = how many requests prayers[i] gets
  for (let attempt = 0; attempt < 80; attempt++) {
    const shuffledPrayers = prayers.slice()
    shuffleInPlace(shuffledPrayers)
    const shuffledRequests = requests.slice()
    shuffleInPlace(shuffledRequests)

    // Build the list of prayer slots to fill (by repeating each prayer
    // by their quota). Prayers that get extra are the first `extra` in
    // the shuffled order.
    const slots: Participant[] = []
    for (let i = 0; i < P; i++) {
      const quota = baseLoad + (i < extra ? 1 : 0)
      for (let k = 0; k < quota; k++) slots.push(shuffledPrayers[i])
    }
    // slots.length === R

    // Pair slots[i] with shuffledRequests[i], avoiding self-matches.
    // If a self-match appears, try to swap with a later slot that doesn't
    // conflict.
    let ok = true
    for (let i = 0; i < R; i++) {
      if (slots[i].id === shuffledRequests[i].id) {
        let swapped = false
        for (let j = i + 1; j < R; j++) {
          if (
            slots[i].id !== shuffledRequests[j].id &&
            slots[j].id !== shuffledRequests[i].id
          ) {
            ;[shuffledRequests[i], shuffledRequests[j]] = [
              shuffledRequests[j],
              shuffledRequests[i],
            ]
            swapped = true
            break
          }
        }
        if (!swapped) {
          // Try swapping with an earlier position too.
          for (let j = 0; j < i; j++) {
            if (
              slots[i].id !== shuffledRequests[j].id &&
              slots[j].id !== shuffledRequests[i].id
            ) {
              ;[shuffledRequests[i], shuffledRequests[j]] = [
                shuffledRequests[j],
                shuffledRequests[i],
              ]
              swapped = true
              break
            }
          }
        }
        if (!swapped) {
          ok = false
          break
        }
      }
    }
    if (!ok) continue

    // Sanity: verify no self-match remains.
    let clean = true
    for (let i = 0; i < R; i++) {
      if (slots[i].id === shuffledRequests[i].id) {
        clean = false
        break
      }
    }
    if (!clean) continue

    return slots.map((prayer, i) => ({
      prayer,
      request: shuffledRequests[i],
    }))
  }

  // Fallback: accept a few self-matches if the set is too constrained
  // (e.g. 1 present + 1 absent — present person must pray for absent).
  const slots: Participant[] = []
  const shuffledPrayers = prayers.slice()
  shuffleInPlace(shuffledPrayers)
  const shuffledRequests = requests.slice()
  shuffleInPlace(shuffledRequests)
  for (let i = 0; i < P; i++) {
    const quota = baseLoad + (i < extra ? 1 : 0)
    for (let k = 0; k < quota; k++) slots.push(shuffledPrayers[i])
  }
  return slots.map((prayer, i) => ({
    prayer,
    request: shuffledRequests[i],
  }))
}

export async function randomize(
  code: string,
): Promise<{ space: Space } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }

  const requests = space.participants
  const prayers = space.participants.filter((p) => p.present)

  if (prayers.length === 0)
    return { error: "Need at least one present person to randomize" }
  if (requests.length < 2)
    return { error: "Need at least 2 participants to randomize" }

  const pairs = buildAssignments(prayers, requests)
  if (!pairs) return { error: "Couldn't build assignments" }

  space.assignments = pairs.map(({ prayer, request }) => ({
    prayerId: prayer.id,
    prayerName: prayer.name,
    requestId: request.id,
    requestName: request.name,
    request: request.request,
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

  const present = space.participants.filter((p) => p.present)
  if (present.length === 0)
    return { error: "Add at least one present person first" }

  for (const p of present) {
    if (space.roulette.weights[p.id] == null) {
      space.roulette.weights[p.id] = 1
    }
  }
  // Make sure non-present people are never weighted, even if older state
  // accidentally seeded them.
  for (const p of space.participants) {
    if (!p.present) delete space.roulette.weights[p.id]
  }

  let total = 0
  for (const p of present) {
    total += space.roulette.weights[p.id] ?? 0
  }
  if (total <= 0) {
    for (const p of present) space.roulette.weights[p.id] = 1
    total = present.length
  }

  let roll = Math.random() * total
  let picked = present[present.length - 1]
  for (const p of present) {
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
    weights: Object.fromEntries(
      space.participants.filter((p) => p.present).map((p) => [p.id, 1]),
    ),
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
