import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// borrado: solo avisando, vencio su plazo (se habria borrado); si no, el
// ejecutor la borro. espera / error: el ejecutor no pudo borrarla todavia (p. ej.
// tiempo minimo de siembra) o fallo.
export type TipoHistorial = 'borrado' | 'espera' | 'error';

@Entity({ name: 'biblioteca_historial' })
export class BibliotecaHistorial {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'varchar' })
  public tipo: TipoHistorial;

  @Column({ type: 'varchar' })
  public embyId: string;

  @Column({ type: 'integer' })
  public temporada: number;

  @Column({ type: 'varchar' })
  public titulo: string;

  @Column({ type: 'integer', default: 0 })
  public tamano: number;

  @Column({ type: 'varchar', nullable: true })
  public motivo: string | null;

  // espera / error: lo que dijo el ejecutor
  @Column({ type: 'text', nullable: true })
  public nota: string | null;

  // En modo prueba solo se anota: no se toca nada
  @Column({ type: 'boolean', default: true })
  public simulacro: boolean;

  @CreateDateColumn()
  public fecha: Date;

  constructor(init?: Partial<BibliotecaHistorial>) {
    Object.assign(this, init);
  }
}
