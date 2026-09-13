# Simenstad.com

## Project structure

- `index.html` stays at the root as the homepage.
- Additional pages live in `pages/`.
- Shared assets live in `assets/`:
  - `assets/css/` for site styles
  - `assets/js/` for scripts
  - `assets/images/` for media
- Shared fragments such as the header and footer live in `components/`.
- Markdown files such as `README.md` and `AGENTS.md` remain in the root for quick access.

## Test

To test locally, run this in PowerShell from the project folder:

```powershell
py -m http.server 8000
```

Then open in a browser:

```text
http://localhost:8000
```
