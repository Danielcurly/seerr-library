import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// nueva: episodios ya emitidos despues de lo ultimo que vio el usuario;
// proxima: lo siguiente que se va a emitir (temporada anunciada o proximo
// episodio), cuando no hay nada nuevo emitido.
export type TipoNovedad = 'nueva' | 'proxima';

// Novedades de las series que ve cada usuario, por temporada. Se recalcula
// cada pocas horas con TMDB; al pedirlas se descartan las que el usuario ya
// ha empezado a ver.
@Entity({ name: 'biblioteca_novedad' })
@Index(['userId', 'tmdbId'])
export class BibliotecaNovedad {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'integer' })
  public userId: number;

  @Column({ type: 'integer' })
  public tmdbId: number;

  @Column({ type: 'integer', nullable: true })
  public tvdbId: number | null;

  @Column({ type: 'varchar' })
  public titulo: string;

  @Column({ type: 'varchar' })
  public tipo: TipoNovedad;

  @Column({ type: 'integer' })
  public temporada: number;

  // Episodios nuevos de esa temporada (desde-hasta, ambos incluidos)
  @Column({ type: 'integer' })
  public desde: number;

  @Column({ type: 'integer' })
  public hasta: number;

  // nueva: emitidos en la temporada (todos, para saber si esta descargada)
  @Column({ type: 'integer', default: 0 })
  public emitidos: number;

  // nueva: el mas reciente emitido; proxima: cuando se emite
  @Column({ type: 'datetime', nullable: true })
  public fecha: Date | null;

  // La temporada ya se ha emitido entera (o TMDB no anuncia mas episodios)
  @Column({ type: 'boolean', default: false })
  public completa: boolean;

  constructor(init?: Partial<BibliotecaNovedad>) {
    Object.assign(this, init);
  }
}
