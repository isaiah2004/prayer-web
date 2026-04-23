export type TranslationInfo = {
  id: string
  shortName: string
  englishName: string
  language: string
}

export type VerseFragment = {
  number: number
  text: string
}

export type VerseResult = {
  translation: TranslationInfo
  reference: string
  verses: VerseFragment[]
  combinedText: string
}

export type CommentaryInfo = {
  id: string
  name: string
}

export type CommentaryResult = {
  commentary: CommentaryInfo
  reference: string
  verses: { number: number; text: string }[]
  combinedText: string
}

const API_BASE = "https://bible.helloao.org/api"

export const FEATURED_TRANSLATIONS: TranslationInfo[] = [
  { id: "BSB", shortName: "BSB", englishName: "Berean Standard Bible", language: "eng" },
  { id: "ENGWEBP", shortName: "WEB", englishName: "World English Bible", language: "eng" },
  { id: "eng_kjv", shortName: "KJV", englishName: "King James Version", language: "eng" },
  { id: "eng_asv", shortName: "ASV", englishName: "American Standard Version", language: "eng" },
  { id: "eng_ylt", shortName: "YLT", englishName: "Young's Literal Translation", language: "eng" },
  { id: "hbo_wlc", shortName: "WLC", englishName: "Hebrew OT (Westminster Leningrad Codex)", language: "hbo" },
  { id: "grc_sbl", shortName: "SBLGNT", englishName: "SBL Greek NT", language: "grc" },
  { id: "grc_byz", shortName: "BYZ", englishName: "Byzantine Greek NT", language: "grc" },
]

export const FEATURED_COMMENTARIES: CommentaryInfo[] = [
  { id: "matthew-henry", name: "Matthew Henry" },
  { id: "jamieson-fausset-brown", name: "Jamieson-Fausset-Brown" },
  { id: "adam-clarke", name: "Adam Clarke" },
  { id: "john-gill", name: "John Gill" },
]

function findTranslation(id: string): TranslationInfo | null {
  return FEATURED_TRANSLATIONS.find((t) => t.id === id) ?? null
}

function findCommentary(id: string): CommentaryInfo | null {
  return FEATURED_COMMENTARIES.find((c) => c.id === id) ?? null
}

type HelloAOChapterContent =
  | { type: "verse"; number: number; content: Array<string | { text?: string }> }
  | { type: "heading"; content: unknown }
  | { type: "line_break" }
  | { type: "hebrew_subtitle"; content: unknown }

function flattenContent(parts: Array<string | { text?: string } | unknown>): string {
  const segments: string[] = []
  for (const part of parts) {
    if (typeof part === "string") segments.push(part)
    else if (part && typeof part === "object" && "text" in part) {
      const txt = (part as { text?: string }).text
      if (typeof txt === "string") segments.push(txt)
    }
    // Non-text objects (noteId refs, formatting nodes) are skipped but still
    // act as segment boundaries so adjacent text fragments aren't glued together.
  }
  return segments
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim()
}

export async function fetchVerse(args: {
  translationId: string
  book: string
  chapter: number
  verseStart: number
  verseEnd?: number
}): Promise<VerseResult> {
  const translation = findTranslation(args.translationId)
  if (!translation) throw new Error("Unknown translation")

  const url = `${API_BASE}/${translation.id}/${args.book}/${args.chapter}.json`
  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } })
  if (!res.ok) throw new Error(`Bible API error: ${res.status}`)
  const data = (await res.json()) as {
    chapter: { content: HelloAOChapterContent[] }
    book: { name: string; commonName?: string }
  }

  const verses: VerseFragment[] = []
  const end = args.verseEnd ?? args.verseStart
  for (const item of data.chapter.content) {
    if (item.type === "verse" && item.number >= args.verseStart && item.number <= end) {
      verses.push({
        number: item.number,
        text: flattenContent(item.content),
      })
    }
  }
  const bookName = data.book.commonName ?? data.book.name
  const refRange =
    args.verseStart === end ? `${args.verseStart}` : `${args.verseStart}-${end}`
  const reference = `${bookName} ${args.chapter}:${refRange}`
  const combinedText = verses.map((v) => v.text).join(" ")
  return { translation, reference, verses, combinedText }
}

export async function fetchCommentary(args: {
  commentaryId: string
  book: string
  chapter: number
  verseStart: number
  verseEnd?: number
}): Promise<CommentaryResult> {
  const commentary = findCommentary(args.commentaryId)
  if (!commentary) throw new Error("Unknown commentary")

  const url = `${API_BASE}/c/${commentary.id}/${args.book}/${args.chapter}.json`
  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } })
  if (!res.ok) throw new Error(`Commentary API error: ${res.status}`)
  const data = (await res.json()) as {
    chapter: {
      introduction?: string | Array<string | { text?: string }>
      content: HelloAOChapterContent[]
    }
  }

  const allVerseEntries = data.chapter.content.filter(
    (item): item is Extract<HelloAOChapterContent, { type: "verse" }> =>
      item.type === "verse",
  )

  const end = args.verseEnd ?? args.verseStart
  const verses: { number: number; text: string }[] = []

  const startChunk = [...allVerseEntries]
    .reverse()
    .find((v) => v.number <= args.verseStart)
  const seen = new Set<number>()

  if (startChunk) {
    verses.push({
      number: startChunk.number,
      text: flattenContent(startChunk.content),
    })
    seen.add(startChunk.number)
  }

  for (const v of allVerseEntries) {
    if (seen.has(v.number)) continue
    if (v.number > args.verseStart && v.number <= end) {
      verses.push({
        number: v.number,
        text: flattenContent(v.content),
      })
      seen.add(v.number)
    }
  }

  const combinedText = verses.map((v) => v.text).join("\n\n")
  const refRange =
    args.verseStart === end ? `${args.verseStart}` : `${args.verseStart}-${end}`
  return {
    commentary,
    reference: `${args.book} ${args.chapter}:${refRange}`,
    verses,
    combinedText,
  }
}
