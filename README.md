# Angad Sharma — Developer Portfolio

A framework-free portfolio for an SDE and LMS Associate building Moodle, PHP, and MySQL systems — with a page-wide WebGL particle scene, variable-font typography, and evidence-first content.

## Live sites

This repository (`angad-portfolio-onslate`, branch `main`) is the professional edition of the portfolio.

- This repository: [angad.onslate.in](https://angad.onslate.in/) (Zoho Catalyst Slate)
- Open-source edition: [angad64553.github.io](https://angad64553.github.io/) (GitHub Pages, `github` branch of the `angad64553.github.io` repository)

The two editions are maintained independently in separate repositories. Nothing syncs or merges them.
The former AWS-hosted site is retired.

## Built with

- Semantic HTML5, one CSS file, vanilla JavaScript — no framework
- Three.js (vendored r128) with a custom particle shader for the page-wide scene
- Archivo (variable width and weight) and IBM Plex Mono, both self-hosted
- Web3Forms contact delivery
- GitHub Pages and Zoho Catalyst Slate

## Highlights

- One field of 22,000 particles that re-forms per section: a ringed globe with tracked callouts, stacked layers, a knot, and a rippling disc
- A hero name set in a variable font whose letters widen and heat up under the pointer
- Project cards that stick and stack, a scroll-velocity marquee, word-by-word heading reveals, and a filling timeline
- Cursor spotlight on card borders, 3D tilt-and-glare cards, and a once-per-session intro
- Dark and light themes, with a CSS fallback globe when WebGL is unavailable
- Live GitHub profile, contribution calendar, latest commit, and repositories
- Reduced-motion support, keyboard-accessible navigation, and semantic landmarks
- Printable résumé page; Open Graph, JSON-LD, robots, and sitemap metadata

See [DESIGN.md](DESIGN.md) for the design system and motion rules.

## Search indexing

Every SEO reference in this repository uses `https://angad.onslate.in/`: canonical
tags on the homepage and résumé, Open Graph and Twitter URLs, JSON-LD,
`sitemap.xml`, and the `Sitemap:` line in `robots.txt`. The open-source edition
is linked visibly and listed in the Person `sameAs`; it is never declared as
canonical here, and there are no redirects.

Run `python3 tests/verify_seo.py` before committing. It runs the build and
checks the `dist/client` output that Slate serves.
See [SEARCH-INDEXING.md](SEARCH-INDEXING.md) for Search Console steps.

## Deployment (Zoho Catalyst Slate)

Slate should build the `main` branch of this repository with these settings:

- Framework: Other; Root Path: `./`
- Install Command: `npm install`; Build Command: `npm run build`
- Build Path: `dist/client`

`build.mjs` copies only the files in its `publicFiles` list into `dist/client`,
so docs and tests are never served. **When you add a site file, add it there.**
This repository has no GitHub Actions workflow and does not deploy GitHub Pages.

## Local preview

Run any static server from the project root, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Contact

- Email: [angad64553@gmail.com](mailto:angad64553@gmail.com)
- GitHub: [github.com/angad64553](https://github.com/angad64553)
- LinkedIn: [angad-sharma-64553-](https://www.linkedin.com/in/angad-sharma-64553-)
- Instagram: [@angad.sharma14](https://www.instagram.com/angad.sharma14/)
- Facebook: [angad64553](https://www.facebook.com/angad64553)
- WhatsApp: [+91 70524 78516](https://wa.me/917052478516)


