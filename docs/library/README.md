# Library

Library is a module added by this fork. It helps a shared media server stay within its disk space: users vote on what they no longer need, titles nobody watches are queued for removal, and every queued title gets a visible countdown so anyone can keep it before it goes. It also tells each user when new episodes of the shows they follow are available.

Upstream Seerr manages what comes into the library. Library manages what leaves it.

## Features

- **Browse**: the whole library (movies and individual seasons) with filters, size on disk, last playback and the reason a title is queued.
- **Votes**: each user can mark a title as _Not interested_, _Watch later_ or _Request removal_. Users with the Keep permission can also mark it _Keep_, which takes it out of the queue.
- **Pending Removal**: titles that are going to be removed, each with its countdown. A title enters the queue when:
  - a user requests its removal;
  - enough users vote _Not interested_ (configurable);
  - nobody has played it for a configurable number of months (a weekly cap limits how many enter this way, oldest downloads first);
  - an administrator adds it.
- **Pause while watching**: when someone starts watching a queued season, its countdown stops. It resumes if playback is abandoned for long enough.
- **New Episodes**: for every show a user has been watching, lists the episodes and seasons released since they last watched, with links to play or request them. It is built from the user's playback history in Jellyfin/Emby and air dates from TMDB, so it keeps working after older seasons have been removed.
- **My Activity**: the user's own votes and requests.
- **How It Works**: a guided tour that opens the first time each user visits the module.
- **Removal History**: what was removed, when and why, plus waits and errors reported by the executor.
- **Radarr tag with its own threshold**: movies carrying a configured Radarr tag (for example, titles added by an automatic list) can use a shorter inactivity threshold.

Only active users count for votes: a user who has not used the media server for a configurable number of days is ignored until they come back.

## Requirements

- **Seerr with Jellyfin or Emby** as the media server. Plex is not supported: playback history and per-user progress are read from Jellyfin/Emby.
- **SQLite** database. The module ships SQLite migrations only; PostgreSQL is not supported.
- **Radarr and/or Sonarr** configured in Seerr. Only titles managed by Radarr/Sonarr can be queued, because removals go through them.
- **qBittorrent** (optional): only needed if Seerr should also handle the torrents of removed titles.

## Setup

Open **Library > Settings** as an administrator:

1. Choose the Jellyfin/Emby libraries that take part.
2. Review the thresholds: days in the queue before removal, months without playback, weekly cap, votes needed, days of inactivity for a user to stop counting, how long _Watch later_ lasts and the optional Radarr tag.
3. Choose who can vote and who can keep titles.
4. Choose an execution mode (below). New installations start in **Notify only**.

The library is synchronized with Jellyfin/Emby and Radarr/Sonarr every hour.

## Execution modes

When a countdown ends, the title becomes _Ready for removal_. What happens next depends on the mode:

| Mode | Who removes | Use it when |
| --- | --- | --- |
| **Notify only** | Nobody. The Removal History records what would have been removed. | Trying the module out, or removing by hand. |
| **Remove with Radarr/Sonarr** | Seerr itself, once a day at the configured hour (or with **Remove now**). | You want removals without extra software. |
| **External executor** | Your own program, through the [executor API](./external-executor.md). | You need checks Seerr cannot do (tracker rules, custom storage, hardlink audits). |

In **Remove with Radarr/Sonarr** mode, for each title ready for removal Seerr:

1. Checks that the Radarr/Sonarr entry still matches the library and that nothing for it is in the download queue. If not, it records an error and retries on the next run.
2. **Movie**: asks Radarr to delete the movie and its files.
3. **Season**: asks Sonarr to delete that season's episode files and unmonitors the season. If it was the most recent season on disk, the series is unmonitored too, so new seasons are not downloaded automatically. Users can still request them from New Episodes.
4. Applies the torrent policy (below), if qBittorrent is configured.
5. If nothing of the title remains, removes its Seerr entry so it can be requested again.

A title is never removed while someone is watching it, or after a user has marked it _Keep_.

## Torrent policy

Deleting a file in Radarr/Sonarr does not touch the torrent client. If the library file is a hardlink of a torrent that is still seeding, the disk space is not freed until the torrent is removed as well.

Without a qBittorrent connection, Seerr leaves torrents alone. With one, choose a policy:

- **Keep**: torrents are left in qBittorrent. Use this if Radarr/Sonarr or qBittorrent already remove them when seeding goals are met (but see the note below).
- **Remove**: torrents are removed together with their data as soon as the title is removed.
- **Remove once the minimum seeding goal is reached**: the title waits until each of its torrents reaches the minimum ratio or the minimum seeding hours set in Seerr, whichever comes first. Then title and torrents are removed together.

Torrents are matched by the download ID that Radarr/Sonarr recorded when grabbing them. A torrent that also contains other seasons still in the library is never removed. A torrent that is still downloading blocks the removal and is reported as an error.

### Note: Radarr/Sonarr "Remove Completed" after a removal

Radarr and Sonarr only remove a completed torrent if it is a tracked download in the _Imported_ state, which they work out from their download history (source: [`DownloadProcessingService.cs#L35-L45`](https://github.com/Radarr/Radarr/blob/b3396e2fd872c03a07b2bc98144715ae1bd88032/src/NzbDrone.Core/Download/DownloadProcessingService.cs#L35-L45), [`TrackedDownloadService.cs#L119-L125`](https://github.com/Radarr/Radarr/blob/b3396e2fd872c03a07b2bc98144715ae1bd88032/src/NzbDrone.Core/Download/TrackedDownloads/TrackedDownloadService.cs#L119-L125)).

- **Movies (Radarr)**: deleting a movie also deletes its download history ([`DownloadHistoryService.cs#L226-L229`](https://github.com/Radarr/Radarr/blob/b3396e2fd872c03a07b2bc98144715ae1bd88032/src/NzbDrone.Core/Download/History/DownloadHistoryService.cs#L226-L229)). The download stays _Imported_ only in Radarr's in-memory cache. "Remove Completed" still works until Radarr restarts; after a restart the torrent is no longer recognized as imported and Radarr never removes it.
- **Series deleted in Sonarr**: same behavior ([`DownloadHistoryService.cs#L230-L233`](https://github.com/Sonarr/Sonarr/blob/cab419ade8ac7fcab5bf80394ee492abd35d5f5a/src/NzbDrone.Core/Download/History/DownloadHistoryService.cs#L230-L233)).
- **Seasons removed by this module**: Library deletes episode files, not the series, so Sonarr keeps the download history and "Remove Completed" keeps working.

If you rely on "Remove Completed" for movies, use **Remove** or **Remove once the minimum seeding goal is reached** instead of **Keep**, or let qBittorrent's own share limits remove the torrents.

Checked against Radarr `develop` at `b3396e2` and Sonarr `develop` at `cab419a`.
