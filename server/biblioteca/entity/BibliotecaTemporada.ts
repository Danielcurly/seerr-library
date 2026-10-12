import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Temporada descargada de una serie (episodios con fichero en Emby).
@Entity({ name: 'biblioteca_temporada' })
@Index(['embyId', 'numero'], { unique: true })
export class BibliotecaTemporada {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'varchar' })
  public embyId: string;

  @Column({ type: 'integer' })
  public numero: number;

  @Column({ type: 'integer' })
  public episodios: number;

  @Column({ type: 'integer', default: 0 })
  public tamano: number;

  @Column({ type: 'datetime' })
  public fechaDescarga: Date;

  // Lo reproducido por cada cuenta de Emby (JSON Actividad): completa = todos
  // los episodios descargados vistos
  @Column({ type: 'text', default: '{}' })
  public actividad: string;

  constructor(init?: Partial<BibliotecaTemporada>) {
    Object.assign(this, init);
  }
}
