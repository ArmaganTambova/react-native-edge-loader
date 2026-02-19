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
 * Builds an SVG path string for a circle.
 * Uses two semicircular arcs — SVG cannot represent a full circle with a single arc command.
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
 * Builds an SVG path string for a rounded rectangle.
 * Travels clockwise starting from the end of the top-left arc.
 * x, y is the top-left corner of the bounding box (not the arc center).
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
  const straightW = w - 2 * safeR;
  const straightH = h - 2 * safeR;
  return 2 * (straightW + straightH) + 2 * Math.PI * safeR;
}

/**
 * Given a detected Cutout and a padding value (in DIPs), returns the SVG PathSpec
 * needed to render the loading beam animation, or null if the cutout type does not
 * support an orbit animation.
 *
 * The SVG element should be positioned absolutely at (svgLeft, svgTop) with
 * (svgWidth, svgHeight) dimensions. A bleed margin is added around the cutout
 * so that the glow filter is not clipped at the SVG canvas edge.
 */
export function buildPathSpec(cutout: Cutout, padding: number): PathSpec | null {
  const { type, x, y, width, height } = cutout;

  if (
    type === 'none' ||
    x == null ||
    y == null ||
    width == null ||
    height == null
  ) {
    return null;
  }

  // Extra canvas margin beyond the stroke+glow area to prevent blur clipping
  const bleed = padding + 12;

  if (type === 'punch_hole') {
    const r = Math.max(width, height) / 2 + padding;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const svgLeft = cx - r - bleed;
    const svgTop = cy - r - bleed;
    const svgWidth = (r + bleed) * 2;
    const svgHeight = (r + bleed) * 2;

    return {
      pathD: buildCirclePath(cx, cy, r),
      perimeter: circlePerimeter(r),
      svgLeft,
      svgTop,
      svgWidth,
      svgHeight,
    };
  }

  if (type === 'island' || type === 'notch') {
    const padX = x - padding;
    const padY = y - padding;
    const padW = width + 2 * padding;
    const padH = height + 2 * padding;
    const r = Math.min((cutout.radius ?? 8) + padding, padW / 2, padH / 2);

    const svgLeft = padX - bleed;
    const svgTop = padY - bleed;
    const svgWidth = padW + 2 * bleed;
    const svgHeight = padH + 2 * bleed;

    return {
      pathD: buildRoundedRectPath(padX, padY, padW, padH, r),
      perimeter: roundedRectPerimeter(padW, padH, r),
      svgLeft,
      svgTop,
      svgWidth,
      svgHeight,
    };
  }

  return null;
}
