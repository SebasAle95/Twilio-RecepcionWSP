export interface LocalVenta {
  nombre: string;         // nombre normalizado (del listado conocido)
  nombreOriginal: string; // como vino en el mensaje (puede tener typos)
  cantidad: number;
}

export interface Relevamiento {
  fecha: Date;
  remitente: string;
  locales: LocalVenta[];
  textoOriginal: string;
}
