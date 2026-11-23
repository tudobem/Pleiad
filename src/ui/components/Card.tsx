import type { ComponentChildren } from 'preact';
import './components.css';

export function Card({ children, class: extra }: { children: ComponentChildren; class?: string }) {
  return <div class={`card${extra ? ` ${extra}` : ''}`}>{children}</div>;
}
