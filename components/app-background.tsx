"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import Iridescence from "@/components/Iridescence"

/**
 * Full-viewport iridescent background. Uses different color/amplitude
 * presets for light and dark mode so text stays readable under the
 * acrylic surfaces that sit on top of it.
 */
export function AppBackground() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  if (!mounted) {
    // Server-render a neutral colored placeholder so there's no flash.
    return (
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-indigo-50 via-violet-50 to-pink-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950"
      />
    )
  }

  const isDark = resolvedTheme === "dark"
  // Light mode: soft pastels — hues are still visible but never dominant
  // so acrylic surfaces stay legible over them.
  // Dark mode: deeper indigo/violet so the surfaces have actual color to
  // blur rather than flat black.
  const color: [number, number, number] = isDark
    ? [0.45, 0.35, 0.78]
    : [0.85, 0.9, 1.0]
  const amplitude = 0.05
  const speed = 0.35

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        // Slight opacity dampening in light mode so text stays high-contrast
        opacity: isDark ? 1 : 0.85,
      }}
    >
      <Iridescence
        color={color}
        speed={speed}
        amplitude={amplitude}
        mouseReact={false}
      />
    </div>
  )
}
