import { LOCALES_CONOCIDOS } from '../config/locales';

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

// Umbral: hasta 40% de la longitud del nombre puede ser diferente
const UMBRAL_RATIO = 0.4;

export function matchearLocal(nombreRecibido: string): string {
  const normalizado = normalizar(nombreRecibido);

  let mejorMatch = nombreRecibido;
  let mejorDistancia = Infinity;

  for (const local of LOCALES_CONOCIDOS) {
    const distancia = levenshtein(normalizado, normalizar(local));
    const umbral = Math.floor(local.length * UMBRAL_RATIO);
    if (distancia < mejorDistancia && distancia <= umbral) {
      mejorDistancia = distancia;
      mejorMatch = local;
    }
  }

  return mejorMatch;
}
