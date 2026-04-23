export type Participant = {
  id: string
  name: string
  request: string
  createdAt: number
  /**
   * Whether this person is actually in the room (can be picked by the
   * roulette and can be assigned as a "prayer"). Admin can add absent
   * people whose requests still get prayed for, but who can't pray.
   */
  present: boolean
}

export type Assignment = {
  prayerId: string
  prayerName: string
  requestId: string
  requestName: string
  request: string
}

export type RoulettePick = {
  participantId: string
  participantName: string
  request: string
  pickedAt: number
}

export type RouletteState = {
  weights: Record<string, number>
  history: RoulettePick[]
}

export type PanelKind =
  | { kind: "translation"; translationId: string }
  | { kind: "commentary"; commentaryId: string }
  | { kind: "original" }

export type ViewLayout = {
  id: string
  name: string
  panels: PanelKind[]
}

export type VerseSelection = {
  reference: string
  book: string
  chapter: number
  verseStart: number
  verseEnd?: number
  translationId: string
  commentaryId: string
  layout: ViewLayout
  updatedAt: number
}

export type PendingKind = "pair" | "roulette"

export type SpinRequest = {
  kind: PendingKind
  firstRequestedAt: number
  firstRequesterName: string
  /** Unique requester IDs; added for auditing, UI shows count. */
  requesterIds: string[]
}

export type PresenterRequest = {
  participantId: string
  /**
   * When they first joined the queue. The queue is sorted ASC by this so
   * the oldest request stays on top — admin's click target doesn't shift.
   */
  firstRequestedAt: number
  latestRequestedAt: number
}

export type JoinMode = "open" | "request"

export type JoinRequest = {
  id: string
  name: string
  request: string
  requestedAt: number
}

export type Space = {
  code: string
  createdAt: number
  /**
   * Random token generated on create. The creator's browser stores this
   * in localStorage; it's required to run admin-only actions (randomize,
   * roulette spin, approve/deny requests, grant/reclaim verse presenter).
   */
  adminToken: string
  participants: Participant[]
  assignments: Assignment[] | null
  randomizedAt: number | null
  /** Shuffled participant IDs in speaking order (present only). */
  prayerOrder: string[] | null
  roulette: RouletteState
  verse: VerseSelection | null
  /** participantId of whoever currently has the "floor" for verse view. */
  versePresenterId: string | null
  /** At most one spin request per kind; oldest wins. */
  spinRequests: SpinRequest[]
  /** Queue of people asking for presenter access, oldest-first. */
  presenterRequests: PresenterRequest[]
  /** "open" (default): anyone joins instantly. "request": admin approves. */
  joinMode: JoinMode
  joinRequests: JoinRequest[]
  /** If set, the admin has an active video call going. URL points to Daily. */
  callRoomUrl: string | null
  callStartedAt: number | null
}

export type SpacePublic = Omit<Space, "createdAt" | "adminToken">
