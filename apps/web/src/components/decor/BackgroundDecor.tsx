'use client';

import { Pizza, Sandwich, Bike, CupSoda, Package, Star, IceCreamCone, Coffee, Circle } from 'lucide-react';

const ITEMS: { Icon: typeof Pizza; top: string; left: string; size: number; rotate: number }[] = [
  { Icon: Pizza, top: '3%', left: '4%', size: 30, rotate: -12 },
  { Icon: Star, top: '8%', left: '90%', size: 16, rotate: 8 },
  { Icon: Circle, top: '12%', left: '82%', size: 8, rotate: 0 },
  { Icon: Sandwich, top: '20%', left: '93%', size: 26, rotate: 15 },
  { Icon: Bike, top: '28%', left: '2%', size: 32, rotate: -6 },
  { Icon: Star, top: '36%', left: '10%', size: 12, rotate: 20 },
  { Icon: CupSoda, top: '44%', left: '92%', size: 26, rotate: 10 },
  { Icon: Star, top: '50%', left: '4%', size: 14, rotate: -20 },
  { Icon: Circle, top: '58%', left: '95%', size: 6, rotate: 0 },
  { Icon: Package, top: '62%', left: '91%', size: 24, rotate: -8 },
  { Icon: IceCreamCone, top: '68%', left: '3%', size: 26, rotate: 18 },
  { Icon: Pizza, top: '80%', left: '92%', size: 22, rotate: 24 },
  { Icon: Coffee, top: '84%', left: '5%', size: 22, rotate: -14 },
  { Icon: Star, top: '92%', left: '88%', size: 16, rotate: 5 },
];

// Purely decorative, subtle background clutter for long scroll areas (home
// page body) — small food/delivery icons scattered near the edges so they
// never sit under readable content. OTLOB primary blue, outline style, low
// opacity but still visibly present (not near-invisible), matching the
// reference. No animation (kept static rather than "extremely subtle/slow"
// motion, to guarantee zero scroll/perf impact and to trivially respect
// prefers-reduced-motion by having nothing to reduce).
//
// pointer-events-none + aria-hidden, absolutely positioned within a
// `relative overflow-hidden` parent supplied by the caller — percentage
// coordinates only, so this can never introduce horizontal overflow.
export function BackgroundDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {ITEMS.map(({ Icon, top, left, size, rotate }, i) => (
        <Icon
          key={i}
          size={size}
          strokeWidth={1.25}
          className="absolute text-primary/20"
          style={{ top, left, transform: `rotate(${rotate}deg)` }}
        />
      ))}
    </div>
  );
}
