'use client';

import {
  Star,
  Moon,
  Sandwich,
  Bike,
  Pizza,
  CupSoda,
  Package,
} from 'lucide-react';

const ICONS = [
  Star,
  Moon,
  Sandwich,
  Bike,
  Pizza,
  CupSoda,
  Star,
  Package,
  Moon,
];

const POSITIONS = [
  { left: '4%', top: 13 },
  { left: '15%', top: 22 },
  { left: '26%', top: 25 },
  { left: '37%', top: 23 },
  { left: '49%', top: 16 },
  { left: '61%', top: 8 },
  { left: '73%', top: 7 },
  { left: '85%', top: 10 },
  { left: '96%', top: 17 },
];

export function HangingDecorations() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-24 overflow-hidden"
    >
      {ICONS.map((Icon, i) => {
        const position = POSITIONS[i];

        const length = 10 + ((i * 16) % 40);

        return (
          <div
            key={i}
            className="absolute flex flex-col items-center"
            style={{
              left: position.left,
              top: position.top,
            }}
          >
            {/* Hanging string */}
            <div
              className="w-px bg-amber-300/70"
              style={{ height: length }}
            />

            {/* Small connector */}
            <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />

            {/* Decoration */}
            <Icon
              size={16}
              className="mt-0.5 text-amber-400"
              strokeWidth={1.75}
            />
          </div>
        );
      })}
    </div>
  );
}