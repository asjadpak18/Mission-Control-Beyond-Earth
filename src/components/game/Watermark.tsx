/**
 * ============================================================================
 * WATERMARK — "Made by AI" label on all visuals
 * ============================================================================
 * A small, semi-transparent "Made by AI" text label positioned at the bottom
 * of every visual asset in the game (SVG simulations and image overlays).
 *
 * SVG variant: a <text> element dropped into any <svg> at the bottom-right.
 * CSS variant: an absolutely-positioned <div> overlaid on any image container.
 * ============================================================================
 */

import { cn } from "@/lib/utils";

interface SvgWatermarkProps {
  /** SVG width from the viewBox — used to position at the bottom-right. */
  width?: number;
  height?: number;
  /** Font size in SVG user units (default 7). */
  fontSize?: number;
}

/** SVG watermark — place inside any <svg> element, renders at the bottom. */
export function SvgWatermark({ width = 300, height = 250, fontSize = 7 }: SvgWatermarkProps) {
  return (
    <text
      x={width - 4}
      y={height - 4}
      textAnchor="end"
      fontSize={fontSize}
      fill="#8fb4d6"
      opacity="0.35"
      fontFamily="monospace"
      fontWeight="bold"
      letterSpacing="0.5"
    >
      Made by AI
    </text>
  );
}

interface ImageWatermarkProps {
  className?: string;
}

/** CSS watermark — overlay on any image container (must be position: relative). */
export function ImageWatermark({ className }: ImageWatermarkProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-1 right-1 rounded bg-black/40 px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-wide text-cyan-200/50 backdrop-blur-sm",
        className,
      )}
      aria-hidden="true"
    >
      Made by AI
    </div>
  );
}
