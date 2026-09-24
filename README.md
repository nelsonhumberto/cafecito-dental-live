# Cafecito Dental Live Studio

Static presenter dashboard for the fictional dental voice demonstration.

## Publish an update

Run `npm ci` then `npm run build:pages`. Commit source and `docs/`, then push to `main`. GitHub Pages publishes the `/docs` directory.

The website and rehearsal are public; live call data requires a presenter key entered through Connect live. No OpenAI, Twilio, or LiveKit credentials belong in this repository. The phone agent remains on LiveKit Cloud and the authenticated feed runs in Twilio Functions. All patient records and appointments are fictional.

For a custom domain, update the build base to `/`, configure GitHub Pages DNS, and authorize the new origin in the feed service.
