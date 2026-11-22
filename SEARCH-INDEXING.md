# Search indexing — angad.onslate.in

This repository is the professional edition of the portfolio, deployed by Zoho
Catalyst Slate. The open-source edition, https://angad64553.github.io/, is
built from the `github` branch of the `angad64553.github.io` repository.

## What this repository declares

- Canonical, `og:url`, `twitter:url`: `https://angad.onslate.in/` (homepage) and
  `https://angad.onslate.in/resume.html` (résumé)
- JSON-LD (Person, WebSite, ProfilePage) URLs on `https://angad.onslate.in/`
- `sitemap.xml`: the homepage and the résumé, both indexable
- `robots.txt`: allows crawling and declares `https://angad.onslate.in/sitemap.xml`
- `404.html` and `thankyou.html` are `noindex`
- The open-source edition appears as a visible link and in the Person `sameAs`.
  It is never declared as canonical, and there are no redirects.

`python3 tests/verify_seo.py` builds the site and checks all of the above in
`dist/client`.

## Hosting behavior to re-check after each deploy

These are Slate behaviors, not repository settings:

- Unknown extensionless paths (for example `/admin`) have returned the homepage
  with HTTP 200 instead of a 404. The canonical tag points such URLs back to `/`.
  Check whether Slate serves `404.html` after deploying it.
- HTML, `robots.txt` and `sitemap.xml` have been served with
  `Cache-Control: public, max-age=31536000`.
- `robots.txt` once returned a Zoho 524 timeout page (about 1 in 210 requests).

## Search Console (manual)

1. Open the URL-prefix property `https://angad.onslate.in/`. The
   `google-site-verification` meta tag in `index.html` verifies it.
2. Submit (or resubmit) `https://angad.onslate.in/sitemap.xml`.
3. Inspect `https://angad.onslate.in/` and `https://angad.onslate.in/resume.html`,
   run **Test live URL**, then **Request indexing**.
4. Do not submit removal requests for either site.

Statuses to watch: "URL is on Google"; "Duplicate, Google chose different
canonical than user"; "Crawled – currently not indexed"; the Google-selected
canonical; sitemap status "Success".

Canonical tags and sitemaps are hints. Google decides whether to index and
show each URL.

## Keeping `lastmod` accurate

Update `<lastmod>` in `sitemap.xml` (and `dateModified` in the ProfilePage
JSON-LD) when page content meaningfully changes.
