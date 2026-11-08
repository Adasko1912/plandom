import { writable } from 'svelte/store';
import type { CustomMaterial } from '$lib/models/types';

export interface MaterialLibraryRequest {
  /** Surface the dialog was opened for; new materials default to it. */
  surface?: 'wall' | 'floor';
  /** Called with a newly added material so the caller can apply it at once. */
  onAdded?: (material: CustomMaterial) => void;
}

/** null = closed. One dialog instance lives on the editor page. */
export const materialLibraryRequest = writable<MaterialLibraryRequest | null>(null);

export function openMaterialLibrary(request: MaterialLibraryRequest = {}) {
  materialLibraryRequest.set(request);
}
