import { appIcon, foregroundFor } from './appIcons';

/** Recuadro con el logo de la app sobre el color de su marca. */
export function AppIcon({ name }: { name: string }) {
  const spec = appIcon(name);
  const foreground = foregroundFor(spec.color);

  return (
    <span className="app-icon" style={{ backgroundColor: spec.color, color: foreground }} aria-hidden="true">
      {spec.type === 'logo' ? (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d={spec.path} />
        </svg>
      ) : (
        <span className="app-icon__initials">{spec.text}</span>
      )}
    </span>
  );
}
