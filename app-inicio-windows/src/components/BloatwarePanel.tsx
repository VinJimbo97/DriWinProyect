import { useState, type ReactNode } from 'react';
import type { ApiRequestError } from '../api/client';
import type { BloatwareRiskLevel, BloatwareRule, ProfileName } from '../api/types';
import { useBloatwareCleanup, installedPackages, type RuleResult } from '../hooks/useBloatwareCleanup';
import { useBloatwareRules } from '../hooks/useBloatwareRules';
import { useSettings } from '../settings/settingsContext';
import { HelpTip } from './HelpTip';

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
  const { t } = useSettings();
  const riskLabel = (risk: BloatwareRiskLevel) => t(`bloat.risk.${risk}`);
  const rulesState = useBloatwareRules(profiles);
  const rules = rulesState.status === 'success' ? rulesState.data.data : null;
  const { detection, results, running, clean } = useBloatwareCleanup(rules);

  // Sólo se guardan los cambios del usuario; lo demás sale de la política del perfil.
  const [overrides, setOverrides] = useState<Map<number, boolean>>(new Map());
  const [confirming, setConfirming] = useState(false);

  if (rulesState.status === 'error') {
    return (
      <div className="bloat-scroll">
        <h2>{t('bloat.title')}</h2>
        {renderApiError(rulesState.error, rulesState.reload)}
      </div>
    );
  }
  if (rulesState.status !== 'success' || !rules) {
    return (
      <div className="bloat-scroll">
        <h2>{t('bloat.title')}</h2>
        <p style={{ opacity: 0.7 }}>{t('common.loadingServer')}</p>
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
        <h2 style={{ marginBottom: 4 }}>{t('bloat.title')}</h2>
        <p className="bloat-subtitle">{t('bloat.byProfile', { profile: profileTitle })}</p>
        <p className="bloat-info">
          {t('bloat.infoBefore')} <span className="help-tip help-tip--inline">?</span> {t('bloat.infoAfter')}
        </p>

        {detection.status === 'detecting' && <p style={{ opacity: 0.7 }}>{t('bloat.detecting')}</p>}
        {detection.status === 'error' && (
          <p className="bloat-error">{t('bloat.detectError', { message: detection.message })}</p>
        )}
        {detection.status === 'unavailable' && (
          <p className="bloat-note">{t('bloat.browserCatalog')}</p>
        )}

        {detection.status === 'done' && visible.length === 0 && (
          <div className="bloat-empty">{t('bloat.nothingToClean')}</div>
        )}

        {detection.status !== 'detecting' &&
          groups.map((group) => (
            <section key={group.risk} className="bloat-group">
              <h3 className={`bloat-group__title risk-${group.risk.toLowerCase()}`}>
                {riskLabel(group.risk)} <span>({group.rules.length})</span>
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
            {notInstalledCount > 0 && `${t('bloat.notInstalled', { count: notInstalledCount })} `}
            {hiddenByProfile > 0 && t('bloat.hiddenByProfile', { count: hiddenByProfile })}
          </p>
        )}
      </div>

      <div className="bloat-footer">
        <div className="bloat-footer__status">
          {running
            ? t('bloat.running')
            : processed.length > 0
              ? failedCount > 0
                ? t('bloat.doneSummaryFailed', { removed: removedCount, failed: failedCount })
                : t('bloat.doneSummary', { removed: removedCount })
              : t('bloat.selectedCount', { count: selected.length })}
        </div>
        <button
          className="btn-action btn-danger"
          disabled={!canClean || selected.length === 0 || running}
          onClick={() => setConfirming(true)}
        >
          {running ? t('bloat.cleaning') : t('bloat.runCleanup')}
        </button>
      </div>

      {confirming && (
        <div className="overlay-modal" onClick={() => setConfirming(false)}>
          <div className="modal-box" onClick={(event) => event.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>
              {selected.length === 1 ? t('bloat.confirmTitleOne') : t('bloat.confirmTitleMany', { count: selected.length })}
            </h2>
            <p style={{ opacity: 0.8, fontSize: '0.9rem' }}>{t('bloat.confirmText')}</p>
            <ul className="bloat-confirm-list">
              {selected.map((rule) => (
                <li key={rule.bloatware_id}>
                  {rule.app_display_name}
                  {rule.risk_level !== 'BAJO' && (
                    <span className={`risk-badge risk-${rule.risk_level.toLowerCase()}`}>{riskLabel(rule.risk_level)}</span>
                  )}
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn-action" onClick={() => setConfirming(false)}>{t('common.cancel')}</button>
              <button className="btn-action btn-danger" onClick={() => void runCleanup()}>
                {t('bloat.confirmYes')}
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
  const { t } = useSettings();
  const riskLabel = t(`bloat.risk.${rule.risk_level}`);
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
            footer={`${riskLabel}: ${t(`bloat.riskHelp.${rule.risk_level}`)}`}
          >
            {rule.help_text || rule.description}
          </HelpTip>
          {rule.risk_level !== 'BAJO' && (
            <span className={`risk-badge risk-${rule.risk_level.toLowerCase()}`}>{riskLabel}</span>
          )}
        </div>
        <div className="bloat-row__desc">{rule.description}</div>
        {unsupported && <div className="bloat-row__desc">{t('bloat.updateToRemove')}</div>}
        {result?.status === 'failed' && <div className="bloat-row__error">✗ {result.message}</div>}
      </div>
      {result?.status === 'removed' && <span className="bloat-row__done">{t('bloat.removed')}</span>}
    </div>
  );
}
