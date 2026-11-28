# End-to-end checks (local)

`npm run e2e` builds the app for `/pleiad/`, serves it locally and checks in Chromium:

- **Offline:** after one visit (skipping the first-run welcome), a cold start with no network shows Today, a session starts from the cached packs, and the Library renders.
- **Startup budget (SPEC 18):** the first screen appears from cache in under 1000 ms with 4x CPU throttling (a stand-in for a recent iPhone).
- **Update prompt:** when a new version is waiting, Today shows "An update is ready"; the session screen never does; "Restart now" activates it.

These checks need Playwright with Chromium on the machine (`npm i -g playwright && npx playwright install chromium`). They are not part of CI; CI runs the cheaper size budget (`npm run budget`).
