'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface CarouselItem {
  id: string;
  title?: string | null;
  image?: string | null;
  link?: string | null;
  storeId?: string | null;
  store?: { id: string; name: string } | null;
}

interface Props {
  items: CarouselItem[];
  // Auto-slide interval in ms. Pass 0 to disable.
  autoSlideMs?: number;
}

// Visual/UI-only rewrite (fetching, links, storeId behavior all unchanged
// from before): "current ad centered, previous/next peeking on the sides"
// instead of one full-width slide at a time. Built with plain CSS
// scroll-snap + a timer, same approach as before — no carousel library
// added. Infinite looping is done by rendering one cloned slide on each
// end and jumping (no animation) once the real scroll settles on a clone,
// the standard scroll-snap infinite-loop trick.
export function AdsCarousel({ items, autoSlideMs = 4000 }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loop = items.length > 1;
  // [lastClone, ...items, firstClone] when looping is possible.
  const slides = loop ? [items[items.length - 1], ...items, items[0]] : items;

  const scrollToSlide = useCallback((slideIndex: number, smooth = true) => {
    const track = trackRef.current;
    if (!track) return;
    const child = track.children[slideIndex] as HTMLElement | undefined;
    if (child) track.scrollTo({ left: child.offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Start centered on the first real slide (index 1 when a clone is prepended).
  useEffect(() => {
    scrollToSlide(loop ? 1 : 0, false);
    setIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const goTo = useCallback(
    (realIndex: number) => {
      scrollToSlide(loop ? realIndex + 1 : realIndex);
      setIndex(realIndex);
    },
    [loop, scrollToSlide],
  );

  useEffect(() => {
    if (!autoSlideMs || items.length <= 1) return;
    const timer = setInterval(() => {
      if (pausedRef.current) return;
      goTo((index + 1) % items.length);
    }, autoSlideMs);
    return () => clearInterval(timer);
  }, [autoSlideMs, items.length, index, goTo]);

  const pauseThenResume = useCallback(() => {
    pausedRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    // Resume auto-rotation a couple seconds after the user stops touching
    // the carousel — long enough that a drag/swipe doesn't immediately
    // fight with the next auto-advance.
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
    }, 3000);
  }, []);

  const handleScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const children = Array.from(track.children) as HTMLElement[];
    const nearest = children.reduce(
      (best, child, i) =>
        Math.abs(child.offsetLeft - track.scrollLeft) < Math.abs(children[best]?.offsetLeft - track.scrollLeft)
          ? i
          : best,
      0,
    );

    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      if (!loop) {
        setIndex(nearest);
        return;
      }
      // Landed on the prepended clone (visually "before" the first real
      // slide) — jump instantly to the real last slide's position.
      if (nearest === 0) {
        scrollToSlide(items.length, false);
        setIndex(items.length - 1);
      } else if (nearest === slides.length - 1) {
        // Landed on the appended clone — jump to the real first slide.
        scrollToSlide(1, false);
        setIndex(0);
      } else {
        setIndex(nearest - 1);
      }
    }, 120);
  }, [loop, items.length, slides.length, scrollToSlide]);

  if (items.length === 0) return null;

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={handleScroll}
        onPointerDown={pauseThenResume}
        onTouchStart={pauseThenResume}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-10 pb-1"
      >
        {slides.map((item, i) => {
          const content = (
            // Fixed aspect ratio, `object-contain` (not cover) so the
            // uploaded ad image is never stretched or cropped — it's shown
            // as-is, letterboxed on a soft background if its ratio differs.
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl2 bg-primary-100 shadow-card">
              {item.image && <Image src={item.image} alt={item.title ?? ''} fill className="object-contain" />}
              {/* Store attribution — set from the admin dashboard, optional.
                  Shown as a small badge at the top, separate from the
                  title overlay at the bottom. */}
              {item.store?.name && (
                <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-primary-700 shadow-soft">
                  {item.store.name}
                </span>
              )}
              {item.title && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/55 to-transparent px-3 py-2">
                  <p className="truncate text-sm font-bold text-white">{item.title}</p>
                </div>
              )}
            </div>
          );
          const isExternal = item.link && /^https?:\/\//.test(item.link);
          // Only render an href for a scheme we actually trust — the DTO
          // already rejects javascript:/data: links server-side, but a link
          // planted before that validation existed (or written directly to
          // the DB) shouldn't still be clickable here.
          const isSafeRelative = item.link && item.link.startsWith('/');
          const href = isExternal || isSafeRelative ? item.link : item.storeId ? `/stores/${item.storeId}` : undefined;
          const isActive = loop ? i === index + 1 : i === index;

          return (
            <div
              key={`${item.id}-${i}`}
              className="w-[78%] shrink-0 snap-center transition-transform duration-300 sm:w-[62%] lg:w-[46%]"
              style={{ transform: isActive ? 'scale(1)' : 'scale(0.92)', opacity: isActive ? 1 : 0.7 }}
            >
              {href ? (
                isExternal ? (
                  <a href={href} target="_blank" rel="noreferrer" className="block active:scale-[0.98]">
                    {content}
                  </a>
                ) : (
                  <Link href={href} className="block active:scale-[0.98]">
                    {content}
                  </Link>
                )
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>
      {items.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {items.map((item, i) => (
            <button
              key={item.id}
              aria-label={`الإعلان ${i + 1}`}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-4 bg-primary' : 'w-1.5 bg-ink/15'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
