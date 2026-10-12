import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Lo que cada usuario ha dicho de una pelicula (temporada = -1) o de una
// temporada de serie. Una sola marca por usuario y unidad.
export const TIPOS_MARCA = [
  // Pide borrarla (entrada A)
  'borrar',
  // No la va a ver: es un voto para la entrada B
  'no_interesa',
  // La saca de la lista hasta que la vea o pasen unos meses
  'quiero_ver',
  // La protege mientras no se quite
  'guardar',
] as const;
export type TipoMarca = (typeof TIPOS_MARCA)[number];

@Entity({ name: 'biblioteca_marca' })
@Index(['userId', 'embyId', 'temporada'], { unique: true })
export class BibliotecaMarca {
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

  @Column({ type: 'varchar' })
  public tipo: TipoMarca;

  @CreateDateColumn()
  public createdAt: Date;

  constructor(init?: Partial<BibliotecaMarca>) {
    Object.assign(this, init);
  }
}
