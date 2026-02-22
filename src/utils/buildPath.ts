import { Dimensions } from 'react-native';
import type { Cutout } from '../index';

export interface PathSpec {
  pathD: string;
  perimeter: number;
  svgLeft: number;
  svgTop: number;
  svgWidth: number;
  svgHeight: number;
}

/**
 * Builds an SVG circle path using LOCAL coordinates.
 * Uses two semicircular arcs (SVG cannot represent a full circle with one arc).
 * Starts from the rightmost point and travels clockwise.
 */
export function buildCirclePath(cx: number, cy: number, r: number): string {
  return [
    `M ${cx + r},${cy}`,
    `A ${r},${r} 0 1,1 ${cx - r},${cy}`,
    `A ${r},${r} 0 1,1 ${cx + r},${cy}`,
    'Z',
  ].join(' ');
}

export function circlePerimeter(r: number): number {
  return 2 * Math.PI * r;
}

/**
 * Builds an SVG rounded-rectangle path using LOCAL coordinates.
 * Travels clockwise starting from the end of the top-left arc.
 */
export function buildRoundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): string {
  const safeR = Math.min(r, w / 2, h / 2);
  return [
    `M ${x + safeR},${y}`,
    `L ${x + w - safeR},${y}`,
    `A ${safeR},${safeR} 0 0,1 ${x + w},${y + safeR}`,
    `L ${x + w},${y + h - safeR}`,
    `A ${safeR},${safeR} 0 0,1 ${x + w - safeR},${y + h}`,
    `L ${x + safeR},${y + h}`,
    `A ${safeR},${safeR} 0 0,1 ${x},${y + h - safeR}`,
    `L ${x},${y + safeR}`,
    `A ${safeR},${safeR} 0 0,1 ${x + safeR},${y}`,
    'Z',
  ].join(' ');
}

export function roundedRectPerimeter(w: number, h: number, r: number): number {
  const safeR = Math.min(r, w / 2, h / 2);
  return 2 * (w - 2 * safeR + (h - 2 * safeR)) + 2 * Math.PI * safeR;
}

/**
 * Builds the top-bar path for rectangular notch cutouts.
 * Goes: left edge → into notch (U-shape around 3 sides) → right edge.
 * All coordinates are LOCAL to the SVG canvas.
 */
function buildNotchBarPath(
  screenW: number,
  barY: number,
  cutoutLocalX: number,
  cutoutLocalY: number,
  cutoutW: number,
  cutoutH: number,
  padding: number,
  radius: number
): { pathD: string; perimeter: number } {
  const padX = cutoutLocalX - padding;
  const padY = cutoutLocalY - padding;
  const padW = cutoutW + 2 * padding;
  const padH = cutoutH + padding;
  const r = Math.min(radius + padding, padW / 2, padH / 2);

  const leftX = padX;
  const rightX = padX + padW;
  const bottomY = padY + padH;

  const pathD = [
    `M 0,${barY}`,
    `L ${leftX + r},${barY}`,
    `A ${r},${r} 0 0,1 ${leftX},${barY + r}`,
    `L ${leftX},${bottomY - r}`,
    `A ${r},${r} 0 0,0 ${leftX + r},${bottomY}`,
    `L ${rightX - r},${bottomY}`,
    `A ${r},${r} 0 0,0 ${rightX},${bottomY - r}`,
    `L ${rightX},${barY + r}`,
    `A ${r},${r} 0 0,1 ${rightX - r},${barY}`,
    `L ${screenW},${barY}`,
  ].join(' ');

  const cornerArc = (Math.PI / 2) * r;
  const notchPerimeter =
    cornerArc +
    (padH - r) +
    cornerArc +
    (padW - 2 * r) +
    cornerArc +
    (padH - r) +
    cornerArc;
  const perimeter = leftX + r + notchPerimeter + (screenW - (rightX - r));

  return { pathD, perimeter };
}

/**
 * Given a detected Cutout and padding, returns the SVG PathSpec for the beam animation.
 *
 * COORDINATE SYSTEM:
 * - svgLeft/svgTop: absolute screen position of the SVG element
 * - All path coordinates are LOCAL to the SVG (relative to its top-left corner)
 * - The SVG viewBox is always "0 0 svgWidth svgHeight"
 *
 * RENDER MODEL for punch_hole / island:
 * - Path traces the cutout shape at its EXACT edge (padding=0 means right on the border)
 * - The glow filter spreads OUTWARD from the stroke
 * - Result: inner crisp line + outer diffuse glow that radiates away from the glass
 *
 * ANIMATION CATEGORIES:
 * - Category 1 "Clear"  — 'none'      : horizontal beam across full screen top (ping-pong)
 * - Category 2 "Dot"    — 'punch_hole': circular orbit tracing the cutout glass edge
 *                       — 'island'    : rounded-rect orbit tracing the island glass edge
 *                       — 'teardrop'  : circular orbit (same as punch_hole, Dot category)
 * - Category 3 "Notch"  — 'notch'    : top-bar that wraps around the rectangular notch (ping-pong)
 */
export function buildPathSpec(
  cutout: Cutout,
  padding: number
): PathSpec | null {
  const { type, x, y, width, height } = cutout;
  const { width: screenW } = Dimensions.get('window');

  // Canvas margin so the glow filter is not clipped at the SVG edge.
  // For cutout-hugging types we need generous bleed since glow radiates outward.
  const bleed = 20;

  // ── 'none' ───────────────────────────────────────────────────────────────
  if (type === 'none') {
    const svgHeight = bleed * 2;
    const barY = bleed;
    return {
      pathD: `M 0,${barY} L ${screenW},${barY}`,
      perimeter: screenW,
      svgLeft: 0,
      svgTop: 0,
      svgWidth: screenW,
      svgHeight,
    };
  }

  if (x == null || y == null || width == null || height == null) {
    return null;
  }

  // ── 'punch_hole' ─────────────────────────────────────────────────────────
  // Path traces the cutout glass edge exactly (padding controls inset/outset).
  // Glow radiates outward from the stroke.
  if (type === 'punch_hole') {
    const r = Math.max(width, height) / 2 + padding;
    const cx = x + width / 2;
    const cy = y + height / 2;

    // Ensure SVG top is never negative
    const svgLeft = Math.max(0, cx - r - bleed);
    const svgTop = Math.max(0, cy - r - bleed);
    const svgWidth = (r + bleed) * 2;
    const svgHeight = (r + bleed) * 2;

    const localCx = cx - svgLeft;
    const localCy = cy - svgTop;

    return {
      pathD: buildCirclePath(localCx, localCy, r),
      perimeter: circlePerimeter(r),
      svgLeft,
      svgTop,
      svgWidth,
      svgHeight,
    };
  }

  // ── 'island' ─────────────────────────────────────────────────────────────
  if (type === 'island') {
    const padX = x - padding;
    const padY = y - padding;
    const padW = width + 2 * padding;
    const padH = height + 2 * padding;
    const r = Math.min((cutout.radius ?? 8) + padding, padW / 2, padH / 2);

    const svgLeft = Math.max(0, padX - bleed);
    const svgTop = Math.max(0, padY - bleed);
    const svgWidth = padW + 2 * bleed;
    const svgHeight = padH + 2 * bleed;

    const localX = padX - svgLeft;
    const localY = padY - svgTop;

    return {
      pathD: buildRoundedRectPath(localX, localY, padW, padH, r),
      perimeter: roundedRectPerimeter(padW, padH, r),
      svgLeft,
      svgTop,
      svgWidth,
      svgHeight,
    };
  }

  // ── 'teardrop' ───────────────────────────────────────────────────────────
  // Teardrop is in the "Dot" category: circular orbit just like punch_hole.
  // Uses the larger dimension as diameter so oval cutouts are fully enclosed.
  if (type === 'teardrop') {
    const r = Math.max(width, height) / 2 + padding;
    const cx = x + width / 2;
    const cy = y + height / 2;

    const svgLeft = Math.max(0, cx - r - bleed);
    const svgTop = Math.max(0, cy - r - bleed);
    const svgWidth = (r + bleed) * 2;
    const svgHeight = (r + bleed) * 2;

    const localCx = cx - svgLeft;
    const localCy = cy - svgTop;

    return {
      pathD: buildCirclePath(localCx, localCy, r),
      perimeter: circlePerimeter(r),
      svgLeft,
      svgTop,
      svgWidth,
      svgHeight,
    };
  }

  // ── 'notch' ──────────────────────────────────────────────────────────────
  if (type === 'notch') {
    const svgLeft = 0;
    const svgTop = 0;
    const svgWidth = screenW;
    const svgHeight = y + height + padding + bleed;

    const barY = bleed;
    const cutoutLocalX = x;
    const cutoutLocalY = y + bleed;
    const r = cutout.radius ?? 4;

    const { pathD, perimeter } = buildNotchBarPath(
      screenW,
      barY,
      cutoutLocalX,
      cutoutLocalY,
      width,
      height,
      padding,
      r
    );

    return { pathD, perimeter, svgLeft, svgTop, svgWidth, svgHeight };
  }

  return null;
}
