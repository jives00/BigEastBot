# BigEastBot

Reddit bot that updates scores, schedules, and standings on /r/bigeast via the ESPN API.

## Deployment

Runs as a Docker container on a Synology NAS. CI builds the image and pushes to `ghcr.io` on every push to `main`. Watchtower auto-deploys within 5 minutes.

## Configuration

Credentials are passed via environment variables (never committed). Create a `.env` file:

```
REDDIT_USERNAME=bigeastmod
REDDIT_PASSWORD=...
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
```

## Data files

The bot reads and writes three files that persist across container restarts via a bind mount at `/app/data`:

- `standings.csv` — team records (Team, URL, OverallWins, OverallLosses, ConfWins, ConfLosses). Must be in alphabetical order matching the `BETeams` array in the bot.
- `standingsSorted.csv` — auto-generated sorted version, used to build the sidebar.
- `gameIDs.txt` — tracks processed game IDs to avoid double-counting results.

Copy current CSV files from EC2 to `/volume2/docker/bigeastbot/data/` on the NAS before first run.

## Running locally

```bash
pip install -r requirements.txt
export REDDIT_USERNAME=... REDDIT_PASSWORD=... REDDIT_CLIENT_ID=... REDDIT_CLIENT_SECRET=...
python bigeastBot.py
```

## Tests

```bash
pytest
```
