# Screenshots

Drop the actual screenshot files here with these exact names — the three
top-level READMEs (`README.md`, `README.uk.md`, `README.pl.md`) already
reference them, so nothing else needs to change once the files exist.

| File | What to capture |
|---|---|
| `setup.png` | The first-run screen at `/setup` — the "create admin account" form. |
| `dashboard.png` | `/admin` with at least one or two codes already created, so the list isn't empty. |
| `code-detail.png` | `/admin/codes/:id` with two or more links added and one marked active — this is the screenshot that best shows the actual idea of the project. |
| `settings.png` | `/admin/settings` — base domain and change-password form. |

Tips:
- PNG, browser window roughly 1200–1400px wide, include the top navigation
  bar in the shot (it shows the language switcher and the theme toggle,
  which is otherwise easy to miss in a cropped screenshot).
- All three README files point at the *same* image files — the interface
  language visible in the screenshot doesn't have to match the README
  language you're reading. Capture once, in whichever language you like
  (English is a reasonable neutral default), and it shows up on all three
  pages. If you'd rather have each language page show its own
  screenshots in that language, see the note in the main README's
  Screenshots section.
- Once the files are added: `git add docs/screenshots && git commit && git push` —
  GitHub renders them automatically, no README edits needed.
