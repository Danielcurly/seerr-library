import type { MigrationInterface, QueryRunner } from 'typeorm';

// Pausa cuando alguien empieza a verla, estado de ejecucion (ejecutor), ids
// de Radarr/Sonarr, actividad de cualquier cuenta de Emby y el tutorial. "Que se
// borre" (conforme) pasa a ser "No me interesa".
export class BibliotecaEjecucion1792100000000 implements MigrationInterface {
  name = 'BibliotecaEjecucion1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "biblioteca_candidata" ADD COLUMN "pausadaDesde" datetime`
    );
    await queryRunner.query(
      `ALTER TABLE "biblioteca_candidata" ADD COLUMN "esperaHasta" datetime`
    );
    await queryRunner.query(
      `ALTER TABLE "biblioteca_candidata" ADD COLUMN "ejecucion" varchar`
    );
    await queryRunner.query(
      `ALTER TABLE "biblioteca_candidata" ADD COLUMN "nota" text`
    );
    await queryRunner.query(
      `ALTER TABLE "biblioteca_elemento" ADD COLUMN "arrId" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "biblioteca_elemento" ADD COLUMN "arrServidor" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "biblioteca_elemento" ADD COLUMN "ruta" varchar`
    );
    await queryRunner.query(
      `ALTER TABLE "biblioteca_elemento" ADD COLUMN "actividad" text NOT NULL DEFAULT ('{}')`
    );
    await queryRunner.query(
      `ALTER TABLE "biblioteca_temporada" ADD COLUMN "actividad" text NOT NULL DEFAULT ('{}')`
    );
    await queryRunner.query(
      `ALTER TABLE "biblioteca_usuario" ADD COLUMN "tutorialVisto" datetime`
    );
    await queryRunner.query(
      `ALTER TABLE "biblioteca_historial" ADD COLUMN "nota" text`
    );
    await queryRunner.query(
      `UPDATE "biblioteca_marca" SET "tipo" = 'no_interesa' WHERE "tipo" = 'conforme'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [tabla, columna] of [
      ['biblioteca_candidata', 'pausadaDesde'],
      ['biblioteca_candidata', 'esperaHasta'],
      ['biblioteca_candidata', 'ejecucion'],
      ['biblioteca_candidata', 'nota'],
      ['biblioteca_elemento', 'arrId'],
      ['biblioteca_elemento', 'arrServidor'],
      ['biblioteca_elemento', 'ruta'],
      ['biblioteca_elemento', 'actividad'],
      ['biblioteca_temporada', 'actividad'],
      ['biblioteca_usuario', 'tutorialVisto'],
      ['biblioteca_historial', 'nota'],
    ]) {
      await queryRunner.query(
        `ALTER TABLE "${tabla}" DROP COLUMN "${columna}"`
      );
    }
  }
}
