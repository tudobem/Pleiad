import type { ComponentChildren } from 'preact';
import { t, type StringId } from '../strings.ts';
import './screens.css';

export function StubScreen({
  title,
  body,
  children,
}: {
  title: StringId;
  body: StringId;
  children?: ComponentChildren;
}) {
  return (
    <main class="screen">
      <h1 class="screen__title">{t(title)}</h1>
      <p class="screen__muted">{t(body)}</p>
      <p class="screen__muted">{t('common.comingSoon')}</p>
      {children}
    </main>
  );
}
