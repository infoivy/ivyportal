import { useEffect, useRef } from "react";

/**
 * A cozy dithered fireplace for the Gathering Hub — the classic Doom-fire
 * cellular automaton on a tiny buffer, upscaled with pixelated rendering so it
 * reads like the dither charts. Renders one static frame under
 * prefers-reduced-motion and pauses entirely while the tab is hidden.
 */

const W = 96;
const H = 56;

// Ember ramp: transparent → deep red → orange → yellow → near-white.
const RAMP: [number, number, number, number][] = [
  [0, 0, 0, 0],
  [24, 8, 4, 60],
  [68, 16, 5, 150],
  [107, 27, 6, 220],
  [155, 51, 10, 255],
  [199, 81, 16, 255],
  [223, 116, 26, 255],
  [239, 153, 42, 255],
  [247, 189, 71, 255],
  [253, 222, 118, 255],
  [255, 244, 181, 255],
  [255, 255, 235, 255],
];

export function DitherFireplace({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = W;
    canvas.height = H;

    const heat = new Uint8Array(W * H);
    // Seed the hearth row at max heat.
    for (let x = 0; x < W; x++) heat[(H - 1) * W + x] = RAMP.length - 1;

    const img = ctx.createImageData(W, H);

    const step = () => {
      for (let y = 0; y < H - 1; y++) {
        for (let x = 0; x < W; x++) {
          const below = (y + 1) * W + x;
          const drift = (Math.random() * 3) | 0; // 0..2 sideways drift
          const decay = Math.random() > 0.55 ? 1 : 0;
          const dst = y * W + Math.min(W - 1, Math.max(0, x - 1 + drift));
          heat[dst] = Math.max(0, heat[below] - decay);
        }
      }
      // Breathe the hearth so the flame height wanders.
      for (let x = 0; x < W; x++) {
        const flicker = Math.random() > 0.97 ? ((Math.random() * 3) | 0) : 0;
        heat[(H - 1) * W + x] = RAMP.length - 1 - flicker;
      }
      for (let i = 0; i < heat.length; i++) {
        const [r, g, b, a] = RAMP[heat[i]];
        img.data[i * 4] = r;
        img.data[i * 4 + 1] = g;
        img.data[i * 4 + 2] = b;
        img.data[i * 4 + 3] = a;
      }
      ctx.putImageData(img, 0, 0);
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      for (let i = 0; i < H; i++) step(); // settle into one calm frame
      return;
    }

    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 66) return; // ~15fps — flames read better slow
      last = t;
      step();
    };
    raf = requestAnimationFrame(loop);

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ imageRendering: "pixelated", width: "100%", height: "100%" }}
    />
  );
}
