/**
 * Los mandos de la experiencia.
 *
 * Todo lo ajustable vive AQUÍ, en un solo objeto de números. Ningún otro
 * archivo guarda una constante que se pueda tocar: la escena lee de este
 * objeto en cada fotograma, así que cambiar un valor y recargar —o moverlo en
 * el panel— se ve al instante.
 *
 * Para probar otros valores: abre la página con `?ajustes`, mueve los
 * deslizadores o compara las cuatro configuraciones, pulsa «Copiar valores» y
 * pega el resultado sobre `AJUSTES`.
 */

export const AJUSTES = {
  /* ── Ritmo ──────────────────────────────────────────────────────── */
  velocidad: 1,          // ritmo general de todo lo que se mueve solo
  movimiento: 1,         // intensidad global del movimiento de cámara

  /* ── Mar y barco ────────────────────────────────────────────────── */
  oleaje: 1,             // altura y nerviosismo de la ola
  balanceo: 1,           // cabeceo y escora del buque
  reflejos: 0.85,        // cuánto devuelve el agua

  /* ── Grúa y contenedor ──────────────────────────────────────────── */
  velocidadGrua: 1,      // ritmo del carro y del spreader
  oscilacion: 1,         // cuánto pendulea la carga al parar el carro

  /* ── Camión ─────────────────────────────────────────────────────── */
  velocidadCamion: 1,
  suspension: 1,         // cuánto trabaja la suspensión en los baches
  trafico: 1,            // densidad del tráfico secundario

  /* ── Cámara y aire ──────────────────────────────────────────────── */
  distanciaCamara: 1,    // <1 acerca la cámara · >1 la echa atrás
  niebla: 1,             // bruma atmosférica: es lo que da la escala
  luz: 1,                // intensidad de todas las luces a la vez
  exposicion: 1,         // diafragma del revelado
  particulas: 1,         // gaviotas, polvo, salpicadura
  detalle: 1,            // multiplica la cantidad de objetos secundarios
};

/**
 * Configuraciones comparables.
 *
 * Sirven para ver de un vistazo qué cambia cada familia de valores. La pública
 * es UNA: «equilibrada», que es la que está arriba en `AJUSTES`.
 */
export const CONFIGURACIONES = {
  equilibrada: { ...AJUSTES },
  cinematografica: {
    velocidad: 0.85, movimiento: 1.25, oleaje: 1.15, balanceo: 1.3, reflejos: 1,
    velocidadGrua: 0.8, oscilacion: 1.35, velocidadCamion: 0.9, suspension: 1.2,
    trafico: 0.8, distanciaCamara: 1.15, niebla: 1.35, luz: 0.95, exposicion: 1.08,
    particulas: 1.2, detalle: 1,
  },
  rendimiento: {
    velocidad: 1, movimiento: 0.8, oleaje: 0.7, balanceo: 0.7, reflejos: 0.35,
    velocidadGrua: 1.1, oscilacion: 0.7, velocidadCamion: 1.1, suspension: 0.7,
    trafico: 0.35, distanciaCamara: 1, niebla: 0.8, luz: 1, exposicion: 1,
    particulas: 0.3, detalle: 0.45,
  },
  presentacion: {
    velocidad: 1.35, movimiento: 1.1, oleaje: 1, balanceo: 1, reflejos: 0.9,
    velocidadGrua: 1.4, oscilacion: 1, velocidadCamion: 1.35, suspension: 1,
    trafico: 1.2, distanciaCamara: 0.92, niebla: 1, luz: 1.08, exposicion: 1.04,
    particulas: 1.1, detalle: 1.15,
  },
};

/** Copia limpia, para el botón de restablecer del panel. */
export const AJUSTES_BASE = { ...AJUSTES };

/** Aplica un objeto de cambios sobre los ajustes vivos. */
export function ajustar(cambios) {
  Object.assign(AJUSTES, cambios);
  return AJUSTES;
}
