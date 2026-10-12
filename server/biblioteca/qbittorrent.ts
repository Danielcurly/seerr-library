import type { ConexionQbittorrent } from '@server/biblioteca/ajustes';
import axios from 'axios';

// Cliente minimo de la API web de qBittorrent (v2) para el borrador

export interface TorrentQbt {
  hash: string;
  name: string;
  // 0-1
  progress: number;
  ratio: number;
  // Segundos compartiendo (qBittorrent >= 4.1); si falta, desde que termino
  seeding_time?: number;
  completion_on?: number;
  save_path: string;
  content_path?: string;
}

export class QBittorrent {
  private cookie = '';

  constructor(private conexion: ConexionQbittorrent) {}

  private get base(): string {
    return this.conexion.url.replace(/\/+$/, '') + '/api/v2';
  }

  private get cabeceras() {
    return {
      // qBittorrent rechaza las peticiones sin un Referer de su propio origen
      Referer: this.conexion.url,
      ...(this.cookie ? { Cookie: this.cookie } : {}),
    };
  }

  // Sin usuario: qBittorrent sin autenticacion (red de confianza)
  public async entrar(): Promise<void> {
    if (!this.conexion.usuario) return;
    const r = await axios.post<string>(
      `${this.base}/auth/login`,
      new URLSearchParams({
        username: this.conexion.usuario,
        password: this.conexion.contrasena,
      }),
      { headers: this.cabeceras, timeout: 15000 }
    );
    const sid = (r.headers['set-cookie'] ?? [])
      .map((c) => c.split(';')[0])
      .find((c) => c.startsWith('SID='));
    if (r.data !== 'Ok.' || !sid) {
      throw new Error('qBittorrent rejected the username or password');
    }
    this.cookie = sid;
  }

  public async version(): Promise<string> {
    return (
      await axios.get<string>(`${this.base}/app/version`, {
        headers: this.cabeceras,
        timeout: 15000,
      })
    ).data;
  }

  public async torrents(hashes: string[]): Promise<TorrentQbt[]> {
    if (!hashes.length) return [];
    return (
      await axios.get<TorrentQbt[]>(`${this.base}/torrents/info`, {
        params: { hashes: hashes.join('|') },
        headers: this.cabeceras,
        timeout: 30000,
      })
    ).data;
  }

  public async borrar(hashes: string[], conFicheros: boolean): Promise<void> {
    if (!hashes.length) return;
    await axios.post(
      `${this.base}/torrents/delete`,
      new URLSearchParams({
        hashes: hashes.join('|'),
        deleteFiles: String(conFicheros),
      }),
      { headers: this.cabeceras, timeout: 30000 }
    );
  }
}

export const segundosCompartiendo = (t: TorrentQbt): number =>
  t.seeding_time ??
  (t.completion_on && t.completion_on > 0
    ? Math.max(0, Date.now() / 1000 - t.completion_on)
    : 0);
