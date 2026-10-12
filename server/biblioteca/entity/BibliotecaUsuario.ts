import { Column, Entity, PrimaryColumn } from 'typeorm';

// Usuario de Seerr con cuenta de Emby: actividad y permisos del modulo.
@Entity({ name: 'biblioteca_usuario' })
export class BibliotecaUsuario {
  // id del usuario de Seerr
  @PrimaryColumn({ type: 'integer' })
  public userId: number;

  @Column({ type: 'varchar' })
  public embyUserId: string;

  @Column({ type: 'datetime', nullable: true })
  public ultimaActividad: Date | null;

  @Column({ type: 'boolean', default: true })
  public tieneVoto: boolean;

  @Column({ type: 'boolean', default: true })
  public puedeGuardar: boolean;

  // Cuando vio (o cerro) el tutorial; null = se le abre al entrar
  @Column({ type: 'datetime', nullable: true })
  public tutorialVisto: Date | null;

  constructor(init?: Partial<BibliotecaUsuario>) {
    Object.assign(this, init);
  }
}
