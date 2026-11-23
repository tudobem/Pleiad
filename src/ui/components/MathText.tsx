import { useEffect, useState } from 'preact/hooks';
import type katexType from 'katex';
import { splitMath } from '../mathText.ts';

type Katex = typeof katexType;
let katexModule: Katex | null = null;
let katexLoading: Promise<Katex> | null = null;

/** KaTeX and its stylesheet load only when a text actually contains math. */
function loadKatex(): Promise<Katex> {
  katexLoading ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(
    ([mod]) => (katexModule = mod.default),
  );
  return katexLoading;
}

/** Plain text with inline $...$ LaTeX. Text is escaped by Preact. */
export function MathText({ text }: { text: string }) {
  const parts = splitMath(text);
  const hasMath = parts.some((p) => p.math);
  const [katex, setKatex] = useState<Katex | null>(katexModule);

  useEffect(() => {
    if (!hasMath || katex) return;
    let alive = true;
    loadKatex()
      .then((k) => alive && setKatex(k))
      .catch(() => undefined); // keep the raw LaTeX visible if loading fails
    return () => {
      alive = false;
    };
  }, [hasMath, katex]);

  return (
    <>
      {parts.map((part, i) =>
        !part.math ? (
          part.value
        ) : katex ? (
          <span
            key={i}
            class="math"
            // KaTeX output with trust disabled is safe HTML for author-written LaTeX.
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(part.value, { throwOnError: false, trust: false }),
            }}
          />
        ) : (
          <span key={i} class="math math--pending">
            {part.value}
          </span>
        ),
      )}
    </>
  );
}
