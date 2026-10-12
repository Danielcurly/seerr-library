import RadarrAPI from '@server/api/servarr/radarr';
import type { SonarrSeries } from '@server/api/servarr/sonarr';
import SonarrAPI from '@server/api/servarr/sonarr';

// Lo que necesita el borrador (modo arr) de Radarr/Sonarr y no trae Seerr:
// la cola entera (getQueue solo lee la primera pagina), el historial de
// descargas y el borrado de una temporada suelta

// Un registro de la cola o del historial
export interface RegistroArr {
  movieId?: number;
  seriesId?: number;
  seasonNumber?: number;
  episode?: { seasonNumber?: number };
  title?: string;
  sourceTitle?: string;
  downloadId?: string;
}

interface Pagina {
  records: RegistroArr[];
}

const TAM_PAGINA = 1000;

export class RadarrBiblioteca extends RadarrAPI {
  public async cola(): Promise<RegistroArr[]> {
    const r = await this.axios.get<Pagina>('/queue', {
      params: { pageSize: TAM_PAGINA },
    });
    return r.data.records;
  }

  public async pelicula(
    id: number
  ): Promise<{ id: number; tmdbId: number; path: string }> {
    return (await this.axios.get(`/movie/${id}`)).data;
  }

  public async historial(movieId: number): Promise<RegistroArr[]> {
    return (
      await this.axios.get<RegistroArr[]>('/history/movie', {
        params: { movieId },
      })
    ).data;
  }

  public async borrarPelicula(id: number): Promise<void> {
    await this.axios.delete(`/movie/${id}`, {
      params: { deleteFiles: true, addImportExclusion: false },
    });
  }
}

export class SonarrBiblioteca extends SonarrAPI {
  public async cola(): Promise<RegistroArr[]> {
    const r = await this.axios.get<Pagina>('/queue', {
      params: { pageSize: TAM_PAGINA, includeEpisode: true },
    });
    return r.data.records;
  }

  public async serie(id: number): Promise<SonarrSeries> {
    return (await this.axios.get<SonarrSeries>(`/series/${id}`)).data;
  }

  public async guardarSerie(serie: SonarrSeries): Promise<void> {
    await this.axios.put(`/series/${serie.id}`, serie);
  }

  public async historial(seriesId: number): Promise<RegistroArr[]> {
    return (
      await this.axios.get<RegistroArr[]>('/history/series', {
        params: { seriesId, includeEpisode: true },
      })
    ).data;
  }

  public async ficheros(
    seriesId: number
  ): Promise<{ id: number; seasonNumber: number }[]> {
    return (await this.axios.get('/episodefile', { params: { seriesId } }))
      .data;
  }

  public async borrarFicheros(episodeFileIds: number[]): Promise<void> {
    await this.axios.delete('/episodefile/bulk', {
      data: { episodeFileIds },
    });
  }

  // Deja de seguir los episodios de una temporada (si no, Sonarr los vuelve a
  // buscar)
  public async dejarDeSeguirTemporada(
    seriesId: number,
    seasonNumber: number
  ): Promise<void> {
    const episodios: { id: number; monitored: boolean }[] = (
      await this.axios.get('/episode', { params: { seriesId, seasonNumber } })
    ).data;
    const ids = episodios.filter((e) => e.monitored).map((e) => e.id);
    if (ids.length) {
      await this.axios.put('/episode/monitor', {
        episodeIds: ids,
        monitored: false,
      });
    }
  }
}

// Temporada de un registro de la cola o del historial de Sonarr
export const temporadaDe = (r: RegistroArr): number | undefined =>
  r.seasonNumber ?? r.episode?.seasonNumber;
