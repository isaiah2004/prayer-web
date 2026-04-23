import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Space not found</h1>
      <p className="text-muted-foreground max-w-md">
        This space doesn&apos;t exist or may have expired. Spaces live for 24
        hours.
      </p>
      <Button asChild>
        <Link href="/">Back home</Link>
      </Button>
    </main>
  )
}
