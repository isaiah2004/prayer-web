import { NextResponse } from "next/server"
import { fetchVerse, fetchCommentary } from "@/lib/bible/api"

export const revalidate = 3600

export async function GET(req: Request) {
  const url = new URL(req.url)
  const book = url.searchParams.get("book")
  const chapterStr = url.searchParams.get("chapter")
  const verseStartStr = url.searchParams.get("verseStart") ?? "1"
  const verseEndStr = url.searchParams.get("verseEnd")
  const translationId = url.searchParams.get("translation")
  const commentaryId = url.searchParams.get("commentary")

  if (!book || !chapterStr) {
    return NextResponse.json(
      { error: "book and chapter are required" },
      { status: 400 },
    )
  }

  const chapter = parseInt(chapterStr, 10)
  const verseStart = parseInt(verseStartStr, 10)
  const verseEnd = verseEndStr ? parseInt(verseEndStr, 10) : undefined

  try {
    if (commentaryId) {
      const result = await fetchCommentary({
        commentaryId,
        book,
        chapter,
        verseStart,
        verseEnd,
      })
      return NextResponse.json(result)
    }

    if (!translationId) {
      return NextResponse.json(
        { error: "translation or commentary is required" },
        { status: 400 },
      )
    }

    const result = await fetchVerse({
      translationId,
      book,
      chapter,
      verseStart,
      verseEnd,
    })
    return NextResponse.json(result)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch passage"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
