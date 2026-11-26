import type { ComponentChildren } from 'preact';
import './library.css';

/** A titled, horizontally scrolling row of cards (DESIGN 4.4). */
export function ShelfRow({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class="shelf" aria-label={title}>
      <h2 class="shelf__title">{title}</h2>
      <ul class="shelf__row">{children}</ul>
    </section>
  );
}
