import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// A: alguien pidio borrarla; B: varios votaron "No me interesa"; C: nadie la
// reproduce; F: la puso el administrador.
export type MotivoCandidata = 'A' | 'B' | 'C' | 'F';

// lista: cuenta atras (o en pausa); listo: vencio el plazo y espera a que el
// ejecutor la borre (Seerr en modo arr o un programa externo).
export type EstadoCandidata = 'lista' | 'listo';

export type EjecucionCandidata = 'espera' | 'error';

// Pelicula (temporada = -1) o temporada de serie en la lista para borrarse.
@Entity({ name: 'biblioteca_candidata' })
@Index(['embyId', 'temporada'], { unique: true })
export class BibliotecaCandidata {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'varchar' })
  public embyId: string;

  @Column({ type: 'integer' })
  public temporada: number;

  @Column({ type: 'varchar' })
  public motivo: MotivoCandidata;

  // A y B: ids de quien pidio borrarla o voto (JSON number[])
  @Column({ type: 'text', default: '[]' })
  public pedidoPor: string;

  @Column({ type: 'varchar' })
  public estado: EstadoCandidata;

  @Column({ type: 'datetime' })
  public entrada: Date;

  @Column({ type: 'datetime' })
  public vence: Date;

  // Alguien empezo a verla (series): la cuenta atras esta parada desde aqui
  @Column({ type: 'datetime', nullable: true })
  public pausadaDesde: Date | null;

  // Lo que dijo el ejecutor al intentar borrarla: espera (p. ej. tiempo minimo
  // de siembra, hasta esperaHasta) o error. nota: el detalle.
  @Column({ type: 'varchar', nullable: true })
  public ejecucion: EjecucionCandidata | null;

  @Column({ type: 'datetime', nullable: true })
  public esperaHasta: Date | null;

  @Column({ type: 'text', nullable: true })
  public nota: string | null;

  constructor(init?: Partial<BibliotecaCandidata>) {
    Object.assign(this, init);
  }
}
