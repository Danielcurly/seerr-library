# External executor API

In **External executor** mode, Seerr does not remove anything itself. It publishes the titles that are ready for removal, and your program removes them and reports back. Use this when removals need checks Seerr cannot make, such as tracker seeding rules, hardlink audits or storage outside Radarr/Sonarr.

The API has two endpoints under `/api/biblioteca/ejecutor`:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/biblioteca/ejecutor/borrar` | List the titles ready for removal. |
| `POST` | `/api/biblioteca/ejecutor/resultado` | Report what happened with one title. |

They are not part of the `/api/v1` OpenAPI spec.

## Authentication

Send the Seerr API key (**Settings > General > API Key**) in the `X-Api-Key` header. Session cookies are not accepted. A missing or wrong key returns `403`.

## GET /api/biblioteca/ejecutor/borrar

Before answering, Seerr re-evaluates the queue, so the list is current. It can be called at any time and in any mode.

```json
{
  "modo": "externo",
  "modoPrueba": false,
  "elementos": [
    {
      "id": 42,
      "embyId": "a1b2c3d4e5f6",
      "tipo": "movie",
      "titulo": "Example Movie",
      "temporada": -1,
      "ultimaTemporada": false,
      "motivo": "C",
      "vence": "2026-11-11T04:00:00.000Z",
      "tamano": 8589934592,
      "tmdbId": 12345,
      "tvdbId": null,
      "radarrId": 87,
      "sonarrId": null,
      "arrServidor": 0,
      "ruta": "/movies/Example Movie (2001)",
      "ejecucion": null,
      "esperaHasta": null,
      "nota": null
    }
  ]
}
```

### Top-level fields

| Field | Description |
| --- | --- |
| `modo` | Current execution mode: `avisar` (notify only), `arr` (Seerr removes through Radarr/Sonarr) or `externo` (external executor). **Only remove anything when it is `externo`.** |
| `modoPrueba` | Kept for older clients: `true` whenever `modo` is not `externo`. |
| `elementos` | Titles ready for removal. Titles that someone is currently watching are left out. |

### Item fields

| Field | Description |
| --- | --- |
| `id` | Queue entry ID. Use it when reporting the result. |
| `embyId` | Item ID in Jellyfin/Emby (the series ID for seasons). |
| `tipo` | `movie` or `tv`. |
| `titulo` | Title as shown in Seerr. |
| `temporada` | `-1` for a movie, otherwise the season number to remove. |
| `ultimaTemporada` | `true` if this is the most recent season on disk. The built-in executor unmonitors the whole series in that case; doing the same is recommended. |
| `motivo` | Why it was queued: `A` a user requested removal, `B` enough _Not interested_ votes, `C` not played for the configured time, `F` added by an administrator. |
| `vence` | When the countdown ended (ISO 8601). |
| `tamano` | Size on disk in bytes, as reported by Radarr/Sonarr. |
| `tmdbId`, `tvdbId` | External IDs. Check them against Radarr/Sonarr before deleting. |
| `radarrId` / `sonarrId` | Movie ID in Radarr or series ID in Sonarr (the other one is `null`). |
| `arrServidor` | ID of the Radarr/Sonarr server in Seerr's settings (**Settings > Services**), for setups with several instances. |
| `ruta` | Folder of the movie or series according to Radarr/Sonarr. |
| `ejecucion` | Last result you reported: `null`, `espera` or `error`. |
| `esperaHasta` | With `espera`, the date you asked to wait until. Skip the item until then. |
| `nota` | The message you sent with the last result. |

Items you reported as `espera` or `error` are still listed. The executor decides when to retry: after `esperaHasta` for waits, on the next run for errors.

## POST /api/biblioteca/ejecutor/resultado

Body (JSON):

| Field | Required | Description |
| --- | --- | --- |
| `id` | yes | `id` of the item. |
| `resultado` | yes | `borrado` (removed), `espera` (waiting) or `error`. |
| `hasta` | with `espera` | ISO 8601 date until which the item must wait (for example, the end of a minimum seeding time). |
| `mensaje` | no | Free text shown to administrators in the queue and in the Removal History. Truncated to 2000 characters. |

### Results

- **`borrado`**: the title has been removed. Seerr records it in the Removal History and drops the queue entry and its votes. If the title is downloaded again later, it starts from scratch. Only accepted when the mode is `externo`.
- **`espera`**: the title cannot be removed yet. Seerr stores `hasta` and shows the item as waiting. A history entry is written only when the date changes.
- **`error`**: the removal failed. Seerr shows the message to administrators. A history entry is written only when the message changes.

### Responses

| Status | Meaning |
| --- | --- |
| `204` | Recorded. |
| `400` | `resultado` is not one of the three values, or `hasta` is missing or not a valid date. |
| `403` | Missing or wrong API key. |
| `404` | No queue entry with that `id`. |
| `409` | The item is no longer ready for removal: a user kept it, or someone started watching it. For `borrado`, also returned when the mode is not `externo`. |

Error responses carry a JSON body `{"error": "..."}`.

## Recommended flow

1. Call `GET /borrar`. Stop if `modo` is not `externo`.
2. For each item, skip it if `esperaHasta` is in the future.
3. Check that the Radarr/Sonarr entry still matches (`tmdbId` / `tvdbId`), and that nothing for it is in the download queue.
4. Remove the files:
   - **Movie**: `DELETE /api/v3/movie/{radarrId}?deleteFiles=true` in Radarr.
   - **Season**: delete the season's files with `DELETE /api/v3/episodefile/bulk` in Sonarr, then unmonitor the season. If `ultimaTemporada` is `true`, unmonitor the series too.
5. Handle torrents according to your own rules.
6. Report `borrado`, `espera` (with `hasta`) or `error`.

Act right after the `GET`: a user can keep a title at any moment. If `borrado` returns `409` because the title was kept after you removed it, the next hourly sync notices the files are gone and removes it from the library.

## Examples

List the queue:

```bash
curl -s -H "X-Api-Key: $SEERR_API_KEY" \
  http://localhost:5055/api/biblioteca/ejecutor/borrar
```

Report a removal:

```bash
curl -s -X POST -H "X-Api-Key: $SEERR_API_KEY" -H "Content-Type: application/json" \
  -d '{"id": 42, "resultado": "borrado"}' \
  http://localhost:5055/api/biblioteca/ejecutor/resultado
```

Report a wait:

```bash
curl -s -X POST -H "X-Api-Key: $SEERR_API_KEY" -H "Content-Type: application/json" \
  -d '{"id": 42, "resultado": "espera", "hasta": "2026-11-20T00:00:00Z", "mensaje": "Seeding until the tracker minimum"}' \
  http://localhost:5055/api/biblioteca/ejecutor/resultado
```

## Minimal Python client

Standard library only. It removes movies through Radarr and seasons through Sonarr, with one instance of each. Add your own checks (torrents, tracker rules) where marked.

```python
import json
import os
import urllib.request
from datetime import datetime, timezone

SEERR = os.environ.get("SEERR_URL", "http://localhost:5055")
SEERR_KEY = os.environ["SEERR_API_KEY"]
RADARR = (os.environ["RADARR_URL"], os.environ["RADARR_API_KEY"])
SONARR = (os.environ["SONARR_URL"], os.environ["SONARR_API_KEY"])


def call(base, key, method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method)
    req.add_header("X-Api-Key", key)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def report(item_id, result, message=None, until=None):
    body = {"id": item_id, "resultado": result}
    if message:
        body["mensaje"] = message
    if until:
        body["hasta"] = until
    call(SEERR, SEERR_KEY, "POST", "/api/biblioteca/ejecutor/resultado", body)


def remove_movie(item):
    url, key = RADARR
    movie = call(url, key, "GET", f"/api/v3/movie/{item['radarrId']}")
    if movie["tmdbId"] != item["tmdbId"]:
        raise RuntimeError("Radarr entry does not match")
    # Your checks here (download queue, torrents, tracker rules...)
    call(url, key, "DELETE", f"/api/v3/movie/{item['radarrId']}?deleteFiles=true")


def remove_season(item):
    url, key = SONARR
    sid, season = item["sonarrId"], item["temporada"]
    series = call(url, key, "GET", f"/api/v3/series/{sid}")
    if series["tvdbId"] != item["tvdbId"]:
        raise RuntimeError("Sonarr entry does not match")
    # Your checks here (download queue, torrents, tracker rules...)
    files = call(url, key, "GET", f"/api/v3/episodefile?seriesId={sid}")
    ids = [f["id"] for f in files if f["seasonNumber"] == season]
    if ids:
        call(url, key, "DELETE", "/api/v3/episodefile/bulk", {"episodeFileIds": ids})
    series = call(url, key, "GET", f"/api/v3/series/{sid}")
    for s in series["seasons"]:
        if s["seasonNumber"] == season:
            s["monitored"] = False
    if item["ultimaTemporada"]:
        series["monitored"] = False
    call(url, key, "PUT", f"/api/v3/series/{sid}", series)


def main():
    queue = call(SEERR, SEERR_KEY, "GET", "/api/biblioteca/ejecutor/borrar")
    if queue["modo"] != "externo":
        return
    now = datetime.now(timezone.utc)
    for item in queue["elementos"]:
        wait = item.get("esperaHasta")
        if wait and datetime.fromisoformat(wait.replace("Z", "+00:00")) > now:
            continue
        try:
            if item["tipo"] == "movie":
                remove_movie(item)
            else:
                remove_season(item)
            report(item["id"], "borrado")
        except Exception as e:
            report(item["id"], "error", str(e))


if __name__ == "__main__":
    main()
```

Run it on a schedule, for example once a day.
