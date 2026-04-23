import { customAlphabet } from "nanoid"
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

const spaces: Map<string, Space> =
  globalForStore.__prayerSpaces ?? new Map<string, Space>()

if (!globalForStore.__prayerSpaces) {
  globalForStore.__prayerSpaces = spaces
}

const nanoCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6)
const nanoId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10)

function gc() {
  const now = Date.now()
  for (const [key, space] of spaces) {
    if (now - space.createdAt > SPACE_TTL_MS) spaces.delete(key)
  }
}

export function createSpace(): Space {
  gc()
  let code = nanoCode()
  while (spaces.has(code)) code = nanoCode()
  const space: Space = {
    code,
    createdAt: Date.now(),
    participants: [],
    assignments: null,
    randomizedAt: null,
    roulette: { weights: {}, history: [] },
    verse: null,
  }
  spaces.set(code, space)
  return space
}

export function getSpace(code: string): Space | null {
  gc()
  return spaces.get(code.toUpperCase()) ?? null
}

export function addParticipant(
  code: string,
  name: string,
  request: string,
): { space: Space; participant: Participant } | { error: string } {
  const space = getSpace(code)
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
  return { space, participant }
}

export function removeParticipant(
  code: string,
  participantId: string,
): { space: Space } | { error: string } {
  const space = getSpace(code)
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

export function randomize(code: string): { space: Space } | { error: string } {
  const space = getSpace(code)
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
  return { space }
}

export function resetAssignments(
  code: string,
): { space: Space } | { error: string } {
  const space = getSpace(code)
  if (!space) return { error: "Space not found" }
  space.assignments = null
  space.randomizedAt = null
  return { space }
}

const MIN_WEIGHT = 1 / 1024

export function spinRoulette(
  code: string,
): { space: Space; pick: RoulettePick } | { error: string } {
  const space = getSpace(code)
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
  return { space, pick }
}

export function resetRoulette(
  code: string,
): { space: Space } | { error: string } {
  const space = getSpace(code)
  if (!space) return { error: "Space not found" }
  space.roulette = {
    weights: Object.fromEntries(space.participants.map((p) => [p.id, 1])),
    history: [],
  }
  return { space }
}

export function setVerse(
  code: string,
  verse: Omit<VerseSelection, "updatedAt">,
): { space: Space } | { error: string } {
  const space = getSpace(code)
  if (!space) return { error: "Space not found" }
  space.verse = { ...verse, updatedAt: Date.now() }
  return { space }
}

export function clearVerse(
  code: string,
): { space: Space } | { error: string } {
  const space = getSpace(code)
  if (!space) return { error: "Space not found" }
  space.verse = null
  return { space }
}
