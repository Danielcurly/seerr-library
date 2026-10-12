import JellyfinAPI from '@server/api/jellyfin';

// Lo que el modulo Biblioteca necesita de Emby y que el cliente de Seerr no
// trae: catalogo con fechas y generos, episodios y lo reproducido por usuario.

export interface EmbyElemento {
  Id: string;
  Name: string;
  SortName?: string;
  Type: 'Movie' | 'Series' | 'Episode';
  DateCreated?: string;
  PremiereDate?: string;
  ProductionYear?: number;
  Genres?: string[];
  ProviderIds?: Record<string, string | undefined>;
  SeriesId?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  UserData?: {
    Played?: boolean;
    LastPlayedDate?: string;
  };
}

export interface EmbyUsuario {
  Id: string;
  Name: string;
  LastActivityDate?: string;
}

interface EmbyRespuesta {
  Items: EmbyElemento[];
  TotalRecordCount: number;
}

class EmbyBiblioteca extends JellyfinAPI {
  public async catalogo(bibliotecaId: string): Promise<EmbyElemento[]> {
    const r = await this.get<EmbyRespuesta>('/Items', {
      params: {
        ParentId: bibliotecaId,
        Recursive: true,
        IncludeItemTypes: 'Movie,Series',
        Fields:
          'ProviderIds,DateCreated,PremiereDate,ProductionYear,Genres,SortName',
        EnableImages: false,
      },
    });
    return r.Items;
  }

  public async episodios(bibliotecaId: string): Promise<EmbyElemento[]> {
    const r = await this.get<EmbyRespuesta>('/Items', {
      params: {
        ParentId: bibliotecaId,
        Recursive: true,
        IncludeItemTypes: 'Episode',
        Fields: 'DateCreated,SeriesId,ParentIndexNumber,IndexNumber,Path',
        EnableImages: false,
      },
    });
    return r.Items;
  }

  // Peliculas y episodios vistos (IsPlayed) o empezados (IsResumable) por un
  // usuario. Si no tiene acceso a la biblioteca, Emby devuelve error -> [].
  public async reproducidos(
    embyUserId: string,
    bibliotecaId: string,
    filtro: 'IsPlayed' | 'IsResumable'
  ): Promise<EmbyElemento[]> {
    try {
      const r = await this.get<EmbyRespuesta>(`/Users/${embyUserId}/Items`, {
        params: {
          ParentId: bibliotecaId,
          Recursive: true,
          IncludeItemTypes: 'Movie,Episode',
          Filters: filtro,
          Fields: 'SeriesId,ParentIndexNumber,UserDataLastPlayedDate',
          EnableImages: false,
        },
      });
      return r.Items;
    } catch {
      return [];
    }
  }

  public async usuariosEmby(): Promise<EmbyUsuario[]> {
    return this.get<EmbyUsuario[]>('/Users');
  }
}

export default EmbyBiblioteca;
