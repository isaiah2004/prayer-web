"use client"

import * as React from "react"
import { Check, Copy, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function CopyCode({
  code,
  className,
}: {
  code: string
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)
  const [shareOk, setShareOk] = React.useState<boolean | null>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : ""
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "Prayer space",
          text: `Join my prayer space with code ${code}`,
          url,
        })
        setShareOk(true)
        return
      } catch {
        setShareOk(false)
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setShareOk(true)
      setTimeout(() => setShareOk(null), 1500)
    } catch {
      setShareOk(false)
    }
  }

  return (
    <div
      className={cn(
        "bg-card flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-col">
        <span className="text-muted-foreground text-xs">Space code</span>
        <span className="font-mono text-2xl font-semibold tracking-widest">
          {code}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={copy}
          aria-label="Copy code"
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={share}
          aria-label="Share"
          title={shareOk === true ? "Link copied" : "Share"}
        >
          <Share2 />
          Share
        </Button>
      </div>
    </div>
  )
}
