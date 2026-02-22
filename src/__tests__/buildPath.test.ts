import { buildPathSpec } from '../utils/buildPath';

// Mock Dimensions
jest.mock('react-native', () => ({
  Dimensions: {
    get: jest.fn().mockReturnValue({ width: 360, height: 800 }),
  },
}));

describe('buildPathSpec', () => {
  it('generates a Notch path correctly (Top Detour)', () => {
    const cutout = {
      type: 'notch' as const,
      x: 100,
      y: 0,
      width: 160,
      height: 30,
      radius: 10,
    };
    const padding = 0;
    const spec = buildPathSpec(cutout, padding);

    expect(spec).not.toBeNull();
    if (!spec) return;

    expect(spec.svgWidth).toBe(360); // Full width
    expect(spec.pathD).toContain('M 0,0'); // Starts top-left
    expect(spec.pathD).toContain('L 360,0'); // Ends top-right (roughly)

    // Mask check: Should be closed loop below the line
    expect(spec.maskD).toContain(spec.pathD);
    expect(spec.maskD).toContain('L 360,');
    expect(spec.maskFillRule).toBe('nonzero');
  });

  it('generates an Island path correctly (Orbit)', () => {
    const cutout = {
      type: 'island' as const,
      x: 120,
      y: 10,
      width: 120,
      height: 40,
      radius: 20,
    };
    const padding = 5;
    const spec = buildPathSpec(cutout, padding);

    expect(spec).not.toBeNull();
    if (!spec) return;

    // Localized SVG
    expect(spec.svgLeft).toBeLessThan(120);
    expect(spec.svgWidth).toBeGreaterThan(120);

    // Mask check: Outer Rect + Inner Path
    expect(spec.maskFillRule).toBe('evenodd');
    expect(spec.maskD).toContain('M 0,0'); // Outer rect start
  });

  it('generates a None path correctly (Straight Line)', () => {
    const cutout = { type: 'none' as const };
    const spec = buildPathSpec(cutout, 0);

    expect(spec).not.toBeNull();
    if (!spec) return;

    expect(spec.pathD).toBe('M 0,0 L 360,0');
    expect(spec.maskFillRule).toBe('nonzero');
  });
});
