import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Lo reproducido por cada usuario de Seerr: una fila por pelicula
// (temporada = -1) o por temporada de serie con alguna actividad.
@Entity({ name: 'biblioteca_visto' })
@Index(['userId', 'embyId', 'temporada'], { unique: true })
export class BibliotecaVisto {
  public static readonly PELICULA = -1;

  @PrimaryGeneratedColumn()
  public id: number;

  @Index()
  @Column({ type: 'integer' })
  public userId: number;

  @Index()
  @Column({ type: 'varchar' })
  public embyId: string;

  @Column({ type: 'integer' })
  public temporada: number;

  // Pelicula vista, o todos los episodios descargados de la temporada vistos
  @Column({ type: 'boolean', default: false })
  public visto: boolean;

  @Column({ type: 'integer', default: 0 })
  public episodiosVistos: number;

  @Column({ type: 'datetime', nullable: true })
  public ultimaReproduccion: Date | null;

  constructor(init?: Partial<BibliotecaVisto>) {
    Object.assign(this, init);
  }
}
