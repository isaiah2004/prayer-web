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

export type Space = {
  code: string
  createdAt: number
  participants: Participant[]
  assignments: Assignment[] | null
  randomizedAt: number | null
  roulette: RouletteState
  verse: VerseSelection | null
}

export type SpacePublic = Omit<Space, "createdAt">
