# One image serves the API and the interface

The app ships as one Docker image, and one Fastify process answers both `/api` and the built interface on the port in `PORT`. The interface calls the API by the relative path `/api`, so serving both from one origin needs no CORS, no rewrite rules and no second service to keep in step. A GET outside `/api` that names no file gets `index.html`, so the interface's router owns every page path.

## Considered options

- **A static site for `web` and a web service for `server`.** Render serves static sites from a CDN, but the interface would then need the API's address at build time or a rewrite of `/api` to the other service. Two services also deploy apart, so a contract change could reach one before the other.
- **One process, one image.** Chosen. Fastify serves the files from `web/dist` when `WEB_DIST` is set. Tests and `mise run dev` leave it unset and keep the Vite proxy.

## Consequences

The service runs on Render's free plan with the in-memory store. A restart, a deploy or the instance sleeping after 15 minutes without requests deletes every event type and booking. Keeping data needs a database, which is a separate decision.
