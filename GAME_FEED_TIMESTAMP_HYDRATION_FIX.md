# Game Feed timestamp hydration fix

The Game Feed previously formatted timestamps with `toLocaleString()` during server rendering.
The server and the visitor browser can use different locale punctuation (for example `AM` versus `a.m.`), which causes a React hydration error.

Each card now:

1. Renders a deterministic UTC timestamp on the server and on the client's first render.
2. Replaces it with the visitor's local timestamp in `useEffect` after hydration.

This preserves local times without allowing locale differences to alter the server-rendered HTML.
