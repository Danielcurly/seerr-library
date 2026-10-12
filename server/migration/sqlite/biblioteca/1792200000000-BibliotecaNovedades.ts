import type { MigrationInterface, QueryRunner } from 'typeorm';

// Novedades de las series que ve cada usuario (progreso persistente y
// novedades calculadas con TMDB), peliculas con etiqueta de Radarr y
// fin de "¿seguirás viendo la serie?": el ejecutor deja de seguir la serie al
// borrar su temporada mas reciente. El tutorial vuelve a salir a todos.
export class BibliotecaNovedades1792200000000 implements MigrationInterface {
  name = 'BibliotecaNovedades1792200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "biblioteca_progreso" ("userId" integer NOT NULL, "tmdbId" integer NOT NULL, "tvdbId" integer, "titulo" varchar NOT NULL, "temporada" integer NOT NULL, "episodio" integer NOT NULL, "vistosTemporada" integer NOT NULL DEFAULT (0), "fechaPunto" datetime, "silenciada" boolean NOT NULL DEFAULT (0), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), PRIMARY KEY ("userId", "tmdbId"))`
    );
    await queryRunner.query(
      `CREATE TABLE "biblioteca_novedad" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userId" integer NOT NULL, "tmdbId" integer NOT NULL, "tvdbId" integer, "titulo" varchar NOT NULL, "tipo" varchar NOT NULL, "temporada" integer NOT NULL, "desde" integer NOT NULL, "hasta" integer NOT NULL, "emitidos" integer NOT NULL DEFAULT (0), "fecha" datetime, "completa" boolean NOT NULL DEFAULT (0))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_biblioteca_novedad_usuario" ON "biblioteca_novedad" ("userId", "tmdbId")`
    );
    await queryRunner.query(
      `ALTER TABLE "biblioteca_elemento" ADD COLUMN "keepalive" boolean NOT NULL DEFAULT (0)`
    );
    await queryRunner.query(
      `ALTER TABLE "biblioteca_elemento" DROP COLUMN "sonarrSigue"`
    );
    await queryRunner.query(`DROP TABLE "biblioteca_seguir"`);
    await queryRunner.query(
      `DELETE FROM "biblioteca_historial" WHERE "tipo" IN ('dejar_seguir', 'reanudar_seguir')`
    );
    await queryRunner.query(
      `DELETE FROM "biblioteca_ajuste" WHERE "clave" IN ('dejaDeSeguir', 'seguimientoAplicado')`
    );
    await queryRunner.query(
      `UPDATE "biblioteca_usuario" SET "tutorialVisto" = NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "biblioteca_seguir" ("userId" integer NOT NULL, "embyId" varchar NOT NULL, "sigue" boolean NOT NULL, "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), PRIMARY KEY ("userId", "embyId"))`
    );
    await queryRunner.query(
      `ALTER TABLE "biblioteca_elemento" ADD COLUMN "sonarrSigue" boolean NOT NULL DEFAULT (0)`
    );
    await queryRunner.query(
      `ALTER TABLE "biblioteca_elemento" DROP COLUMN "keepalive"`
    );
    await queryRunner.query(`DROP INDEX "IDX_biblioteca_novedad_usuario"`);
    await queryRunner.query(`DROP TABLE "biblioteca_novedad"`);
    await queryRunner.query(`DROP TABLE "biblioteca_progreso"`);
  }
}
