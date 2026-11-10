/**
 * Zod 4 reemplazó `required_error` / `invalid_type_error` (zod 3) por una sola
 * opción `error`. Este helper conserva el comportamiento anterior:
 * - `requerido`: mensaje cuando el campo NO viene (input undefined).
 * - `tipoInvalido` (opcional): mensaje cuando viene con un tipo incorrecto.
 * Si no hay mensaje para el caso, se devuelve undefined y zod usa su mensaje por defecto.
 */
export function requerido(requeridoMsg: string, tipoInvalido?: string) {
  return {
    error: (issue: { input?: unknown }) =>
      issue.input === undefined ? requeridoMsg : tipoInvalido,
  };
}
