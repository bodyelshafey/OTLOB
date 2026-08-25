// Purely decorative — replaces the header's straight/rounded-corner bottom
// edge with a soft organic wave. Filled area sits below the curve down to
// the bottom of the SVG box, so overlapping it with the header's bottom
// edge (same primary color) makes the header's solid color continue in a
// wave instead of a hard line — the troughs reveal the page background.
// Works the same in RTL/LTR: the curve is a full-width, roughly symmetric
// shape with no directional asymmetry to flip.
export function NavbarWave({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 60"
      preserveAspectRatio="none"
      className={`block h-6 w-full sm:h-8 ${className}`}
      aria-hidden="true"
    >
      <path
        d="M0,10 C240,55 480,55 720,30 C960,5 1200,5 1440,35 L1440,60 L0,60 Z"
        fill="currentColor"
      />
    </svg>
  );
}
