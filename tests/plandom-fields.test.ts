import { mockStorage } from './fixtures/indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalStore } from '$lib/services/datastore';
import { createDefaultProject } from '$lib/stores/project';
import { readProject } from '$lib/utils/projectValidation';

beforeEach(() => { mockStorage(); });

function plandomProject() {
  const project = createDefaultProject('PlanDom');
  project.plandomSchema = 1;
  project.location = { address: 'Example', coordinates: [52, 21] };
  project.facade = { finish: { material: 'brick' } };
  project.roofs = [{ id: 'roof', pitch: 35 }];
  project.costSettings = { currency: 'PLN', rates: { labor: 100 } };
  project.site = { boundary: [{ x: 0, y: 0 }] };
  Object.assign(project.floors[0], {
    cabinetRuns: [{ id: 'run', modules: [{ width: 60 }] }],
    wardrobes: [{ id: 'wardrobe', shelves: [20, 40] }],
    wallFinishes: [{ wallId: 'future-wall', finish: 'paint' }],
    lights: [{ id: 'light', position: { x: 10, y: 20 } }],
  });
  return project;
}

describe('optional PlanDom fields', () => {
  it('reads every field unchanged without mutating or sharing the input', () => {
    const project = plandomProject(), before = structuredClone(project);
    const loaded = readProject(project);
    expect(loaded).toEqual(before);
    expect(project).toEqual(before);
    expect(loaded.site).not.toBe(project.site);
    expect(loaded.floors[0].cabinetRuns).not.toBe(project.floors[0].cabinetRuns);
  });

  it('keeps legacy projects unchanged and does not add missing PlanDom fields', () => {
    const project = createDefaultProject();
    expect(readProject(project)).toEqual(project);
  });

  for (const field of ['facade', 'location', 'costSettings', 'site'] as const) {
    it.each([null, [], 'object', 1, true, new Date(), new Map(), new (class Settings {})()])(`rejects invalid ${field}: %s`, value => {
      const project = plandomProject();
      project[field] = value;
      expect(() => readProject(project)).toThrow(`Invalid project: ${field} must be`);
    });
  }

  it.each([null, {}, 'array', 1, true])('rejects invalid roofs: %s', value => {
    const project = plandomProject();
    project.roofs = value;
    expect(() => readProject(project)).toThrow('Invalid project: document.roofs must be an array.');
  });

  for (const field of ['cabinetRuns', 'wardrobes', 'wallFinishes', 'lights'] as const) {
    it.each([null, {}, 'array', 1, true])(`rejects invalid floor ${field}: %s`, value => {
      const project = plandomProject();
      project.floors[0][field] = value;
      expect(() => readProject(project)).toThrow(`Invalid project: floors[0].${field} must be an array.`);
    });
  }

  it.each([null, 0, 2, '1', true, {}, []])('rejects invalid plandomSchema: %s', value => {
    expect(() => readProject({ ...plandomProject(), plandomSchema: value })).toThrow('Invalid project: plandomSchema must be 1.');
  });

  it('preserves all fields through IndexedDB save and load in a fresh store', async () => {
    const project = plandomProject();
    await createLocalStore().save(project);
    expect(await createLocalStore().load(project.id)).toEqual(project);
  });
});
