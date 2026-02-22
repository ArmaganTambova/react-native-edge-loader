import { Dimensions } from 'react-native';
import type { Cutout } from '../index';

export interface PathSpec {
  pathD: string;
  maskD: string;
  maskFillRule: 'nonzero' | 'evenodd';
  perimeter: number;
  svgLeft: number;
  svgTop: number;
  svgWidth: number;
  svgHeight: number;
}

const { width: SCREEN_W } = Dimensions.get('window');
// A generous bleed for the glow filter so it doesn't get clipped by the canvas
const BLEED = 40;

/**
 * Helper to build a circle path in local coordinates.
 */
function buildCirclePath(cx: number, cy: number, r: number): string {
  // Two arcs to form a full circle
  return [
    `M ${cx + r},${cy}`,
    `A ${r},${r} 0 1,1 ${cx - r},${cy}`,
    `A ${r},${r} 0 1,1 ${cx + r},${cy}`,
    'Z',
  ].join(' ');
}

function circlePerimeter(r: number): number {
  return 2 * Math.PI * r;
}

/**
 * Helper to build a rounded rectangle path in local coordinates.
 */
function buildRoundedRectPath(
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

function roundedRectPerimeter(w: number, h: number, r: number): number {
  const safeR = Math.min(r, w / 2, h / 2);
  return 2 * (w - 2 * safeR + (h - 2 * safeR)) + 2 * Math.PI * safeR;
}

/**
 * Builds the path and mask for a Notch (Detour) animation.
 * The path runs from (0, y) to (screenW, y), detouring around the notch.
 */
function buildNotchSpec(cutout: Cutout, padding: number): PathSpec {
  // If no cutout or it's just 'none', treat as a straight line at top
  if (cutout.type === 'none') {
    const barY = padding;
    const pathD = `M 0,${barY} L ${SCREEN_W},${barY}`;
    // Mask: Everything below the line
    const maskD = `M 0,${barY} L ${SCREEN_W},${barY} L ${SCREEN_W},${
      BLEED * 2
    } L 0,${BLEED * 2} Z`;

    return {
      pathD,
      maskD,
      maskFillRule: 'nonzero',
      perimeter: SCREEN_W,
      svgLeft: 0,
      svgTop: 0,
      svgWidth: SCREEN_W,
      svgHeight: BLEED * 2,
    };
  }

  // Real Notch
  // Coordinates relative to screen (0,0)
  const x = cutout.x ?? (SCREEN_W - (cutout.width ?? 0)) / 2;
  const w = cutout.width ?? 0;
  const h = cutout.height ?? 0;
  const r = cutout.radius ?? 0;

  // The "line" normally sits at y = padding.
  // The notch pushes it down.
  // We assume the notch is at the top edge.
  // Path Segments:
  // 1. Line from (0, padding) to start of notch detour.
  // 2. Detour around notch.
  // 3. Line to (SCREEN_W, padding).

  const baseY = padding;
  const padX = x - padding;
  // const padY = y - padding; // Not really used for top notch, we use y + h + padding
  const padW = w + 2 * padding;
  const padH = h + padding; // height from top 0

  // Radius for corners
  // If radius provided, use it, else default.
  const cornerR = r > 0 ? r + padding : Math.min(20, padH / 2);

  // Points
  const leftX = Math.max(0, padX);
  const rightX = Math.min(SCREEN_W, padX + padW);
  const bottomY = padH;

  // Ensure leftX/rightX don't cross
  const safeLeftX = Math.min(leftX, rightX);
  const safeRightX = Math.max(leftX, rightX);

  const pathOps = [];
  // Start
  pathOps.push(`M 0,${baseY}`);

  // If there is space before the notch
  if (safeLeftX > 0) {
    pathOps.push(`L ${safeLeftX - cornerR},${baseY}`);
    // Corner into the notch
    pathOps.push(
      `A ${cornerR},${cornerR} 0 0,1 ${safeLeftX},${baseY + cornerR}`
    );
  } else {
    // Notch starts at or before screen left edge
    pathOps.push(`M ${safeLeftX},${baseY + cornerR}`); // Move to start of vertical
  }

  // Down to bottom corner
  pathOps.push(`L ${safeLeftX},${bottomY - cornerR}`);
  // Bottom-Left Corner
  pathOps.push(
    `A ${cornerR},${cornerR} 0 0,0 ${safeLeftX + cornerR},${bottomY}`
  );
  // Bottom Edge
  pathOps.push(`L ${safeRightX - cornerR},${bottomY}`);
  // Bottom-Right Corner
  pathOps.push(
    `A ${cornerR},${cornerR} 0 0,0 ${safeRightX},${bottomY - cornerR}`
  );
  // Up to top corner
  pathOps.push(`L ${safeRightX},${baseY + cornerR}`);
  // Corner out of notch
  pathOps.push(
    `A ${cornerR},${cornerR} 0 0,1 ${safeRightX + cornerR},${baseY}`
  );

  // End line
  pathOps.push(`L ${SCREEN_W},${baseY}`);

  const pathD = pathOps.join(' ');

  // Calculate approximate perimeter
  // 2 * corner arc (90deg) * 4 corners = 2 * PI * r
  // + vertical sides + horizontal bottom + horizontal top segments
  const perimeter =
    SCREEN_W + // approximate width
    2 * (bottomY - baseY) + // down and up
    (padW - w); // expansion difference? rough calc is fine for animation speed

  // Mask: The Path + Box downwards to capture the glow
  // We construct a shape that follows the path, then goes down to max height, then back left, then close.
  // The pathD already traces the top edge of our "glow area".
  // We need to reverse it or just append the bottom box.
  // Actually pathD goes Left -> Right.
  // So append Right-Bottom -> Left-Bottom -> Close.

  const svgHeight = Math.max(bottomY + BLEED, BLEED * 2);

  const maskD = [
    pathD,
    `L ${SCREEN_W},${svgHeight}`,
    `L 0,${svgHeight}`,
    'Z',
  ].join(' ');

  return {
    pathD,
    maskD,
    maskFillRule: 'nonzero',
    perimeter: perimeter, // Used for strokeDasharray
    svgLeft: 0,
    svgTop: 0,
    svgWidth: SCREEN_W,
    svgHeight,
  };
}

/**
 * Builds the path and mask for an Island/PunchHole (Orbit) animation.
 */
function buildIslandSpec(cutout: Cutout, padding: number): PathSpec {
  const x = cutout.x ?? (SCREEN_W - (cutout.width ?? 100)) / 2;
  const y = cutout.y ?? 20;
  const w = cutout.width ?? 0;
  const h = cutout.height ?? 0;
  const r = cutout.radius ?? Math.min(w, h) / 2;

  // Determine geometry: Circle or RoundedRect?
  // If w is close to h, treat as circle
  const isCircle = Math.abs(w - h) < 2;

  // Expand by padding
  const padX = x - padding;
  const padY = y - padding;
  const padW = w + 2 * padding;
  const padH = h + 2 * padding;
  const padR = r + padding;

  // Local coordinates for SVG
  const svgLeft = padX - BLEED;
  const svgTop = padY - BLEED;
  const svgWidth = padW + 2 * BLEED;
  const svgHeight = padH + 2 * BLEED;

  const localX = padX - svgLeft;
  const localY = padY - svgTop;

  let pathD = '';
  let perimeter = 0;

  if (isCircle) {
    const radius = Math.max(padW, padH) / 2;
    const cx = localX + padW / 2;
    const cy = localY + padH / 2;
    pathD = buildCirclePath(cx, cy, radius);
    perimeter = circlePerimeter(radius);
  } else {
    pathD = buildRoundedRectPath(localX, localY, padW, padH, padR);
    perimeter = roundedRectPerimeter(padW, padH, padR);
  }

  // Mask:
  // We want to KEEP the area OUTSIDE the shape (where glow is), but inside the canvas.
  // So Mask = Rect(Canvas) - Shape(Hole).
  // Use EvenOdd rule.
  // Outer Rect (Canvas)
  const outerRect = `M 0,0 H ${svgWidth} V ${svgHeight} H 0 Z`;

  // Combine: Outer + Path. EvenOdd will subtract Path from Outer.
  const maskD = `${outerRect} ${pathD}`;

  return {
    pathD,
    maskD,
    maskFillRule: 'evenodd',
    perimeter,
    svgLeft,
    svgTop,
    svgWidth,
    svgHeight,
  };
}

export function buildPathSpec(
  cutout: Cutout,
  padding: number
): PathSpec | null {
  if (cutout.type === 'notch' || cutout.type === 'none') {
    return buildNotchSpec(cutout, padding);
  }

  // islands, punch_holes, teardrops -> Orbit
  return buildIslandSpec(cutout, padding);
}
