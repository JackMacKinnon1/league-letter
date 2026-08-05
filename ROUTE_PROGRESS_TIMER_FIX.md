# Route progress timer type fix

`components/RouteProgress.tsx` no longer stores the browser timeout ID in a React ref.
The route-change effect now creates a local `timerId` and clears that same ID in its cleanup.
This removes the `number` versus `NodeJS.Timeout` mismatch during production type checking.
