/** Cuanta gente concurrio a un local. */
export interface LocalConcurrencia {
  nombre: string;         // nombre normalizado (del listado conocido)
  nombreOriginal: string; // como vino en el mensaje (puede tener typos)
  cantidad: number;       // personas contadas
}

export interface Relevamiento {
  fecha: Date;
  remitente: string;
  locales: LocalConcurrencia[];
  textoOriginal: string;
}
