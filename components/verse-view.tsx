"use client"

import * as React from "react"
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels"
import {
  BookOpen,
  ChevronDown,
  Columns2,
  Columns3,
  EyeOff,
  LayoutDashboard,
  Megaphone,
  Plus,
  Rows2,
  Search,
  Sparkles,
  Square,
  Trash2,
  Users,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { PanelKind, VerseSelection, ViewLayout } from "@/lib/types"
import { VersePanel } from "@/components/verse-panel"
import { ThemeToggle } from "@/components/theme-toggle"
import { VersePicker } from "@/components/verse-picker"
import {
  FEATURED_COMMENTARIES,
  FEATURED_TRANSLATIONS,
} from "@/lib/bible/api"
import { parseReference } from "@/lib/bible/books"
import {
  setVerseAction,
  clearVerseAction,
  requestPresenterAction,
} from "@/app/actions"

export type SyncMode = "follow" | "free"

const LAYOUT_PRESETS: ViewLayout[] = [
  {
    id: "solo",
    name: "Solo",
    panels: [{ kind: "translation", translationId: "BSB" }],
  },
  {
    id: "compare",
    name: "Compare",
    panels: [
      { kind: "translation", translationId: "BSB" },
      { kind: "translation", translationId: "ENGWEBP" },
    ],
  },
  {
    id: "study",
    name: "Study",
    panels: [
      { kind: "translation", translationId: "BSB" },
      { kind: "commentary", commentaryId: "matthew-henry" },
      { kind: "original" },
    ],
  },
  {
    id: "original-focus",
    name: "Originals",
    panels: [
      { kind: "original" },
      { kind: "translation", translationId: "BSB" },
    ],
  },
]

function layoutWithCurrentTranslation(
  preset: ViewLayout,
  translationId: string,
): ViewLayout {
  return {
    ...preset,
    panels: preset.panels.map((p) =>
      p.kind === "translation" && p === preset.panels[0]
        ? { kind: "translation", translationId }
        : p,
    ),
  }
}

type Props = {
  open: boolean
  code: string
  spaceVerse: VerseSelection | null
  myId: string | null
  adminToken: string | null
  versePresenterId: string | null
  onClose: () => void
  onChange?: () => void
}

const SYNC_KEY = (code: string) => `prayer-web:verse-sync:${code}`
const LAYOUT_KEY = (code: string) => `prayer-web:verse-layout:${code}`
const LOCAL_VERSE_KEY = (code: string) => `prayer-web:verse-local:${code}`
const TRANSLATION_KEY = "prayer-web:last-translation"
const COMMENTARY_KEY = "prayer-web:last-commentary"

export function VerseView({
  open,
  code,
  spaceVerse,
  myId,
  adminToken,
  versePresenterId,
  onClose,
  onChange,
}: Props) {
  const isAdmin = !!adminToken
  const isPresenter = !!myId && myId === versePresenterId
  const canSet = isAdmin || isPresenter
  const [syncMode, setSyncMode] = React.useState<SyncMode>("follow")
  const [customLayout, setCustomLayout] = React.useState<ViewLayout | null>(null)
  const [localVerse, setLocalVerse] = React.useState<VerseSelection | null>(null)
  const [translationId, setTranslationId] = React.useState("BSB")
  const [commentaryId, setCommentaryId] = React.useState("matthew-henry")
  const [referenceInput, setReferenceInput] = React.useState("")
  const [publishing, setPublishing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    try {
      const m = localStorage.getItem(SYNC_KEY(code))
      if (m === "follow" || m === "free") setSyncMode(m)
      const ls = localStorage.getItem(LAYOUT_KEY(code))
      if (ls) setCustomLayout(JSON.parse(ls))
      const lv = localStorage.getItem(LOCAL_VERSE_KEY(code))
      if (lv) setLocalVerse(JSON.parse(lv))
      const t = localStorage.getItem(TRANSLATION_KEY)
      if (t) setTranslationId(t)
      const c = localStorage.getItem(COMMENTARY_KEY)
      if (c) setCommentaryId(c)
    } catch {
      /* ignore */
    }
  }, [open, code])

  React.useEffect(() => {
    try {
      localStorage.setItem(SYNC_KEY(code), syncMode)
    } catch {}
  }, [code, syncMode])

  React.useEffect(() => {
    try {
      if (customLayout)
        localStorage.setItem(LAYOUT_KEY(code), JSON.stringify(customLayout))
    } catch {}
  }, [code, customLayout])

  React.useEffect(() => {
    try {
      if (localVerse)
        localStorage.setItem(LOCAL_VERSE_KEY(code), JSON.stringify(localVerse))
    } catch {}
  }, [code, localVerse])

  React.useEffect(() => {
    try {
      localStorage.setItem(TRANSLATION_KEY, translationId)
    } catch {}
  }, [translationId])

  React.useEffect(() => {
    try {
      localStorage.setItem(COMMENTARY_KEY, commentaryId)
    } catch {}
  }, [commentaryId])

  React.useEffect(() => {
    if (spaceVerse) setReferenceInput(spaceVerse.reference)
  }, [spaceVerse?.reference])

  const effectiveLayout: ViewLayout = React.useMemo(() => {
    if (syncMode === "follow" && spaceVerse) return spaceVerse.layout
    if (customLayout) return customLayout
    return layoutWithCurrentTranslation(LAYOUT_PRESETS[2], translationId)
  }, [syncMode, spaceVerse, customLayout, translationId])

  const effectiveVerse: VerseSelection | null = React.useMemo(() => {
    if (syncMode === "free") return localVerse
    return spaceVerse
  }, [syncMode, spaceVerse, localVerse])

  async function publishReference(reference: string) {
    setError(null)
    if (!canSet) {
      setError(
        "Only the admin or the current presenter can set the verse.",
      )
      return
    }
    setPublishing(true)
    try {
      const result = await setVerseAction(code, {
        reference,
        translationId,
        commentaryId,
        layout: customLayout ?? effectiveLayout,
        adminToken,
        callerId: myId,
      })
      if (!result.ok) {
        setError(result.error ?? "Failed to set verse")
        return
      }
      onChange?.()
    } finally {
      setPublishing(false)
    }
  }

  async function publishToSpace() {
    await publishReference(referenceInput)
  }

  function setLocallyFreeWithReference(reference: string) {
    setError(null)
    const parsed = parseReference(reference)
    if (!parsed) {
      setError('Could not parse reference. Try "John 3:16" or "Psalm 23".')
      return
    }
    const layout = customLayout ?? effectiveLayout
    setLocalVerse({
      reference: parsed.canonical,
      book: parsed.book.usfm,
      chapter: parsed.chapter,
      verseStart: parsed.verseStart,
      verseEnd: parsed.verseEnd,
      translationId,
      commentaryId,
      layout,
      updatedAt: Date.now(),
    })
  }

  async function setLocallyFree() {
    setError(null)
    const parsed = parseReference(referenceInput)
    if (!parsed) {
      setError('Could not parse reference. Try "John 3:16" or "Psalm 23".')
      return
    }
    const layout = customLayout ?? effectiveLayout
    setLocalVerse({
      reference: parsed.canonical,
      book: parsed.book.usfm,
      chapter: parsed.chapter,
      verseStart: parsed.verseStart,
      verseEnd: parsed.verseEnd,
      translationId,
      commentaryId,
      layout,
      updatedAt: Date.now(),
    })
  }

  function applyPreset(preset: ViewLayout) {
    const next = layoutWithCurrentTranslation(preset, translationId)
    setCustomLayout(next)
  }

  function addPanel(kind: PanelKind) {
    const base: ViewLayout =
      customLayout ??
      layoutWithCurrentTranslation(LAYOUT_PRESETS[2], translationId)
    if (base.panels.length >= 4) return
    setCustomLayout({
      ...base,
      id: "custom",
      name: "Custom",
      panels: [...base.panels, kind],
    })
  }

  function removePanel(idx: number) {
    const base =
      customLayout ??
      layoutWithCurrentTranslation(LAYOUT_PRESETS[2], translationId)
    const next = base.panels.filter((_, i) => i !== idx)
    if (next.length === 0) return
    setCustomLayout({ ...base, id: "custom", name: "Custom", panels: next })
  }

  function changePanel(idx: number, panel: PanelKind) {
    const base =
      customLayout ??
      layoutWithCurrentTranslation(LAYOUT_PRESETS[2], translationId)
    const next = [...base.panels]
    next[idx] = panel
    setCustomLayout({ ...base, id: "custom", name: "Custom", panels: next })
  }

  if (!open) return null

  return (
    <div
      className="bg-background fixed inset-0 z-40 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Verse view"
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <BookOpen className="text-primary size-4" />
          <span className="text-sm font-medium">Verse View</span>
        </div>

        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (syncMode === "free") void setLocallyFree()
            else void publishToSpace()
          }}
        >
          <div className="relative flex-1 min-w-[180px] max-w-md">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
            <Input
              value={referenceInput}
              onChange={(e) => setReferenceInput(e.target.value)}
              placeholder='e.g. "John 3:16" or "Psalm 23:1-6"'
              className="pl-8 pr-9"
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setPickerOpen(true)}
              aria-label="Open verse picker"
              title="Open verse picker"
              className="absolute top-1/2 right-0.5 -translate-y-1/2"
            >
              <Sparkles />
            </Button>
          </div>
          <SelectInline
            value={translationId}
            onChange={setTranslationId}
            options={FEATURED_TRANSLATIONS.filter(
              (t) => t.language === "eng",
            ).map((t) => ({
              value: t.id,
              label: t.shortName,
            }))}
            ariaLabel="Translation"
          />
          <SelectInline
            value={commentaryId}
            onChange={setCommentaryId}
            options={FEATURED_COMMENTARIES.map((c) => ({
              value: c.id,
              label: c.name,
            }))}
            ariaLabel="Commentary"
          />
          {syncMode === "free" ? (
            <Button type="submit" size="sm" variant="secondary">
              Set locally
            </Button>
          ) : canSet ? (
            <Button type="submit" size="sm" disabled={publishing}>
              <Megaphone data-icon="inline-start" />
              {publishing ? "Setting…" : "Set for everyone"}
            </Button>
          ) : (
            <AskForFloor code={code} myId={myId} onChange={onChange} />
          )}
        </form>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close verse view"
          >
            <X />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <div className="text-muted-foreground mr-1 text-xs">Sync:</div>
        <SyncButton
          active={syncMode === "follow"}
          onClick={() => setSyncMode("follow")}
          icon={<Users className="size-3.5" />}
          label="Follow pilot"
          hint="Shared verse + layout"
        />
        <SyncButton
          active={syncMode === "free"}
          onClick={() => setSyncMode("free")}
          icon={<EyeOff className="size-3.5" />}
          label="Free explore"
          hint="My own verse, my own layout"
        />
        <div className="bg-border mx-2 h-5 w-px" />
        <div className="text-muted-foreground mr-1 text-xs">Layout:</div>
        {LAYOUT_PRESETS.map((p) => (
          <Button
            key={p.id}
            size="xs"
            variant={effectiveLayout.id === p.id ? "secondary" : "ghost"}
            onClick={() => applyPreset(p)}
            disabled={syncMode === "follow"}
            title={p.name}
          >
            {p.id === "solo" && <Square />}
            {p.id === "compare" && <Columns2 />}
            {p.id === "study" && <Columns3 />}
            {p.id === "original-focus" && <Rows2 />}
            {p.name}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {spaceVerse ? (
            <>
              <span className="text-muted-foreground text-xs">
                Pilot&apos;s verse:{" "}
                <span className="text-foreground font-medium">
                  {spaceVerse.reference}
                </span>
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={async () => {
                  await clearVerseAction(code, {
                    adminToken,
                    callerId: myId,
                  })
                  onChange?.()
                }}
              >
                Clear
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground text-xs">
              No pilot&apos;s verse yet.
            </span>
          )}
        </div>
      </div>

      {error ? (
        <div className="text-destructive border-b px-4 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden p-3">
        <LayoutRenderer
          layout={effectiveLayout}
          verse={effectiveVerse}
          editable={syncMode !== "follow"}
          onRemovePanel={removePanel}
          onChangePanel={changePanel}
        />
        {syncMode !== "follow" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs">Add panel:</span>
            <Button
              size="xs"
              variant="outline"
              onClick={() => addPanel({ kind: "translation", translationId })}
            >
              <Plus data-icon="inline-start" />
              Translation
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                addPanel({ kind: "commentary", commentaryId })
              }
            >
              <Plus data-icon="inline-start" />
              Commentary
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => addPanel({ kind: "original" })}
            >
              <Plus data-icon="inline-start" />
              Hebrew / Greek
            </Button>
          </div>
        ) : null}
      </div>

      <VersePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(sel) => {
          setReferenceInput(sel.reference)
          setPickerOpen(false)
          if (syncMode === "free") {
            setLocallyFreeWithReference(sel.reference)
          } else if (canSet) {
            void publishReference(sel.reference)
          }
        }}
      />
    </div>
  )
}

function AskForFloor({
  code,
  myId,
  onChange,
}: {
  code: string
  myId: string | null
  onChange?: () => void
}) {
  const [asked, setAsked] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  async function ask() {
    if (!myId) return
    setPending(true)
    try {
      const result = await requestPresenterAction(code, myId)
      if (result.ok) setAsked(true)
      onChange?.()
    } finally {
      setPending(false)
    }
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={ask}
      disabled={pending || !myId || asked}
      title={
        !myId
          ? "Add yourself to the space first"
          : asked
            ? "Request sent — waiting for admin"
            : "Ask admin for the floor"
      }
    >
      <Megaphone data-icon="inline-start" />
      {asked ? "Waiting…" : "Ask for floor"}
    </Button>
  )
}

function LayoutRenderer({
  layout,
  verse,
  editable,
  onRemovePanel,
  onChangePanel,
}: {
  layout: ViewLayout
  verse: VerseSelection | null
  editable: boolean
  onRemovePanel: (idx: number) => void
  onChangePanel: (idx: number, panel: PanelKind) => void
}) {
  const n = layout.panels.length
  if (n === 0) return null
  return (
    <PanelGroup
      orientation="horizontal"
      className="flex h-full w-full"
      key={`${layout.id}-${n}`}
    >
      {layout.panels.map((panel, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 ? (
            <PanelResizeHandle
              className={cn(
                "group/sep relative mx-0.5 flex w-2 shrink-0 cursor-col-resize items-center justify-center",
                "data-[separator=active]:bg-primary/10",
                "focus-visible:ring-primary/30 focus-visible:ring-2 focus-visible:outline-none",
              )}
            >
              <span className="bg-border group-hover/sep:bg-primary/50 group-data-[separator=active]/sep:bg-primary h-12 w-0.5 rounded-full transition-colors" />
            </PanelResizeHandle>
          ) : null}
          <Panel
            minSize={15}
            defaultSize={100 / n}
            className="flex h-full flex-col"
          >
            <div className="relative h-full">
              {editable ? (
                <div className="absolute top-1 right-1 z-10 flex items-center gap-1">
                  <PanelKindSelect
                    panel={panel}
                    onChange={(p) => onChangePanel(idx, p)}
                  />
                  {n > 1 ? (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => onRemovePanel(idx)}
                      aria-label="Remove panel"
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <VersePanel kind={panel} verse={verse} className="h-full" />
            </div>
          </Panel>
        </React.Fragment>
      ))}
    </PanelGroup>
  )
}

function PanelKindSelect({
  panel,
  onChange,
}: {
  panel: PanelKind
  onChange: (p: PanelKind) => void
}) {
  const value =
    panel.kind === "translation"
      ? `t:${panel.translationId}`
      : panel.kind === "commentary"
        ? `c:${panel.commentaryId}`
        : "o"

  function handle(val: string) {
    if (val === "o") onChange({ kind: "original" })
    else if (val.startsWith("t:"))
      onChange({ kind: "translation", translationId: val.slice(2) })
    else if (val.startsWith("c:"))
      onChange({ kind: "commentary", commentaryId: val.slice(2) })
  }

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => handle(e.target.value)}
        className="bg-card border-input h-6 appearance-none rounded-md border pr-6 pl-2 text-xs font-medium"
      >
        <optgroup label="Translations">
          {FEATURED_TRANSLATIONS.filter((t) => t.language === "eng").map(
            (t) => (
              <option key={t.id} value={`t:${t.id}`}>
                {t.shortName}
              </option>
            ),
          )}
        </optgroup>
        <optgroup label="Original language">
          <option value="o">Hebrew / Greek</option>
        </optgroup>
        <optgroup label="Commentary">
          {FEATURED_COMMENTARIES.map((c) => (
            <option key={c.id} value={`c:${c.id}`}>
              {c.name}
            </option>
          ))}
        </optgroup>
      </select>
      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1 size-3 -translate-y-1/2" />
    </div>
  )
}

function SyncButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  hint: string
}) {
  return (
    <Button
      size="xs"
      variant={active ? "secondary" : "ghost"}
      onClick={onClick}
      title={hint}
      aria-pressed={active}
    >
      {icon}
      <span>{label}</span>
    </Button>
  )
}

function SelectInline({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  ariaLabel: string
}) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "bg-background border-input h-9 appearance-none rounded-md border pr-7 pl-3 text-sm font-medium",
          "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px] focus-visible:outline-none",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2" />
    </div>
  )
}
