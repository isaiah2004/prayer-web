"use client"

import * as React from "react"
import Fuse from "fuse.js"
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  Check,
  ChevronDown,
  LayoutGrid,
  List,
  Search,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  BOOKS,
  booksInTestament,
  testamentOf,
  type BookEntry,
  type Testament,
} from "@/lib/bible/books"

export type VerseRangeSelection = {
  book: BookEntry
  startChapter: number
  startVerse: number
  endChapter: number
  endVerse: number
  /** Canonical string like "John 3:16-17" or "John 3:16" */
  reference: string
}

type Props = {
  open: boolean
  onClose: () => void
  onSelect: (selection: VerseRangeSelection) => void
  /** Optional initial book to pre-load the range step */
  initialBook?: BookEntry | null
}

type Step =
  | { kind: "pick-book" }
  | { kind: "range"; book: BookEntry }

type Mode = "browse" | "search"
type GridView = "canonical" | "alphabetical"
type Endpoint = "start" | "end"

export function VersePicker({ open, onClose, onSelect, initialBook }: Props) {
  const [step, setStep] = React.useState<Step>(
    initialBook ? { kind: "range", book: initialBook } : { kind: "pick-book" },
  )
  const [mode, setMode] = React.useState<Mode>("browse")
  const [testament, setTestament] = React.useState<Testament | null>(null)
  const [view, setView] = React.useState<GridView>("canonical")
  const [query, setQuery] = React.useState("")

  // Reset on open/close.
  React.useEffect(() => {
    if (!open) return
    setStep(
      initialBook ? { kind: "range", book: initialBook } : { kind: "pick-book" },
    )
    setMode("browse")
    setTestament(null)
    setQuery("")
  }, [open, initialBook])

  // Esc to close.
  React.useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (step.kind === "range") {
          setStep({ kind: "pick-book" })
          e.stopPropagation()
          return
        }
        if (testament) {
          setTestament(null)
          e.stopPropagation()
          return
        }
        onClose()
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open, step, testament, onClose])

  if (!open) return null

  const body = (
    <>
      <PickerHeader
        step={step}
        mode={mode}
        testament={testament}
        onMode={setMode}
        onBack={() => {
          if (step.kind === "range") setStep({ kind: "pick-book" })
          else if (testament) setTestament(null)
        }}
        onClose={onClose}
      />

      <AutoHeight>
        <div
          key={stepKey(step, mode, testament, view)}
          className="animate-in fade-in-0 slide-in-from-top-1 duration-200 ease-out"
        >
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
            {step.kind === "pick-book" ? (
              mode === "search" ? (
                <SearchMode
                  query={query}
                  setQuery={setQuery}
                  onSelectBook={(book) => setStep({ kind: "range", book })}
                />
              ) : testament ? (
                <BookGrid
                  testament={testament}
                  view={view}
                  setView={setView}
                  onSelectBook={(book) => setStep({ kind: "range", book })}
                />
              ) : (
                <TestamentStep onPick={setTestament} />
              )
            ) : (
              <RangeStep
                book={step.book}
                onSelect={(selection) => {
                  onSelect(selection)
                  onClose()
                }}
                onCancel={() => setStep({ kind: "pick-book" })}
              />
            )}
          </div>
        </div>
      </AutoHeight>
    </>
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick a Bible verse"
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 p-4 pt-[min(12vh,8rem)]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "pw-noise relative w-[min(100%,48rem)] overflow-hidden rounded-2xl shadow-2xl",
          "border border-white/30 dark:border-white/10",
          "bg-white/40 dark:bg-black/40",
          "backdrop-blur-sm backdrop-saturate-150",
        )}
      >
        <div className="relative z-10 flex flex-col">{body}</div>
      </div>
    </div>
  )
}

function stepKey(
  step: Step,
  mode: Mode,
  testament: Testament | null,
  view: GridView,
): string {
  if (step.kind === "range") return `range:${step.book.usfm}`
  if (mode === "search") return "search"
  if (testament) return `books:${testament}:${view}`
  return "testament"
}

/**
 * Smoothly animates the height of its child as the content changes.
 *
 * The first measurement is applied WITHOUT a transition, so the dialog
 * doesn't "pop" from 0 → N on first open. Subsequent size changes animate.
 */
function AutoHeight({ children }: { children: React.ReactNode }) {
  const innerRef = React.useRef<HTMLDivElement | null>(null)
  const [height, setHeight] = React.useState<number | null>(null)
  const [enableTransition, setEnableTransition] = React.useState(false)

  React.useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return
    // Initial measurement (no transition).
    setHeight(el.offsetHeight)
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.round(entry.contentRect.height)
        setHeight(h)
      }
    })
    ro.observe(el)
    // Enable transition after the first paint so the first size doesn't animate from 0.
    const id = requestAnimationFrame(() => setEnableTransition(true))
    return () => {
      cancelAnimationFrame(id)
      ro.disconnect()
    }
  }, [])

  return (
    <div
      style={{
        height: height ?? "auto",
        transition: enableTransition
          ? "height 220ms cubic-bezier(0.22, 1, 0.36, 1)"
          : "none",
        overflow: "hidden",
        willChange: enableTransition ? "height" : undefined,
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  )
}

function PickerHeader({
  step,
  mode,
  testament,
  onMode,
  onBack,
  onClose,
}: {
  step: Step
  mode: Mode
  testament: Testament | null
  onMode: (m: Mode) => void
  onBack: () => void
  onClose: () => void
}) {
  const showBack = step.kind === "range" || !!testament
  return (
    <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3 dark:border-white/5">
      {showBack ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          aria-label="Back"
        >
          <ArrowLeft />
        </Button>
      ) : (
        <div className="text-primary">
          <BookOpen className="size-4" />
        </div>
      )}
      <div className="text-sm font-medium">
        {step.kind === "range"
          ? `Pick a range in ${step.book.name}`
          : mode === "search"
            ? "Search for a book"
            : testament
              ? testament === "old"
                ? "Old Testament"
                : "New Testament"
              : "Pick a Bible verse"}
      </div>
      {step.kind === "pick-book" ? (
        <div className="bg-muted/60 ml-3 inline-flex rounded-full p-0.5">
          <button
            type="button"
            onClick={() => onMode("browse")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              mode === "browse"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Browse
          </button>
          <button
            type="button"
            onClick={() => onMode("search")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              mode === "search"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Search
          </button>
        </div>
      ) : null}
      <div className="ml-auto">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close picker"
        >
          <X />
        </Button>
      </div>
    </div>
  )
}

function TestamentStep({ onPick }: { onPick: (t: Testament) => void }) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (e.key === "o" || e.key === "O") {
        onPick("old")
        e.preventDefault()
      } else if (e.key === "n" || e.key === "N") {
        onPick("new")
        e.preventDefault()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onPick])

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TestamentCard
        title="Old Testament"
        subtitle="Genesis → Malachi · 39 books"
        shortcut="O"
        onClick={() => onPick("old")}
        icon={<BookMarked className="size-5" />}
      />
      <TestamentCard
        title="New Testament"
        subtitle="Matthew → Revelation · 27 books"
        shortcut="N"
        onClick={() => onPick("new")}
        icon={<BookOpen className="size-5" />}
      />
    </div>
  )
}

function TestamentCard({
  title,
  subtitle,
  shortcut,
  onClick,
  icon,
}: {
  title: string
  subtitle: string
  shortcut: string
  onClick: () => void
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pw-acrylic-tile group flex flex-col gap-2 rounded-xl p-4 text-left",
        "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px] focus-visible:outline-none",
      )}
    >
      <div className="flex items-center gap-2">
        <div className="text-primary">{icon}</div>
        <span className="font-semibold">{title}</span>
        <kbd className="bg-muted text-muted-foreground ml-auto rounded-md border px-1.5 py-0.5 text-[10px] font-mono font-medium">
          {shortcut}
        </kbd>
      </div>
      <p className="text-muted-foreground text-xs">{subtitle}</p>
    </button>
  )
}

function BookGrid({
  testament,
  view,
  setView,
  onSelectBook,
}: {
  testament: Testament
  view: GridView
  setView: (v: GridView) => void
  onSelectBook: (book: BookEntry) => void
}) {
  const books = React.useMemo(() => booksInTestament(testament), [testament])
  const [filter, setFilter] = React.useState("")

  const fuse = React.useMemo(
    () =>
      new Fuse(books, {
        keys: ["name", "aliases", "usfm"],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [books],
  )
  const filtered = React.useMemo(() => {
    const trimmed = filter.trim()
    if (!trimmed) return books
    return fuse.search(trimmed).map((r) => r.item)
  }, [filter, books, fuse])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter books…"
            autoFocus
            className="pl-8"
          />
        </div>
        <div className="bg-muted/60 inline-flex rounded-full p-0.5">
          <button
            type="button"
            onClick={() => setView("canonical")}
            title="Canonical order"
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              view === "canonical"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="size-3" />
            Canonical
          </button>
          <button
            type="button"
            onClick={() => setView("alphabetical")}
            title="Alphabet grid"
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              view === "alphabetical"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="size-3" />
            A–Z grid
          </button>
        </div>
      </div>
      {view === "canonical" ? (
        <CanonicalGrid books={filtered} onSelect={onSelectBook} />
      ) : (
        <AlphabetGrid
          books={books}
          highlight={new Set(filtered.map((b) => b.usfm))}
          onSelect={onSelectBook}
        />
      )}
    </div>
  )
}

function CanonicalGrid({
  books,
  onSelect,
}: {
  books: BookEntry[]
  onSelect: (b: BookEntry) => void
}) {
  if (books.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        No books match that filter.
      </div>
    )
  }
  return (
    <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {books.map((book) => (
        <li key={book.usfm}>
          <BookButton book={book} onClick={() => onSelect(book)} />
        </li>
      ))}
    </ul>
  )
}

function AlphabetGrid({
  books,
  highlight,
  onSelect,
}: {
  books: BookEntry[]
  /** USFM set of books that match the current filter (full-opacity) */
  highlight: Set<string>
  onSelect: (b: BookEntry) => void
}) {
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
  const booksByLetter = React.useMemo(() => {
    const map = new Map<string, BookEntry[]>()
    for (const letter of LETTERS) map.set(letter, [])
    for (const book of books) {
      // Take the first letter of the name. For "1 Samuel" etc., skip the numeric prefix.
      const n = book.name.replace(/^[123]\s*/, "")
      const first = n.charAt(0).toUpperCase()
      map.get(first)?.push(book)
    }
    return map
  }, [books, LETTERS])

  return (
    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
      {LETTERS.map((letter) => {
        const entries = booksByLetter.get(letter) ?? []
        const hasAny = entries.length > 0
        const dim =
          entries.length > 0 && entries.every((b) => !highlight.has(b.usfm))
        return (
          <div
            key={letter}
            className={cn(
              "pw-acrylic-tile flex min-h-[84px] flex-col gap-1 rounded-lg p-2",
              !hasAny && "opacity-40",
              dim && "opacity-50",
            )}
          >
            <div className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
              {letter}
            </div>
            {entries.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {entries.map((b) => (
                  <button
                    key={b.usfm}
                    type="button"
                    onClick={() => onSelect(b)}
                    className={cn(
                      "hover:bg-primary/10 truncate rounded px-1.5 py-0.5 text-left text-xs font-medium transition-colors",
                      !highlight.has(b.usfm) && "text-muted-foreground",
                    )}
                    title={b.name}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function BookButton({
  book,
  onClick,
}: {
  book: BookEntry
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pw-acrylic-tile flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px] focus-visible:outline-none",
      )}
    >
      <span className="truncate font-medium">{book.name}</span>
      <span className="text-muted-foreground text-xs">{book.chapters}</span>
    </button>
  )
}

function SearchMode({
  query,
  setQuery,
  onSelectBook,
}: {
  query: string
  setQuery: (q: string) => void
  onSelectBook: (book: BookEntry) => void
}) {
  const fuse = React.useMemo(
    () =>
      new Fuse(BOOKS, {
        keys: [
          { name: "name", weight: 0.7 },
          { name: "aliases", weight: 0.2 },
          { name: "usfm", weight: 0.1 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [],
  )

  const results = React.useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) return BOOKS.slice(0, 20)
    return fuse.search(trimmed).map((r) => r.item)
  }, [query, fuse])

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && results[0]) {
      e.preventDefault()
      onSelectBook(results[0])
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          placeholder="Genesis, John, 1 Cor…"
          className="h-10 pl-9 text-base"
        />
      </div>
      {results.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          No matches for &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {results.map((book, i) => (
            <li key={book.usfm}>
              <button
                type="button"
                onClick={() => onSelectBook(book)}
                className={cn(
                  "hover:bg-primary/10 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                  i === 0 &&
                    query.trim().length > 0 &&
                    "bg-primary/5 ring-primary/30 ring-1",
                )}
              >
                <span className="bg-muted text-muted-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold">
                  {book.usfm}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {book.name}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {testamentOf(book.usfm) === "old" ? "OT" : "NT"} ·{" "}
                    {book.chapters}{" "}
                    {book.chapters === 1 ? "chapter" : "chapters"}
                  </div>
                </div>
                {i === 0 && query.trim().length > 0 ? (
                  <kbd className="bg-muted text-muted-foreground rounded-md border px-1.5 py-0.5 text-[10px] font-mono font-medium">
                    Enter
                  </kbd>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RangeStep({
  book,
  onSelect,
  onCancel,
}: {
  book: BookEntry
  onSelect: (selection: VerseRangeSelection) => void
  onCancel: () => void
}) {
  // Two endpoints: start + end. Currently editing one of them.
  const [editing, setEditing] = React.useState<Endpoint>("start")
  const [startChapter, setStartChapter] = React.useState(1)
  const [startVerse, setStartVerse] = React.useState(1)
  const [endChapter, setEndChapter] = React.useState(1)
  const [endVerse, setEndVerse] = React.useState(1)
  const [verseCountCache, setVerseCountCache] = React.useState<
    Record<number, number>
  >({})
  const [loadingChapter, setLoadingChapter] = React.useState<number | null>(
    null,
  )

  // When the user clicks a chapter in the left column, update the currently
  // edited endpoint's chapter and reset its verse. Verse count is fetched.
  const currentChapter = editing === "start" ? startChapter : endChapter
  const currentVerse = editing === "start" ? startVerse : endVerse

  async function fetchVerseCount(chapter: number): Promise<number> {
    if (verseCountCache[chapter] != null) return verseCountCache[chapter]
    const url = `https://bible.helloao.org/api/BSB/${book.usfm}/${chapter}.json`
    try {
      const res = await fetch(url)
      if (!res.ok) return 1
      const data = (await res.json()) as { numberOfVerses?: number }
      const n = data.numberOfVerses ?? 1
      setVerseCountCache((prev) => ({ ...prev, [chapter]: n }))
      return n
    } catch {
      return 1
    }
  }

  React.useEffect(() => {
    let cancelled = false
    setLoadingChapter(currentChapter)
    fetchVerseCount(currentChapter).then(() => {
      if (!cancelled) setLoadingChapter(null)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.usfm, currentChapter])

  const currentVerseCount = verseCountCache[currentChapter] ?? 0

  function setChapter(n: number) {
    if (editing === "start") {
      setStartChapter(n)
      setStartVerse(1)
      // Keep end >= start
      if (endChapter < n || (endChapter === n && endVerse < 1)) {
        setEndChapter(n)
        setEndVerse(1)
      }
    } else {
      setEndChapter(n)
      setEndVerse(1)
      if (startChapter > n) {
        setStartChapter(n)
        setStartVerse(1)
      }
    }
  }

  function setVerse(n: number) {
    if (editing === "start") {
      setStartVerse(n)
      if (endChapter === startChapter && endVerse < n) setEndVerse(n)
    } else {
      if (endChapter < startChapter) {
        // User picked a smaller chapter earlier; nudge to valid.
        setEndChapter(startChapter)
      }
      setEndVerse(n)
    }
    // Auto-advance: after setting start, switch to editing end.
    if (editing === "start") setEditing("end")
  }

  function buildReference(): string {
    const sameChapter = startChapter === endChapter
    const sameVerse = sameChapter && startVerse === endVerse
    if (sameVerse) return `${book.name} ${startChapter}:${startVerse}`
    if (sameChapter)
      return `${book.name} ${startChapter}:${startVerse}-${endVerse}`
    return `${book.name} ${startChapter}:${startVerse}-${endChapter}:${endVerse}`
  }

  function confirm() {
    onSelect({
      book,
      startChapter,
      startVerse,
      endChapter,
      endVerse,
      reference: buildReference(),
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="pw-acrylic-tile flex items-center gap-2 rounded-xl p-2">
        <EndpointChip
          label="Start"
          chapter={startChapter}
          verse={startVerse}
          active={editing === "start"}
          onClick={() => setEditing("start")}
        />
        <span className="text-muted-foreground text-xs">→</span>
        <EndpointChip
          label="End"
          chapter={endChapter}
          verse={endVerse}
          active={editing === "end"}
          onClick={() => setEditing("end")}
        />
        <div className="ml-auto text-muted-foreground truncate text-xs">
          {buildReference()}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Panel title={`Chapter ${editing === "start" ? "(start)" : "(end)"}`}>
          <NumberGrid
            total={book.chapters}
            value={currentChapter}
            onPick={setChapter}
            // Highlight range of chapters included.
            rangeStart={startChapter}
            rangeEnd={endChapter}
            colWidth="min-w-[3ch]"
          />
        </Panel>
        <Panel
          title={`Verse ${editing === "start" ? "(start)" : "(end)"}`}
          subtitle={
            loadingChapter === currentChapter && currentVerseCount === 0
              ? "Loading verse count…"
              : currentVerseCount > 0
                ? `${currentVerseCount} verse${currentVerseCount === 1 ? "" : "s"} in chapter ${currentChapter}`
                : undefined
          }
        >
          {currentVerseCount > 0 ? (
            <NumberGrid
              total={currentVerseCount}
              value={currentVerse}
              onPick={setVerse}
              rangeStart={
                startChapter === currentChapter ? startVerse : undefined
              }
              rangeEnd={endChapter === currentChapter ? endVerse : undefined}
              colWidth="min-w-[2.5ch]"
            />
          ) : (
            <div className="text-muted-foreground p-4 text-center text-sm">
              …
            </div>
          )}
        </Panel>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Back to books
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing("start")}>
            Edit start
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing("end")}>
            Edit end
          </Button>
          <Button size="sm" onClick={confirm}>
            <Check data-icon="inline-start" />
            Use {buildReference()}
          </Button>
        </div>
      </div>
    </div>
  )
}

function EndpointChip({
  label,
  chapter,
  verse,
  active,
  onClick,
}: {
  label: string
  chapter: number
  verse: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-card hover:border-primary/40",
      )}
    >
      <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </span>
      <span className="font-mono font-medium tabular-nums">
        {chapter}:{verse}
      </span>
      <ChevronDown className="text-muted-foreground size-3" />
    </button>
  )
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="pw-acrylic-tile flex min-h-0 flex-col gap-2 rounded-xl p-3">
      <div className="flex items-baseline gap-2">
        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {title}
        </div>
        {subtitle ? (
          <div className="text-muted-foreground truncate text-[10px]">
            {subtitle}
          </div>
        ) : null}
      </div>
      <div className="max-h-[40vh] overflow-y-auto">{children}</div>
    </div>
  )
}

function NumberGrid({
  total,
  value,
  onPick,
  rangeStart,
  rangeEnd,
  colWidth = "min-w-[2.5ch]",
}: {
  total: number
  value: number
  onPick: (n: number) => void
  rangeStart?: number
  rangeEnd?: number
  colWidth?: string
}) {
  const nums = React.useMemo(
    () => Array.from({ length: total }, (_, i) => i + 1),
    [total],
  )
  return (
    <div
      className="grid gap-1"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(2.5rem, 1fr))",
      }}
    >
      {nums.map((n) => {
        const isSelected = n === value
        const inRange =
          rangeStart != null &&
          rangeEnd != null &&
          n >= rangeStart &&
          n <= rangeEnd
        const isEndpoint =
          rangeStart != null &&
          rangeEnd != null &&
          (n === rangeStart || n === rangeEnd)
        return (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            className={cn(
              "rounded-md py-1.5 text-center font-mono text-xs tabular-nums transition-colors",
              colWidth,
              isEndpoint
                ? "bg-primary text-primary-foreground font-semibold"
                : inRange
                  ? "bg-primary/15 text-foreground"
                  : isSelected
                    ? "bg-primary/10 text-foreground ring-primary/40 ring-1"
                    : "hover:bg-primary/10",
            )}
          >
            {n}
          </button>
        )
      })}
    </div>
  )
}
