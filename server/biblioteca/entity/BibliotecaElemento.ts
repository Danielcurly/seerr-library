import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

// Pelicula o serie de una biblioteca de Emby incluida en el sistema. La tabla se
// rehace en cada sincronizacion: es una foto de Emby + Radarr/Sonarr.
// Cuenta de Emby -> ultima reproduccion (ISO) y si la termino
export type Actividad = Record<
  string,
  { ultima: string | null; completa: boolean }
>;

@Entity({ name: 'biblioteca_elemento' })
export class BibliotecaElemento {
  @PrimaryColumn({ type: 'varchar' })
  public embyId: string;

  @Column({ type: 'varchar' })
  public tipo: 'movie' | 'tv';

  @Index()
  @Column({ type: 'integer', nullable: true })
  public tmdbId: number | null;

  @Column({ type: 'integer', nullable: true })
  public tvdbId: number | null;

  // Media de Seerr, si existe
  @Index()
  @Column({ type: 'integer', nullable: true })
  public mediaId: number | null;

  @Index()
  @Column({ type: 'varchar' })
  public bibliotecaId: string;

  @Column({ type: 'varchar' })
  public titulo: string;

  @Column({ type: 'varchar' })
  public tituloOrden: string;

  @Column({ type: 'integer', nullable: true })
  public anio: number | null;

  // JSON: string[]
  @Column({ type: 'text', default: '[]' })
  public generos: string;

  // Alta en Emby (peliculas) o del primer episodio (series)
  @Column({ type: 'datetime' })
  public fechaAlta: Date;

  // Estreno (Emby PremiereDate; si falta, 1 de enero de `anio`)
  @Column({ type: 'datetime', nullable: true })
  public fechaEstreno: Date | null;

  // Primera vez que estuvo disponible: la mas antigua entre el alta en Emby y
  // la primera importacion de Radarr (una mejora de calidad no la cambia).
  // Series: la del episodio mas reciente.
  @Index()
  @Column({ type: 'datetime' })
  public fechaDescarga: Date;

  // Bytes en disco segun Radarr/Sonarr (0 si no lo gestionan)
  @Column({ type: 'integer', default: 0 })
  public tamano: number;

  // Ultima reproduccion de cualquier usuario
  @Column({ type: 'datetime', nullable: true })
  public ultimaReproduccion: Date | null;

  // Esta en Radarr/Sonarr: solo lo gestionado puede entrar en la lista
  @Column({ type: 'boolean', default: false })
  public gestionado: boolean;

  // Pelicula con la etiqueta de Radarr de los ajustes (etiquetaRadarr): entra
  // en la lista con su propio plazo (antiguedadEtiquetaMeses)
  @Column({ type: 'boolean', default: false })
  public conEtiqueta: boolean;

  // Pelicula de Radarr o serie de Sonarr (id en esa *arr y servidor de Seerr)
  @Column({ type: 'integer', nullable: true })
  public arrId: number | null;

  @Column({ type: 'integer', nullable: true })
  public arrServidor: number | null;

  // Carpeta segun Radarr/Sonarr
  @Column({ type: 'varchar', nullable: true })
  public ruta: string | null;

  // Peliculas: lo reproducido por cada cuenta de Emby, tambien las que no
  // estan en Seerr (JSON Actividad)
  @Column({ type: 'text', default: '{}' })
  public actividad: string;

  constructor(init?: Partial<BibliotecaElemento>) {
    Object.assign(this, init);
  }
}
