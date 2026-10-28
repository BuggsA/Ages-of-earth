# Hide shut age roads from the Town Center card

The Town Center's command card listed a 🔒 button for every side road shut from the current age, crowding out the real choices. They are no longer listed (`src/ui/hud.ts`). Rules unchanged. Step back's text still names what it reopens, and the 'stepback' tip still uses `shutRoads`.

Verified: `npx tsc --noEmit` clean. Not tried in a browser.
