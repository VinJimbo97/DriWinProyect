/**
 * "Descargar mis datos" (Ley 21.719: acceso y portabilidad).
 * La interfaz recibe el JSON desde la API y se lo pasa al proceso principal,
 * que pregunta dónde guardarlo (diálogo de Windows) y escribe el archivo.
 *
 * Como el contenido llega desde la interfaz (IPC), se valida antes de tocar el
 * disco: sólo texto JSON válido y de tamaño razonable. La RUTA nunca viene de
 * la interfaz: la elige la persona en el diálogo.
 */

/** Un export real pesa pocos KB; 2 MB deja margen sin permitir abusos. */
export const MAX_EXPORT_BYTES = 2 * 1024 * 1024;

export type ExportContentCheck = { ok: true; content: string } | { ok: false; message: string };

export function checkExportContent(content: unknown): ExportContentCheck {
  if (typeof content !== 'string' || content.length === 0) {
    return { ok: false, message: 'El contenido a guardar no es válido.' };
  }
  if (Buffer.byteLength(content, 'utf8') > MAX_EXPORT_BYTES) {
    return { ok: false, message: 'El archivo es demasiado grande.' };
  }
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, message: 'El contenido a guardar no es válido.' };
    }
  } catch {
    return { ok: false, message: 'El contenido a guardar no es JSON válido.' };
  }
  return { ok: true, content };
}

/** Nombre sugerido: driwin-mis-datos-2026-11-10.json (fecha local). */
export function exportFileName(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `driwin-mis-datos-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}
