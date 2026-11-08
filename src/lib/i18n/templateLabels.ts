import type { TranslationKey } from './index';

// Presentation only: factory names and generated project data stay unchanged.
export const templateLabels: Record<string, { name: TranslationKey; description: TranslationKey }> = {
  "Mieszkanie M2": { name: 'templates.plM2.name', description: 'templates.plM2.description' },
  "Mieszkanie M3": { name: 'templates.plM3.name', description: 'templates.plM3.description' },
  "Dom parterowy": { name: 'templates.plSingle.name', description: 'templates.plSingle.description' },
  "Dom z poddaszem użytkowym": { name: 'templates.plAttic.name', description: 'templates.plAttic.description' },
  "Studio Apartment": { name: 'templates.studio.name', description: 'templates.studio.description' },
  "1-Bedroom Apartment": { name: 'templates.one.name', description: 'templates.one.description' },
  "2-Bedroom House": { name: 'templates.two.name', description: 'templates.two.description' },
  "Open Concept Home": { name: 'templates.open.name', description: 'templates.open.description' },
  "L-Shaped House": { name: 'templates.l.name', description: 'templates.l.description' },
};
