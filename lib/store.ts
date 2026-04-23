import { customAlphabet } from "nanoid"
import { get, put, del } from "@vercel/blob"
import type {
  Participant,
  PendingKind,
  PresenterRequest,
  RoulettePick,
  Space,
  SpinRequest,
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
const nanoSecret = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  32,
)

function isAdmin(space: Space, token: string | null | undefined): boolean {
  return !!token && token === space.adminToken
}

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
  if (typeof space.adminToken !== "string" || !space.adminToken) {
    // Old spaces: grant admin to whoever opens it next. In practice these
    // spaces are ephemeral (24h TTL) so migration is rare.
    space.adminToken = nanoSecret()
  }
  if (space.prayerOrder === undefined) space.prayerOrder = null
  if (space.versePresenterId === undefined) space.versePresenterId = null
  if (!Array.isArray(space.spinRequests)) space.spinRequests = []
  if (!Array.isArray(space.presenterRequests)) space.presenterRequests = []
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
    adminToken: nanoSecret(),
    participants: [],
    assignments: null,
    randomizedAt: null,
    prayerOrder: null,
    roulette: { weights: {}, history: [] },
    verse: null,
    versePresenterId: null,
    spinRequests: [],
    presenterRequests: [],
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
  space.presenterRequests = space.presenterRequests.filter(
    (r) => r.participantId !== participantId,
  )
  if (space.versePresenterId === participantId) {
    space.versePresenterId = null
  }
  // Drop the removed id from any spin-request audit lists too.
  for (const r of space.spinRequests) {
    r.requesterIds = r.requesterIds.filter((id) => id !== participantId)
  }
  space.assignments = null
  space.randomizedAt = null
  space.prayerOrder = null
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
  adminToken: string | null = null,
): Promise<{ space: Space } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  if (!isAdmin(space, adminToken))
    return { error: "Only the admin can generate prayer pairs." }

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
  // Generate a speaking order for present participants (shuffled).
  const orderIds = prayers.map((p) => p.id)
  shuffleInPlace(orderIds)
  space.prayerOrder = orderIds
  space.randomizedAt = Date.now()
  space.spinRequests = space.spinRequests.filter((r) => r.kind !== "pair")
  await persistSpace(space)
  return { space }
}

export async function resetAssignments(
  code: string,
  adminToken: string | null = null,
): Promise<{ space: Space } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  if (!isAdmin(space, adminToken))
    return { error: "Only the admin can reset." }
  space.assignments = null
  space.randomizedAt = null
  space.prayerOrder = null
  await persistSpace(space)
  return { space }
}

const MIN_WEIGHT = 1 / 1024

export async function spinRoulette(
  code: string,
  adminToken: string | null = null,
): Promise<{ space: Space; pick: RoulettePick } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  if (!isAdmin(space, adminToken))
    return { error: "Only the admin can spin the roulette." }

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
  space.spinRequests = space.spinRequests.filter((r) => r.kind !== "roulette")
  await persistSpace(space)
  return { space, pick }
}

export async function resetRoulette(
  code: string,
  adminToken: string | null = null,
): Promise<{ space: Space } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  if (!isAdmin(space, adminToken))
    return { error: "Only the admin can reset the roulette." }
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
  caller: { adminToken: string | null; callerId: string | null },
): Promise<{ space: Space } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  const callerIsAdmin = isAdmin(space, caller.adminToken)
  const callerIsPresenter =
    !!caller.callerId && caller.callerId === space.versePresenterId
  if (!callerIsAdmin && !callerIsPresenter) {
    return {
      error: "Only the admin or the current presenter can set the verse.",
    }
  }
  space.verse = { ...verse, updatedAt: Date.now() }
  await persistSpace(space)
  return { space }
}

export async function clearVerse(
  code: string,
  caller: { adminToken: string | null; callerId: string | null },
): Promise<{ space: Space } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  const callerIsAdmin = isAdmin(space, caller.adminToken)
  const callerIsPresenter =
    !!caller.callerId && caller.callerId === space.versePresenterId
  if (!callerIsAdmin && !callerIsPresenter) {
    return {
      error: "Only the admin or the current presenter can clear the verse.",
    }
  }
  space.verse = null
  await persistSpace(space)
  return { space }
}

export async function grantVersePresenter(
  code: string,
  adminToken: string | null,
  participantId: string,
): Promise<{ space: Space } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  if (!isAdmin(space, adminToken))
    return { error: "Only the admin can grant verse access." }
  const result = await grantVersePresenterInternal(space, participantId)
  if (result && "error" in result) return { error: result.error }
  await persistSpace(space)
  return { space }
}

export async function reclaimVersePresenter(
  code: string,
  adminToken: string | null,
): Promise<{ space: Space } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  if (!isAdmin(space, adminToken))
    return { error: "Only the admin can reclaim verse access." }
  space.versePresenterId = null
  await persistSpace(space)
  return { space }
}

const PRESENTER_REQUEST_COOLDOWN_MS = 30_000

export async function requestSpin(
  code: string,
  kind: PendingKind,
  participantId: string | null,
): Promise<{ space: Space } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  let requesterName = "Someone"
  if (participantId) {
    const p = space.participants.find((x) => x.id === participantId)
    if (p) requesterName = p.name
  }
  const existing = space.spinRequests.find((r) => r.kind === kind)
  if (existing) {
    // Spam-proof: first request wins (oldest on top). Track additional
    // requesters without moving the entry or bothering the admin twice.
    if (
      participantId &&
      !existing.requesterIds.includes(participantId)
    ) {
      existing.requesterIds.push(participantId)
    }
  } else {
    space.spinRequests.push({
      kind,
      firstRequestedAt: Date.now(),
      firstRequesterName: requesterName,
      requesterIds: participantId ? [participantId] : [],
    })
  }
  await persistSpace(space)
  return { space }
}

function clearSpinRequest(space: Space, kind: PendingKind) {
  space.spinRequests = space.spinRequests.filter((r) => r.kind !== kind)
}

export async function denySpinRequest(
  code: string,
  kind: PendingKind,
  adminToken: string | null,
): Promise<{ space: Space } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  if (!isAdmin(space, adminToken))
    return { error: "Only the admin can deny requests." }
  clearSpinRequest(space, kind)
  await persistSpace(space)
  return { space }
}

export async function requestPresenter(
  code: string,
  participantId: string,
): Promise<{ space: Space } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  const who = space.participants.find((p) => p.id === participantId)
  if (!who) return { error: "You are not in the space." }
  if (!who.present) return { error: "Not-present people can't request." }
  const now = Date.now()
  const existing = space.presenterRequests.find(
    (r) => r.participantId === participantId,
  )
  if (existing) {
    // Spam-proof: within the 30s cooldown we don't even bump
    // latestRequestedAt so nothing about the row changes visually. After
    // the cooldown, update the "latest" marker but never firstRequestedAt
    // — the oldest request stays on top.
    if (now - existing.latestRequestedAt > PRESENTER_REQUEST_COOLDOWN_MS) {
      existing.latestRequestedAt = now
    }
  } else {
    space.presenterRequests.push({
      participantId,
      firstRequestedAt: now,
      latestRequestedAt: now,
    })
    space.presenterRequests.sort(
      (a, b) => a.firstRequestedAt - b.firstRequestedAt,
    )
  }
  await persistSpace(space)
  return { space }
}

export async function grantVersePresenterInternal(
  space: Space,
  participantId: string,
) {
  const target = space.participants.find((p) => p.id === participantId)
  if (!target) return { error: "Participant not found" }
  if (!target.present) return { error: "Not-present people can't present." }
  space.versePresenterId = participantId
  space.presenterRequests = space.presenterRequests.filter(
    (r) => r.participantId !== participantId,
  )
  return null
}

export async function denyPresenterRequest(
  code: string,
  participantId: string,
  adminToken: string | null,
): Promise<{ space: Space } | { error: string }> {
  const space = await loadSpace(code)
  if (!space) return { error: "Space not found" }
  if (!isAdmin(space, adminToken))
    return { error: "Only the admin can deny requests." }
  space.presenterRequests = space.presenterRequests.filter(
    (r) => r.participantId !== participantId,
  )
  await persistSpace(space)
  return { space }
}
