"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import {
  createSpace,
  addParticipant as addParticipantStore,
  removeParticipant as removeParticipantStore,
  randomize as randomizeStore,
  resetAssignments as resetStore,
  spinRoulette as spinRouletteStore,
  resetRoulette as resetRouletteStore,
  setVerse as setVerseStore,
  clearVerse as clearVerseStore,
  getSpace,
} from "@/lib/store"
import type {
  RoulettePick,
  SpacePublic,
  VerseSelection,
} from "@/lib/types"
import { parseReference } from "@/lib/bible/books"

function toPublic(space: ReturnType<typeof getSpace>): SpacePublic | null {
  if (!space) return null
  const { createdAt: _ignored, ...rest } = space
  void _ignored
  return rest
}

export async function createSpaceAction() {
  const space = createSpace()
  redirect(`/space/${space.code}`)
}

export async function joinSpaceAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const raw = String(formData.get("code") ?? "").trim()
  const code = raw.toUpperCase().replace(/\s+/g, "")
  if (!code) return { error: "Enter a space code" }
  const space = getSpace(code)
  if (!space) return { error: "Space not found" }
  redirect(`/space/${space.code}`)
}

export async function addParticipantAction(
  code: string,
  name: string,
  request: string,
): Promise<{ ok: boolean; error?: string; participantId?: string }> {
  const result = addParticipantStore(code, name, request)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true, participantId: result.participant.id }
}

export async function removeParticipantAction(
  code: string,
  participantId: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = removeParticipantStore(code, participantId)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true }
}

export async function randomizeAction(
  code: string,
): Promise<{ ok: boolean; error?: string; space?: SpacePublic }> {
  const result = randomizeStore(code)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true, space: toPublic(result.space)! }
}

export async function resetAction(
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = resetStore(code)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true }
}

export async function spinRouletteAction(
  code: string,
): Promise<{ ok: boolean; error?: string; pick?: RoulettePick }> {
  const result = spinRouletteStore(code)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true, pick: result.pick }
}

export async function resetRouletteAction(
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = resetRouletteStore(code)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true }
}

export async function setVerseAction(
  code: string,
  input: {
    reference: string
    translationId: string
    commentaryId: string
    layout: VerseSelection["layout"]
  },
): Promise<{ ok: boolean; error?: string; verse?: VerseSelection }> {
  const parsed = parseReference(input.reference)
  if (!parsed)
    return {
      ok: false,
      error: 'Could not parse reference. Try "John 3:16" or "Psalm 23".',
    }
  const result = setVerseStore(code, {
    reference: parsed.canonical,
    book: parsed.book.usfm,
    chapter: parsed.chapter,
    verseStart: parsed.verseStart,
    verseEnd: parsed.verseEnd,
    translationId: input.translationId,
    commentaryId: input.commentaryId,
    layout: input.layout,
  })
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true, verse: result.space.verse! }
}

export async function clearVerseAction(
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = clearVerseStore(code)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true }
}
