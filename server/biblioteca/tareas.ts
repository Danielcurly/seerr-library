import { leerAjuste } from '@server/biblioteca/ajustes';
import { borradorBiblioteca } from '@server/biblioteca/borrador';
import { evaluadorBiblioteca } from '@server/biblioteca/evaluar';
import { calculadorNovedades } from '@server/biblioteca/novedades';
import { sincronizadorBiblioteca } from '@server/biblioteca/sync';
import logger from '@server/logger';
import schedule from 'node-schedule';

// Tareas del modulo Biblioteca. Se programan aqui y no en server/job/schedule.ts
// para no tocar los ajustes de tareas de Seerr.
export const iniciarTareasBiblioteca = (): void => {
  // Cada hora, a y 20, y despues se revisa la lista: si alguien ha empezado a
  // ver una serie de la lista, su cuenta atras se para cuanto antes. Las
  // novedades de las series (TMDB), cada pocas horas.
  schedule.scheduleJob('0 20 * * * *', async () => {
    await sincronizadorBiblioteca.run();
    await evaluadorBiblioteca.run().catch(() => undefined);
    await calculadorNovedades.siToca();
  });

  // Borrado de lo vencido (modo arr), a la hora indicada en los ajustes
  schedule.scheduleJob('0 0 * * * *', async () => {
    const { modo, hora } = await leerAjuste('ejecucion');
    if (modo === 'arr' && new Date().getHours() === hora) {
      await borradorBiblioteca.run();
    }
  });

  // Primera foto al arrancar si nunca se ha hecho
  setTimeout(async () => {
    try {
      if (!(await leerAjuste('sync')).ultima) {
        await sincronizadorBiblioteca.run();
      }
      if (!(await leerAjuste('evaluacion')).ultima) {
        await evaluadorBiblioteca.run();
      }
      if (!(await leerAjuste('novedades')).ultima) {
        // El progreso de cada usuario sale de la sincronizacion
        await sincronizadorBiblioteca.run();
        await calculadorNovedades.run();
      }
    } catch (e) {
      logger.error(
        `No se pudo lanzar la primera sincronizacion: ${e.message}`,
        { label: 'Biblioteca' }
      );
    }
  }, 60 * 1000);
};
