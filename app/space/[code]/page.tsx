import { notFound } from "next/navigation"
import { getSpace } from "@/lib/store"
import { SpaceView } from "@/components/space-view"

export const dynamic = "force-dynamic"

export default async function SpacePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const upperCode = code.toUpperCase()
  const space = await getSpace(upperCode)
  if (!space) notFound()

  return (
    <SpaceView
      initial={{
        code: space.code,
        participants: space.participants,
        assignments: space.assignments,
        randomizedAt: space.randomizedAt,
        prayerOrder: space.prayerOrder,
        roulette: space.roulette,
        verse: space.verse,
        versePresenterId: space.versePresenterId,
        spinRequests: space.spinRequests,
        presenterRequests: space.presenterRequests,
      }}
    />
  )
}
