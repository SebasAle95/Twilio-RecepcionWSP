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
  /**
   * Cuando se hizo el conteo, si el mensaje lo declaro con "hora HH:MM".
   *
   * Formato "DD-MM-YYYY HH:MM:SS". Sirve para las cargas retroactivas: sin
   * esto, tres turnos de un mismo dia cargados uno atras del otro quedarian
   * los tres con la hora en que se mandaron los mensajes.
   */
  momento?: string;
}
