import type { UMLTypographyRole } from './types';

export type DiagramTypographyLevel = 'title' | 'body' | 'secondary' | 'connector';

export interface DiagramTypographyScale {
  readonly minimum: number;
  readonly title: number;
  readonly body: number;
  readonly secondary: number;
  readonly connector: number;
}

type RoleRatios = Readonly<Record<DiagramTypographyLevel, number>>;

const ROLE_RATIOS: Readonly<Record<UMLTypographyRole, RoleRatios>> = Object.freeze({
  actor: { title: 1.08, body: 1, secondary: 0.86, connector: 0.94 },
  'use-case': { title: 1.04, body: 1, secondary: 0.86, connector: 0.94 },
  classifier: { title: 1.08, body: 0.96, secondary: 0.84, connector: 0.94 },
  'sequence-participant': { title: 1.06, body: 1, secondary: 0.88, connector: 0.94 },
  'sequence-object': { title: 1.04, body: 0.98, secondary: 0.88, connector: 0.94 },
  'container-title': { title: 1.08, body: 1, secondary: 0.86, connector: 0.94 },
  state: { title: 1.05, body: 1, secondary: 0.88, connector: 0.94 },
  pseudostate: { title: 1, body: 1, secondary: 0.9, connector: 0.94 },
  'activity-action': { title: 1.04, body: 1, secondary: 0.88, connector: 0.94 },
  'object-node': { title: 1.04, body: 0.98, secondary: 0.88, connector: 0.94 },
  'partition-title': { title: 1.08, body: 1, secondary: 0.88, connector: 0.94 },
  'connector-label': { title: 1, body: 1, secondary: 1, connector: 0.94 },
});

function clampFont(value: number, minimum: number): number {
  return Math.max(minimum, Math.min(96, Number.isFinite(value) ? value : 14));
}

/**
 * Shared role-based typography for UML labels. Geometry changes never enter this calculation:
 * the only inputs are a persisted/user-selected base font and the semantic text role.
 */
export function diagramTypography(
  role: UMLTypographyRole,
  baseFontSize = 14,
  minimumFontSize = 12,
): DiagramTypographyScale {
  const minimum = clampFont(Math.max(12, minimumFontSize), 12);
  const base = clampFont(baseFontSize, minimum);
  const ratios = ROLE_RATIOS[role] ?? ROLE_RATIOS.state;
  return {
    minimum,
    title: clampFont(base * ratios.title, minimum),
    body: clampFont(base * ratios.body, minimum),
    secondary: clampFont(base * ratios.secondary, minimum),
    connector: clampFont(base * ratios.connector, minimum),
  };
}

export function diagramFontSize(
  role: UMLTypographyRole,
  level: DiagramTypographyLevel,
  baseFontSize = 14,
  minimumFontSize = 12,
): number {
  return diagramTypography(role, baseFontSize, minimumFontSize)[level];
}
