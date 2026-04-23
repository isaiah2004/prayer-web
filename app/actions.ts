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
  grantVersePresenter as grantVersePresenterStore,
  reclaimVersePresenter as reclaimVersePresenterStore,
  requestSpin as requestSpinStore,
  denySpinRequest as denySpinRequestStore,
  requestPresenter as requestPresenterStore,
  denyPresenterRequest as denyPresenterRequestStore,
  setJoinMode as setJoinModeStore,
  approveJoinRequest as approveJoinRequestStore,
  denyJoinRequest as denyJoinRequestStore,
  recordCallStart as recordCallStartStore,
  recordCallEnd as recordCallEndStore,
  assertParticipantInSpace,
  peekSpace,
  getSpace,
} from "@/lib/store"
import {
  ensureRoom,
  deleteRoom,
  mintMeetingToken,
} from "@/lib/daily"
import type {
  JoinMode,
  PendingKind,
  RoulettePick,
  Space,
  SpacePublic,
  VerseSelection,
} from "@/lib/types"
import { parseReference } from "@/lib/bible/books"

function toPublic(space: Space | null): SpacePublic | null {
  if (!space) return null
  const { createdAt: _c, adminToken: _a, ...rest } = space
  void _c
  void _a
  return rest
}

export async function createSpaceAction(): Promise<{
  code: string
  adminToken: string
}> {
  const space = await createSpace()
  return { code: space.code, adminToken: space.adminToken }
}

export async function joinSpaceAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const raw = String(formData.get("code") ?? "").trim()
  const code = raw.toUpperCase().replace(/\s+/g, "")
  if (!code) return { error: "Enter a space code" }
  const space = await getSpace(code)
  if (!space) return { error: "Space not found" }
  redirect(`/space/${space.code}`)
}

export async function addParticipantAction(
  code: string,
  name: string,
  request: string,
  adminToken: string | null = null,
): Promise<{
  ok: boolean
  error?: string
  participantId?: string
  joinRequestId?: string
}> {
  const result = await addParticipantStore(code, name, request, {
    present: true,
    adminToken,
  })
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  if ("joinRequest" in result) {
    return { ok: true, joinRequestId: result.joinRequest.id }
  }
  return { ok: true, participantId: result.participant.id }
}

export async function addOtherParticipantAction(
  code: string,
  name: string,
  request: string,
): Promise<{ ok: boolean; error?: string; participantId?: string }> {
  const result = await addParticipantStore(code, name, request, {
    present: false,
  })
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  if ("participant" in result) {
    return { ok: true, participantId: result.participant.id }
  }
  // Not-present people can't be queued; this branch is unreachable.
  return { ok: true }
}

export async function removeParticipantAction(
  code: string,
  participantId: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await removeParticipantStore(code, participantId)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true }
}

export async function randomizeAction(
  code: string,
  adminToken: string | null,
): Promise<{ ok: boolean; error?: string; space?: SpacePublic }> {
  const result = await randomizeStore(code, adminToken)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true, space: toPublic(result.space)! }
}

export async function resetAction(
  code: string,
  adminToken: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const result = await resetStore(code, adminToken)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true }
}

export async function spinRouletteAction(
  code: string,
  adminToken: string | null,
): Promise<{ ok: boolean; error?: string; pick?: RoulettePick }> {
  const result = await spinRouletteStore(code, adminToken)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true, pick: result.pick }
}

export async function resetRouletteAction(
  code: string,
  adminToken: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const result = await resetRouletteStore(code, adminToken)
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
    adminToken: string | null
    callerId: string | null
  },
): Promise<{ ok: boolean; error?: string; verse?: VerseSelection }> {
  const parsed = parseReference(input.reference)
  if (!parsed)
    return {
      ok: false,
      error: 'Could not parse reference. Try "John 3:16" or "Psalm 23".',
    }
  const result = await setVerseStore(
    code,
    {
      reference: parsed.canonical,
      book: parsed.book.usfm,
      chapter: parsed.chapter,
      verseStart: parsed.verseStart,
      verseEnd: parsed.verseEnd,
      translationId: input.translationId,
      commentaryId: input.commentaryId,
      layout: input.layout,
    },
    { adminToken: input.adminToken, callerId: input.callerId },
  )
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true, verse: result.space.verse! }
}

export async function clearVerseAction(
  code: string,
  caller: { adminToken: string | null; callerId: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const result = await clearVerseStore(code, caller)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true }
}

export async function grantVersePresenterAction(
  code: string,
  adminToken: string | null,
  participantId: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await grantVersePresenterStore(code, adminToken, participantId)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true }
}

export async function reclaimVersePresenterAction(
  code: string,
  adminToken: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const result = await reclaimVersePresenterStore(code, adminToken)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true }
}

export async function requestSpinAction(
  code: string,
  kind: PendingKind,
  participantId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!participantId) {
    return {
      ok: false,
      error: "You need to add yourself to the space first.",
    }
  }
  const result = await requestSpinStore(code, kind, participantId)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true }
}

export async function approveSpinRequestAction(
  code: string,
  kind: PendingKind,
  adminToken: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (kind === "pair") {
    const result = await randomizeStore(code, adminToken)
    if ("error" in result) return { ok: false, error: result.error }
  } else {
    const result = await spinRouletteStore(code, adminToken)
    if ("error" in result) return { ok: false, error: result.error }
  }
  revalidatePath(`/space/${code}`)
  return { ok: true }
}

export async function denySpinRequestAction(
  code: string,
  kind: PendingKind,
  adminToken: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const result = await denySpinRequestStore(code, kind, adminToken)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true }
}

export async function requestPresenterAction(
  code: string,
  participantId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!participantId) {
    return {
      ok: false,
      error: "You need to add yourself to the space first.",
    }
  }
  const result = await requestPresenterStore(code, participantId)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true }
}

export async function denyPresenterRequestAction(
  code: string,
  participantId: string,
  adminToken: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const result = await denyPresenterRequestStore(
    code,
    participantId,
    adminToken,
  )
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true }
}

export async function setJoinModeAction(
  code: string,
  adminToken: string | null,
  mode: JoinMode,
): Promise<{ ok: boolean; error?: string }> {
  const result = await setJoinModeStore(code, adminToken, mode)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true }
}

export async function approveJoinRequestAction(
  code: string,
  adminToken: string | null,
  requestId: string,
): Promise<{ ok: boolean; error?: string; participantId?: string }> {
  const result = await approveJoinRequestStore(code, adminToken, requestId)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true, participantId: result.participant.id }
}

export async function denyJoinRequestAction(
  code: string,
  adminToken: string | null,
  requestId: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await denyJoinRequestStore(code, adminToken, requestId)
  if ("error" in result) return { ok: false, error: result.error }
  revalidatePath(`/space/${code}`)
  return { ok: true }
}

export async function startCallAction(
  code: string,
  adminToken: string | null,
): Promise<{ ok: boolean; error?: string; roomUrl?: string }> {
  const peek = await peekSpace(code)
  if ("error" in peek) return { ok: false, error: peek.error }
  if (peek.space.adminToken !== adminToken) {
    return { ok: false, error: "Only the admin can start the call." }
  }
  try {
    const { url } = await ensureRoom(code)
    const saved = await recordCallStartStore(code, adminToken, url)
    if ("error" in saved) return { ok: false, error: saved.error }
    revalidatePath(`/space/${code}`)
    return { ok: true, roomUrl: url }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't start call",
    }
  }
}

export async function endCallAction(
  code: string,
  adminToken: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const result = await recordCallEndStore(code, adminToken)
  if ("error" in result) return { ok: false, error: result.error }
  // Best-effort delete on Daily — non-fatal if it fails.
  try {
    await deleteRoom(code)
  } catch {
    /* ignore */
  }
  revalidatePath(`/space/${code}`)
  return { ok: true }
}

export async function mintCallTokenAction(
  code: string,
  participantId: string,
  adminToken: string | null,
): Promise<{ ok: boolean; error?: string; token?: string; roomUrl?: string }> {
  const peek = await peekSpace(code)
  if ("error" in peek) return { ok: false, error: peek.error }
  if (!peek.space.callRoomUrl) {
    return { ok: false, error: "No active call to join." }
  }
  const verified = await assertParticipantInSpace(code, participantId)
  if ("error" in verified) return { ok: false, error: verified.error }
  const isOwner =
    !!adminToken && adminToken === peek.space.adminToken
  try {
    const token = await mintMeetingToken({
      code,
      participantName: verified.participant.name,
      participantId: verified.participant.id,
      isOwner,
    })
    return { ok: true, token, roomUrl: peek.space.callRoomUrl }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't mint token",
    }
  }
}
