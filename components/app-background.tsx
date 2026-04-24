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
  // Darker palette in both modes — more saturated, moodier.
  const color: [number, number, number] = isDark
    ? [0.22, 0.15, 0.5]
    : [0.65, 0.7, 0.9]
  const amplitude = 0.05
  const speed = 0.18

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Blurred iridescent shader. Negative inset keeps the CSS blur
       * from showing hard edges where it would fade to transparent. */}
      <div
        className="absolute -inset-10"
        style={{
          filter: "blur(20px)",
          opacity: isDark ? 1 : 0.9,
        }}
      >
        <Iridescence
          color={color}
          speed={speed}
          amplitude={amplitude}
          mouseReact={false}
        />
      </div>
      {/* Base SVG noise grain on top of the blurred shader for texture.
       * Dark mode gets lightish flecks (0.9); light mode gets black
       * grain so the noise is actually visible on the pastel shader. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: isDark
            ? "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='480' height='480' viewBox='0 0 480 480'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.9  0 0 0 0 0.9  0 0 0 0 0.9  0 0 0 1 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")"
            : "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='480' height='480' viewBox='0 0 480 480'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          backgroundSize: "480px 480px",
          opacity: isDark ? 0.11 : 0.18,
        }}
      />
    </div>
  )
}
