# Hydration-safe page animations

The staggered page transition no longer adds temporary classes, inline styles,
or data attributes to server-rendered page elements.

`components/PageTransition.tsx` now uses the browser Web Animations API. This
keeps the staggered fade/slide/blur effect while avoiding React hydration
mismatches in Next.js, including on links that hydrate inside nested routes.

The animation still replays on:

- every client-side route change;
- browser back/forward cache restoration;
- newly streamed or asynchronously inserted sections; and
- elements entering the viewport farther down the page.

No database or environment changes are required.
