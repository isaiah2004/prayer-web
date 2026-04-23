import { NextResponse } from "next/server"
import { getSpace } from "@/lib/store"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const space = getSpace(code)
  if (!space) {
    return NextResponse.json({ error: "Space not found" }, { status: 404 })
  }
  return NextResponse.json({
    code: space.code,
    participants: space.participants,
    assignments: space.assignments,
    randomizedAt: space.randomizedAt,
    roulette: space.roulette,
    verse: space.verse,
  })
}
