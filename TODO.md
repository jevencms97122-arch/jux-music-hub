# TODO - Cloudflare tunnel removal (use public IP:8090)

- [x] Inspect where Cloudflare/trycloudflare base URL is configured for media server.
- [x] Replace default `VITE_MEDIA_BASE_URL` fallback from trycloudflare URL to `http://188.115.125.74:8090`.
- [ ] Ensure the app uses HTTPS-compatible base URL (prefer `https://<PUBLIC_IP>:8090` if configured; otherwise fall back to `http://...` only if app is served over HTTP).
- [ ] Verify PocketBase base URL (`VITE_PB_URL`) already points to `http://188.115.125.74:8090`; align media server similarly.
- [ ] Update any docs / env examples if present.
- [ ] Run build/lint/tests to confirm no TS errors.


