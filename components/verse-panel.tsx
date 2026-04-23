"use client"

import * as React from "react"
import useSWR from "swr"
import { BookOpen, MessageSquareQuote, Languages, ExternalLink } from "lucide-react"

import { cn } from "@/lib/utils"
import type { PanelKind, VerseSelection } from "@/lib/types"
import {
  FEATURED_TRANSLATIONS,
  FEATURED_COMMENTARIES,
} from "@/lib/bible/api"
import { Button } from "@/components/ui/button"

const OT_BOOKS = new Set([
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT",
  "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH",
  "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER",
  "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON",
  "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL",
])

function useBibleData(
  verse: VerseSelection | null,
  kind:
    | { kind: "translation"; translationId: string }
    | { kind: "commentary"; commentaryId: string },
) {
  const params = React.useMemo(() => {
    if (!verse) return null
    const p = new URLSearchParams({
      book: verse.book,
      chapter: String(verse.chapter),
      verseStart: String(verse.verseStart),
    })
    if (verse.verseEnd) p.set("verseEnd", String(verse.verseEnd))
    if (kind.kind === "translation") p.set("translation", kind.translationId)
    else p.set("commentary", kind.commentaryId)
    return p.toString()
  }, [verse, kind])

  const key = params ? `/api/bible?${params}` : null
  const { data, error, isLoading } = useSWR(key, async (url: string) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
    return res.json()
  })
  return { data, error, isLoading }
}

type TranslationPayload = {
  translation: { id: string; shortName: string; englishName: string; language: string }
  reference: string
  verses: { number: number; text: string }[]
}

type CommentaryPayload = {
  commentary: { id: string; name: string }
  reference: string
  verses: { number: number; text: string }[]
}

export function TranslationPanel({
  verse,
  translationId,
  className,
}: {
  verse: VerseSelection | null
  translationId: string
  className?: string
}) {
  const { data, error, isLoading } = useBibleData(verse, {
    kind: "translation",
    translationId,
  })
  const payload = data as TranslationPayload | undefined

  const info = FEATURED_TRANSLATIONS.find((t) => t.id === translationId)
  const isRTL = info?.language === "hbo" || info?.language === "heb"
  const isGreek = info?.language === "grc"

  return (
    <PanelShell
      icon={<BookOpen className="size-4" />}
      title={info?.shortName ?? translationId}
      subtitle={info?.englishName}
      className={className}
    >
      {!verse ? (
        <Empty message="No verse selected yet." />
      ) : isLoading ? (
        <LoadingText />
      ) : error ? (
        <ErrorText message={(error as Error).message} />
      ) : !payload || payload.verses.length === 0 ? (
        <Empty message="No verses returned." />
      ) : (
        <div
          dir={isRTL ? "rtl" : "ltr"}
          className={cn(
            "space-y-3 px-4 py-4 text-base leading-relaxed",
            isRTL && "font-serif text-xl leading-loose",
            isGreek && "font-serif text-lg leading-loose",
          )}
        >
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            {payload.reference}
          </div>
          <div className="space-y-2">
            {payload.verses.map((v) => (
              <p key={v.number}>
                <sup className="text-muted-foreground mr-1 text-xs font-semibold">
                  {v.number}
                </sup>
                {v.text}
              </p>
            ))}
          </div>
        </div>
      )}
    </PanelShell>
  )
}

export function CommentaryPanel({
  verse,
  commentaryId,
  className,
}: {
  verse: VerseSelection | null
  commentaryId: string
  className?: string
}) {
  const { data, error, isLoading } = useBibleData(verse, {
    kind: "commentary",
    commentaryId,
  })
  const payload = data as CommentaryPayload | undefined
  const info = FEATURED_COMMENTARIES.find((c) => c.id === commentaryId)

  return (
    <PanelShell
      icon={<MessageSquareQuote className="size-4" />}
      title="Commentary"
      subtitle={info?.name}
      className={className}
    >
      {!verse ? (
        <Empty message="Pick a verse to see commentary." />
      ) : isLoading ? (
        <LoadingText />
      ) : error ? (
        <ErrorText message={(error as Error).message} />
      ) : !payload || payload.verses.length === 0 ? (
        <Empty message="No commentary available for this verse." />
      ) : (
        <div className="space-y-4 px-4 py-4 text-sm leading-relaxed">
          {payload.verses.map((v) => (
            <div key={v.number}>
              <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                v. {v.number}
              </div>
              <p className="mt-1 whitespace-pre-line">{v.text}</p>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  )
}

export function OriginalLanguagePanel({
  verse,
  className,
}: {
  verse: VerseSelection | null
  className?: string
}) {
  const isOT = verse ? OT_BOOKS.has(verse.book) : true
  const translationId = isOT ? "hbo_wlc" : "grc_sbl"
  const { data, error, isLoading } = useBibleData(
    verse,
    { kind: "translation", translationId },
  )
  const payload = data as TranslationPayload | undefined

  const interlinearUrl = React.useMemo(() => {
    if (!verse) return null
    const bookSlug = verse.book.toLowerCase()
    return `https://biblehub.com/interlinear/${bookSlug}/${verse.chapter}-${verse.verseStart}.htm`
  }, [verse])

  return (
    <PanelShell
      icon={<Languages className="size-4" />}
      title={isOT ? "Hebrew (WLC)" : "Greek (SBL)"}
      subtitle="Original-language text"
      className={className}
      actions={
        interlinearUrl ? (
          <Button
            asChild
            variant="ghost"
            size="sm"
            title="Open interlinear with Strong's numbers"
          >
            <a
              href={interlinearUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              <ExternalLink data-icon="inline-start" />
              Roots / Strong&apos;s
            </a>
          </Button>
        ) : null
      }
    >
      {!verse ? (
        <Empty message="Pick a verse to see the original text." />
      ) : isLoading ? (
        <LoadingText />
      ) : error ? (
        <ErrorText message={(error as Error).message} />
      ) : !payload || payload.verses.length === 0 ? (
        <Empty message="Original text not available for this passage." />
      ) : (
        <div
          dir={isOT ? "rtl" : "ltr"}
          className={cn(
            "space-y-3 px-4 py-4 font-serif",
            isOT ? "text-xl leading-loose" : "text-lg leading-loose",
          )}
        >
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            {payload.reference}
          </div>
          {payload.verses.map((v) => (
            <p key={v.number} className="select-text">
              <sup className="text-muted-foreground mr-1 text-xs">
                {v.number}
              </sup>
              {v.text}
            </p>
          ))}
          <p className="text-muted-foreground pt-2 text-xs" dir="ltr">
            Tap &quot;Roots / Strong&apos;s&quot; above to open the interlinear for
            this verse on Bible Hub.
          </p>
        </div>
      )}
    </PanelShell>
  )
}

export function VersePanel({
  kind,
  verse,
  className,
}: {
  kind: PanelKind
  verse: VerseSelection | null
  className?: string
}) {
  if (kind.kind === "translation") {
    return (
      <TranslationPanel
        verse={verse}
        translationId={kind.translationId}
        className={className}
      />
    )
  }
  if (kind.kind === "commentary") {
    return (
      <CommentaryPanel
        verse={verse}
        commentaryId={kind.commentaryId}
        className={className}
      />
    )
  }
  return <OriginalLanguagePanel verse={verse} className={className} />
}

function PanelShell({
  icon,
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "bg-card flex h-full flex-col overflow-hidden rounded-xl border shadow-sm",
        className,
      )}
    >
      <div className="bg-muted/40 flex items-center gap-2 border-b px-3 py-2">
        <div className="text-primary">{icon}</div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{title}</span>
          {subtitle ? (
            <span className="text-muted-foreground truncate text-xs">
              {subtitle}
            </span>
          ) : null}
        </div>
        <div className="ml-auto">{actions}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}

function LoadingText() {
  return (
    <div className="space-y-2 px-4 py-4">
      <div className="bg-muted h-3 w-1/3 animate-pulse rounded" />
      <div className="bg-muted h-3 w-5/6 animate-pulse rounded" />
      <div className="bg-muted h-3 w-4/6 animate-pulse rounded" />
      <div className="bg-muted h-3 w-3/4 animate-pulse rounded" />
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground flex h-full items-center justify-center px-4 py-8 text-center text-sm">
      {message}
    </div>
  )
}

function ErrorText({ message }: { message: string }) {
  return (
    <div className="text-destructive px-4 py-4 text-sm">{message}</div>
  )
}
