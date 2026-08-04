# Navigation, transitions, and Site Admin update

## Deployment

1. Copy this codebase over the current League Letter project.
2. Keep the existing `.env.local` and `.git` folder.
3. Run `npm install` locally if dependencies are not already installed.
4. Run `npm run build`.
5. Deploy the normal production branch to Netlify.

No additional Supabase migration is required for this update.

## Site Admin access

The protected site-owner email is defined in:

```text
lib/permissions.ts
```

It is currently:

```text
mackinnonjack4@gmail.com
```

Only that authenticated Supabase user sees the **Site Admin** navigation button and can access:

```text
/site-admin
/site-admin/wr-valuator
/site-admin/game-feed
```

The Game Feed settings APIs also verify this email server-side. Removing the
controls from league admin pages is therefore not the only protection.

## Game Feed controls

League-room admins no longer see the Game Feed collector/settings panel.
The site owner controls all league rooms from:

```text
Site Admin → Game Feed Control
```

That page supports:

- Collector heartbeat and current Public/Test worker mode
- Source Sleeper league and polling status
- Enabling or disabling the feed per room
- Selecting Public or Test data per room
- Enable all / Disable all / All public / All test shortcuts

## Navigation and transitions

- The large league-page button row is now one animated **League menu** hamburger dropdown.
- The global navigation shows a highlighted **Site Admin** button only to the site owner.
- Every route receives a smooth fade/blur/slide entrance.
- Internal navigation displays a slim progress animation at the top of the page.
- Reduced-motion browser preferences disable the entrance animation.
