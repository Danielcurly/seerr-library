import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BibliotecaCatalogo1791800000000 implements MigrationInterface {
  name = 'BibliotecaCatalogo1791800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "biblioteca_elemento" ("embyId" varchar PRIMARY KEY NOT NULL, "tipo" varchar NOT NULL, "tmdbId" integer, "tvdbId" integer, "mediaId" integer, "bibliotecaId" varchar NOT NULL, "titulo" varchar NOT NULL, "tituloOrden" varchar NOT NULL, "anio" integer, "generos" text NOT NULL DEFAULT ('[]'), "fechaAlta" datetime NOT NULL, "fechaDescarga" datetime NOT NULL, "tamano" integer NOT NULL DEFAULT (0), "ultimaReproduccion" datetime)`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_biblioteca_elemento_tmdbId" ON "biblioteca_elemento" ("tmdbId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_biblioteca_elemento_mediaId" ON "biblioteca_elemento" ("mediaId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_biblioteca_elemento_bibliotecaId" ON "biblioteca_elemento" ("bibliotecaId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_biblioteca_elemento_fechaDescarga" ON "biblioteca_elemento" ("fechaDescarga")`
    );
    await queryRunner.query(
      `CREATE TABLE "biblioteca_temporada" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "embyId" varchar NOT NULL, "numero" integer NOT NULL, "episodios" integer NOT NULL, "tamano" integer NOT NULL DEFAULT (0), "fechaDescarga" datetime NOT NULL)`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_biblioteca_temporada_embyId_numero" ON "biblioteca_temporada" ("embyId", "numero")`
    );
    await queryRunner.query(
      `CREATE TABLE "biblioteca_visto" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userId" integer NOT NULL, "embyId" varchar NOT NULL, "temporada" integer NOT NULL, "visto" boolean NOT NULL DEFAULT (0), "episodiosVistos" integer NOT NULL DEFAULT (0), "ultimaReproduccion" datetime)`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_biblioteca_visto_user_emby_temporada" ON "biblioteca_visto" ("userId", "embyId", "temporada")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_biblioteca_visto_userId" ON "biblioteca_visto" ("userId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_biblioteca_visto_embyId" ON "biblioteca_visto" ("embyId")`
    );
    await queryRunner.query(
      `CREATE TABLE "biblioteca_usuario" ("userId" integer PRIMARY KEY NOT NULL, "embyUserId" varchar NOT NULL, "ultimaActividad" datetime, "tieneVoto" boolean NOT NULL DEFAULT (1), "puedeGuardar" boolean NOT NULL DEFAULT (1))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "biblioteca_usuario"`);
    await queryRunner.query(`DROP TABLE "biblioteca_visto"`);
    await queryRunner.query(`DROP TABLE "biblioteca_temporada"`);
    await queryRunner.query(`DROP TABLE "biblioteca_elemento"`);
  }
}
