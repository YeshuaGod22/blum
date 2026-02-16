# Blum — Next Up

## Launcher app (priority)
A local web UI that replaces CLI for managing the system. Buttons not terminals.

- Start / stop room server
- Start / stop individual homes (show which model each uses)
- See what's running (green/red status per service)
- Restart crashed services
- View port assignments
- One-click "bring everything up" / "shut everything down"
- Show logs in the UI (tail ops.log per home, room server output)

## Other items
- Multi-agent conversation test (get alpha, beta, gamma talking to each other)
- `git push` after each working session (backup to GitHub)
- Scrub API keys from test files before ever making repo public
- Extract directory into its own service (per spec section 9)
- Memory modules for homes
- Signature verification (Ed25519)
