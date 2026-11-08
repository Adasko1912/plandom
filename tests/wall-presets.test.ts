import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { addWall, createDefaultProject, currentProject } from '$lib/stores/project';
import {
  DEFAULT_WALL_HEIGHT, WALL_PRESET_THICKNESS, defaultProjectSettings, newWallSize, projectSettings,
} from '$lib/stores/settings';

const walls = () => get(currentProject)!.floors[0].walls;

describe('wall presets', () => {
  beforeEach(() => {
    projectSettings.set(defaultProjectSettings());
    currentProject.set(createDefaultProject('Presets'));
  });

  it('defaults to Polish exterior walls 44 cm thick and 270 cm high', () => {
    expect(defaultProjectSettings()).toMatchObject({ wallPreset: 'exterior', wallHeight: 270 });
    expect(WALL_PRESET_THICKNESS).toEqual({ exterior: 44, loadBearing: 25, partition: 12 });
    addWall({ x: 0, y: 0 }, { x: 400, y: 0 });
    expect(walls()[0]).toMatchObject({ thickness: 44, height: 270, startHeight: 270, endHeight: 270 });
  });

  it('gives the next wall the chosen type and height, leaving existing walls unchanged', () => {
    addWall({ x: 0, y: 0 }, { x: 400, y: 0 });
    projectSettings.update(s => ({ ...s, wallPreset: 'partition', wallHeight: 250 }));
    addWall({ x: 400, y: 0 }, { x: 400, y: 300 });
    projectSettings.update(s => ({ ...s, wallPreset: 'loadBearing' }));
    addWall({ x: 400, y: 300 }, { x: 0, y: 300 });
    expect(walls().map(w => [w.thickness, w.height])).toEqual([[44, 270], [12, 250], [25, 250]]);
  });

  it('lets callers pass explicit sizes', () => {
    addWall({ x: 0, y: 0 }, { x: 100, y: 0 }, { thickness: 15, height: 280 });
    expect(walls()[0]).toMatchObject({ thickness: 15, height: 280, startHeight: 280, endHeight: 280 });
  });

  it('falls back to defaults for invalid values', () => {
    expect(newWallSize({ wallPreset: 'bogus' as never, wallHeight: Number.NaN })).toEqual({ thickness: 44, height: DEFAULT_WALL_HEIGHT });
    expect(newWallSize({ wallPreset: 'partition', wallHeight: 50 })).toEqual({ thickness: 12, height: DEFAULT_WALL_HEIGHT });
    expect(newWallSize({ wallPreset: 'loadBearing', wallHeight: 300 })).toEqual({ thickness: 25, height: 300 });
  });
});

describe('saved settings from before wall presets', () => {
  const stored = new Map<string, string>();
  beforeEach(() => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { stored.set(key, value); },
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); stored.clear(); });

  it('merge old settings with the new defaults and repair invalid stored values', async () => {
    localStorage.setItem('o3d_settings', JSON.stringify({ units: 'imperial', gridSize: 10 }));
    vi.resetModules();
    let settings = get((await import('$lib/stores/settings')).projectSettings);
    expect(settings).toMatchObject({ units: 'imperial', gridSize: 10, wallPreset: 'exterior', wallHeight: 270 });

    localStorage.setItem('o3d_settings', JSON.stringify({ wallPreset: 'glass', wallHeight: 9999 }));
    vi.resetModules();
    settings = get((await import('$lib/stores/settings')).projectSettings);
    expect(settings).toMatchObject({ wallPreset: 'exterior', wallHeight: 270 });

    localStorage.setItem('o3d_settings', JSON.stringify({ wallPreset: 'partition', wallHeight: 255 }));
    vi.resetModules();
    settings = get((await import('$lib/stores/settings')).projectSettings);
    expect(settings).toMatchObject({ wallPreset: 'partition', wallHeight: 255 });
  });
});
