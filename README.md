# Pleiad

A personal, offline-first spaced-repetition learning app. It starts with consciousness science and philosophy of mind and grows by adding content packs. Installable PWA now; a native wrapper may follow later.

- What to build: [SPEC.md](SPEC.md)
- Look and screens: [DESIGN.md](DESIGN.md)
- Milestones and progress: [PLAN.md](PLAN.md)
- Working conventions: [CLAUDE.md](CLAUDE.md)

## Install on iPhone or iPad

1. Open the site in **Safari** (other iOS browsers cannot install it the same way).
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Open Pleiad from the Home Screen icon and **study only in the installed app**.

Why: Safari can delete a website's data after seven days without a visit, but an app added to the Home Screen keeps its own storage. Data in a Safari tab and in the installed app are also kept separately, so progress made in a tab does not appear in the app. Export a backup regularly once that feature exists (milestone M7).

On a desktop browser (Chrome or Edge), use the install icon in the address bar.

## Development

Requires Node 22.18 or newer (see `.nvmrc`).

```sh
npm ci                    # install
npm run dev               # local dev server
npm test                  # unit tests (Vitest)
npm run lint              # ESLint, including layering rules
npm run typecheck         # TypeScript (core is checked without DOM types)
npm run validate:content  # content validator
npm run build             # production build into dist/
npm run preview           # serve the build locally
```

Layout (SPEC 3.2): `src/core` is pure TypeScript with no DOM or browser APIs; `src/platform` holds adapters (storage, clock, ...); `src/ui` holds Preact components and design tokens; `src/app` is the composition root. Content lives in `content/packs/`.

### Deployment

GitHub Actions runs checks on every push and deploys to GitHub Pages from `main` when they pass. One-time setup: repository **Settings > Pages > Source: GitHub Actions**.

### Icons

`public/icons/icon.svg` is the source. The PNG sizes (192, 512, maskable 512, Apple touch 180) were rendered from it with a headless browser; re-render them if the SVG changes.

## Privacy

No accounts, no analytics, no third-party network requests at runtime. Fonts are self-hosted. All learning data stays on the device.

## License

Code: Apache-2.0 (see [LICENSE](LICENSE)). Fonts: Fraunces and Inter, SIL Open Font License 1.1.
