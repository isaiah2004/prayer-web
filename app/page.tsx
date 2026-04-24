import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  CreateSpaceForm,
  JoinSpaceForm,
  LandingHero,
} from "@/components/landing-forms"
import { ThemeToggle } from "@/components/theme-toggle"

export default function Page() {
  return (
    <main className="relative min-h-svh">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="relative mx-auto flex min-h-svh w-full max-w-3xl flex-col items-center justify-center gap-8 px-6 py-16">
        <LandingHero />
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Start a space</CardTitle>
              <CardDescription>
                We&apos;ll give you a short code to share.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreateSpaceForm />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Join a space</CardTitle>
              <CardDescription>Type in the code you received.</CardDescription>
            </CardHeader>
            <CardContent>
              <JoinSpaceForm />
            </CardContent>
          </Card>
        </div>
        <p className="text-muted-foreground text-center text-xs">
          Spaces are lightweight and ephemeral — great for one-time prayer
          circles.
        </p>
      </div>
    </main>
  )
}
