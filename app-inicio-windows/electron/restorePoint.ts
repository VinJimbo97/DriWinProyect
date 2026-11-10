import { EXIT_UAC_DENIED, runElevatedScript, type ElevatedRunner } from './elevated.js';

/**
 * Punto de restauración de Windows antes de la limpieza de riesgo alto.
 * Si algo sale mal, la persona vuelve atrás desde "Crear un punto de
 * restauración → Restaurar sistema" de Windows.
 *
 * Reglas de Windows que hay que respetar:
 *  - Necesita administrador (un aviso de UAC).
 *  - La "Protección del sistema" debe estar activada en el disco de Windows:
 *    si está desactivada, DriWin la activa (la persona lo acepta antes).
 *  - Windows crea como máximo un punto cada 24 horas: si ya hay uno de las
 *    últimas 24 horas, ese sirve y no se crea otro.
 */

export type RestorePointStatus = 'created' | 'recent' | 'disabled' | 'denied' | 'failed';

export interface RestorePointResult {
  ok: boolean;
  status: RestorePointStatus;
  message: string;
}

const EXIT = { CREATED: 0, RECENT: 10, DISABLED: 20, FAILED: 30 } as const;

const MESSAGES: Record<RestorePointStatus, string> = {
  created: 'Se creó un punto de restauración de Windows.',
  recent: 'Ya existe un punto de restauración de las últimas 24 horas: se usará ese.',
  disabled: 'No se pudo activar la Protección del sistema en el disco de Windows, así que no hay punto de restauración.',
  denied: 'Cancelaste el permiso de administrador, así que no se creó el punto de restauración.',
  failed: 'Windows no pudo crear el punto de restauración.',
};

export const RESTORE_POINT_SCRIPT = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
  $drive = $env:SystemDrive + '\\'
  $before = @(Get-ComputerRestorePoint -ErrorAction SilentlyContinue) | Sort-Object SequenceNumber | Select-Object -Last 1
  try { Enable-ComputerRestore -Drive $drive } catch { exit ${EXIT.DISABLED} }
  Checkpoint-Computer -Description 'DriWin: antes de la limpieza de riesgo alto' -RestorePointType 'MODIFY_SETTINGS' -WarningAction SilentlyContinue
  $after = @(Get-ComputerRestorePoint -ErrorAction SilentlyContinue) | Sort-Object SequenceNumber | Select-Object -Last 1
  if ($after -and (-not $before -or $after.SequenceNumber -gt $before.SequenceNumber)) { exit ${EXIT.CREATED} }
  if ($after) {
    $created = $after.ConvertToDateTime($after.CreationTime)
    if (((Get-Date) - $created).TotalHours -lt 24) { exit ${EXIT.RECENT} }
  }
  exit ${EXIT.FAILED}
} catch {
  exit ${EXIT.FAILED}
}
`;

export function interpretRestorePointCode(code: number): RestorePointResult {
  const status: RestorePointStatus =
    code === EXIT.CREATED
      ? 'created'
      : code === EXIT.RECENT
        ? 'recent'
        : code === EXIT.DISABLED
          ? 'disabled'
          : code === EXIT_UAC_DENIED
            ? 'denied'
            : 'failed';
  return { ok: status === 'created' || status === 'recent', status, message: MESSAGES[status] };
}

export async function createRestorePoint(run?: ElevatedRunner): Promise<RestorePointResult> {
  try {
    // Crear el punto puede tardar varios minutos en discos lentos.
    return interpretRestorePointCode(await runElevatedScript(RESTORE_POINT_SCRIPT, 15 * 60_000, run));
  } catch {
    return interpretRestorePointCode(EXIT.FAILED);
  }
}
