import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Hasta donde ha visto cada usuario cada serie (por TMDB). No se rehace en la
// sincronizacion: sobrevive a que se borren sus temporadas, para avisar de las
// novedades aunque la serie ya no este en el disco.
@Entity({ name: 'biblioteca_progreso' })
export class BibliotecaProgreso {
  @PrimaryColumn({ type: 'integer' })
  public userId: number;

  @PrimaryColumn({ type: 'integer' })
  public tmdbId: number;

  @Column({ type: 'integer', nullable: true })
  public tvdbId: number | null;

  @Column({ type: 'varchar' })
  public titulo: string;

  // Episodio mas avanzado que ha visto o empezado
  @Column({ type: 'integer' })
  public temporada: number;

  @Column({ type: 'integer' })
  public episodio: number;

  // Episodios vistos enteros de esa temporada
  @Column({ type: 'integer', default: 0 })
  public vistosTemporada: number;

  // Cuando vio ese episodio
  @Column({ type: 'datetime', nullable: true })
  public fechaPunto: Date | null;

  // "No avisarme más" de esta serie
  @Column({ type: 'boolean', default: false })
  public silenciada: boolean;

  @UpdateDateColumn()
  public updatedAt: Date;

  constructor(init?: Partial<BibliotecaProgreso>) {
    Object.assign(this, init);
  }
}
