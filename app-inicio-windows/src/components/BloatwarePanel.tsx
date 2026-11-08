import { useState, type ReactNode } from 'react';
import type { ApiRequestError } from '../api/client';
import type { BloatwareRiskLevel, BloatwareRule, ProfileName } from '../api/types';
import { useBloatwareCleanup, installedPackages, type RuleResult } from '../hooks/useBloatwareCleanup';
import { useBloatwareRules } from '../hooks/useBloatwareRules';
import { HelpTip } from './HelpTip';

const RISK_LABEL: Record<BloatwareRiskLevel, string> = { BAJO: 'Riesgo bajo', MEDIO: 'Riesgo medio', ALTO: 'Riesgo alto' };

const RISK_HELP: Record<BloatwareRiskLevel, string> = {
  BAJO: 'Casi nadie la usa. Se puede volver a instalar desde Microsoft Store.',
  MEDIO: 'Revisa si la usas antes de quitarla. Se puede volver a instalar desde Microsoft Store.',
  ALTO: 'Puede afectar el funcionamiento de Windows.',
};

interface Props {
  profiles: ProfileName[];
  profileTitle: string;
  renderApiError: (error: ApiRequestError, onRetry: () => void) => ReactNode;
}

/**
 * Pestaña "Optimizar Windows": muestra sólo el bloatware que el equipo TIENE,
 * marcado según el perfil, con un "?" que explica cada opción.
 * Se monta con key = perfiles: al cambiar de perfil se reinicia la selección.
 */
export function BloatwarePanel({ profiles, profileTitle, renderApiError }: Props) {
  const rulesState = useBloatwareRules(profiles);
  const rules = rulesState.status === 'success' ? rulesState.data.data : null;
  const { detection, results, running, clean } = useBloatwareCleanup(rules);

  // Sólo se guardan los cambios del usuario; lo demás sale de la política del perfil.
  const [overrides, setOverrides] = useState<Map<number, boolean>>(new Map());
  const [confirming, setConfirming] = useState(false);

  if (rulesState.status === 'error') {
    return (
      <div className="bloat-scroll">
        <h2>Limpieza de Bloatware</h2>
        {renderApiError(rulesState.error, rulesState.reload)}
      </div>
    );
  }
  if (rulesState.status !== 'success' || !rules) {
    return (
      <div className="bloat-scroll">
        <h2>Limpieza de Bloatware</h2>
        <p style={{ opacity: 0.7 }}>Cargando opciones desde el servidor...</p>
      </div>
    );
  }

  const allRules = rules;
  const hiddenByProfile = rulesState.data?.meta.hidden ?? 0;
  const canClean = detection.status === 'done';
  const unsupported = new Set(detection.status === 'done' ? detection.detection.unsupported : []);

  const isUnsupported = (rule: BloatwareRule) => rule.package_names.some((name) => unsupported.has(name));
  const isInstalled = (rule: BloatwareRule) =>
    detection.status === 'done' && installedPackages(rule, detection.detection).length > 0;

  // En el escritorio se muestra lo instalado (y lo recién procesado, para ver su resultado).
  // En el navegador no se puede leer el equipo: se muestra todo el catálogo.
  const visible = allRules.filter((rule) =>
    detection.status === 'done' ? isInstalled(rule) || results[rule.bloatware_id] !== undefined : true,
  );
  const notInstalledCount = detection.status === 'done' ? allRules.length - visible.length : 0;

  const actionable = (rule: BloatwareRule) => !isUnsupported(rule) && results[rule.bloatware_id]?.status !== 'removed';
  const isSelected = (rule: BloatwareRule) =>
    actionable(rule) && (overrides.get(rule.bloatware_id) ?? rule.policy === 'SUGERIDO');
  const selected = visible.filter(isSelected);

  const toggle = (rule: BloatwareRule) => {
    if (!actionable(rule) || running) {
      return;
    }
    setOverrides((prev) => new Map(prev).set(rule.bloatware_id, !isSelected(rule)));
  };

  const runCleanup = async () => {
    setConfirming(false);
    await clean(selected);
    setOverrides(new Map());
  };

  const processed = Object.values(results);
  const removedCount = processed.filter((result) => result.status === 'removed').length;
  const failedCount = processed.filter((result) => result.status === 'failed').length;

  const groups: { risk: BloatwareRiskLevel; rules: BloatwareRule[] }[] = (['BAJO', 'MEDIO', 'ALTO'] as const)
    .map((risk) => ({ risk, rules: visible.filter((rule) => rule.risk_level === risk) }))
    .filter((group) => group.rules.length > 0);

  return (
    <div className="bloat-panel">
      <div className="bloat-scroll">
        <h2 style={{ marginBottom: 4 }}>Limpieza de Bloatware</h2>
        <p className="bloat-subtitle">Según tu perfil: {profileTitle}</p>
        <p className="bloat-info">
          DriWin solo quita apps de Microsoft Store para tu usuario, sin tocar el registro ni los servicios de Windows.
          Todas se pueden volver a instalar desde la Store. Pasa el mouse sobre <span className="help-tip help-tip--inline">?</span> para
          ver qué hace cada una.
        </p>

        {detection.status === 'detecting' && <p style={{ opacity: 0.7 }}>Buscando qué apps tienes instaladas...</p>}
        {detection.status === 'error' && (
          <p className="bloat-error">No se pudo revisar el equipo: {detection.message}</p>
        )}
        {detection.status === 'unavailable' && (
          <p className="bloat-note">
            Estás viendo el catálogo completo: en el navegador no se puede revisar el equipo. La limpieza solo funciona en la app de escritorio.
          </p>
        )}

        {detection.status === 'done' && visible.length === 0 && (
          <div className="bloat-empty">✓ Tu equipo no tiene ninguna de las apps de esta lista. No hay nada que limpiar.</div>
        )}

        {detection.status !== 'detecting' &&
          groups.map((group) => (
            <section key={group.risk} className="bloat-group">
              <h3 className={`bloat-group__title risk-${group.risk.toLowerCase()}`}>
                {RISK_LABEL[group.risk]} <span>({group.rules.length})</span>
              </h3>
              {group.rules.map((rule) => (
                <BloatwareRow
                  key={rule.bloatware_id}
                  rule={rule}
                  selected={isSelected(rule)}
                  disabled={!actionable(rule) || running}
                  unsupported={isUnsupported(rule)}
                  result={results[rule.bloatware_id]}
                  onToggle={() => toggle(rule)}
                />
              ))}
            </section>
          ))}

        {(notInstalledCount > 0 || hiddenByProfile > 0) && (
          <p className="bloat-note">
            {notInstalledCount > 0 && `${notInstalledCount} opciones del catálogo no están instaladas en tu equipo. `}
            {hiddenByProfile > 0 && `${hiddenByProfile} se ocultaron porque tu perfil las usa.`}
          </p>
        )}
      </div>

      <div className="bloat-footer">
        <div className="bloat-footer__status">
          {running
            ? 'Quitando apps... no cierres DriWin.'
            : processed.length > 0
              ? `Listo: ${removedCount} quitadas${failedCount > 0 ? ` · ${failedCount} no se pudieron quitar` : ''}.`
              : `${selected.length} seleccionadas`}
        </div>
        <button
          className="btn-action btn-danger"
          disabled={!canClean || selected.length === 0 || running}
          onClick={() => setConfirming(true)}
        >
          {running ? 'Limpiando...' : 'Ejecutar limpieza'}
        </button>
      </div>

      {confirming && (
        <div className="overlay-modal" onClick={() => setConfirming(false)}>
          <div className="modal-box" onClick={(event) => event.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>¿Quitar {selected.length} {selected.length === 1 ? 'app' : 'apps'}?</h2>
            <p style={{ opacity: 0.8, fontSize: '0.9rem' }}>
              Se quitarán solo para tu usuario. Si después necesitas alguna, la puedes volver a instalar desde Microsoft Store.
            </p>
            <ul className="bloat-confirm-list">
              {selected.map((rule) => (
                <li key={rule.bloatware_id}>
                  {rule.app_display_name}
                  {rule.risk_level !== 'BAJO' && (
                    <span className={`risk-badge risk-${rule.risk_level.toLowerCase()}`}>{RISK_LABEL[rule.risk_level]}</span>
                  )}
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn-action" onClick={() => setConfirming(false)}>Cancelar</button>
              <button className="btn-action btn-danger" onClick={() => void runCleanup()}>
                Sí, quitar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BloatwareRow({
  rule,
  selected,
  disabled,
  unsupported,
  result,
  onToggle,
}: {
  rule: BloatwareRule;
  selected: boolean;
  disabled: boolean;
  unsupported: boolean;
  result: RuleResult | undefined;
  onToggle: () => void;
}) {
  return (
    <div className={`bloat-row ${disabled ? 'disabled' : ''} ${selected ? 'selected' : ''}`} onClick={onToggle}>
      <input
        type="checkbox"
        checked={selected}
        disabled={disabled}
        onChange={onToggle}
        onClick={(event) => event.stopPropagation()}
        aria-label={rule.app_display_name}
      />
      <div className="bloat-row__info">
        <div className="bloat-row__title">
          <strong>{rule.app_display_name}</strong>
          <HelpTip
            title={rule.app_display_name}
            footer={`${RISK_LABEL[rule.risk_level]}: ${RISK_HELP[rule.risk_level]}`}
          >
            {rule.help_text || rule.description}
          </HelpTip>
          {rule.risk_level !== 'BAJO' && (
            <span className={`risk-badge risk-${rule.risk_level.toLowerCase()}`}>{RISK_LABEL[rule.risk_level]}</span>
          )}
        </div>
        <div className="bloat-row__desc">{rule.description}</div>
        {unsupported && <div className="bloat-row__desc">Actualiza DriWin para poder quitar esta app.</div>}
        {result?.status === 'failed' && <div className="bloat-row__error">✗ {result.message}</div>}
      </div>
      {result?.status === 'removed' && <span className="bloat-row__done">✓ Quitada</span>}
    </div>
  );
}
