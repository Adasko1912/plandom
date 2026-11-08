import { writable } from 'svelte/store';
import type { Point } from '$lib/models/types';

/** A reviewer's note pinned to a point of the plan (world centimetres). */
export interface ReviewPin { id: string; floorId: string | null; x: number; y: number; label: string; resolved?: boolean; active?: boolean }

/**
 * Read-only plan for people opening a review link. While set, the plan canvas only pans,
 * zooms and, when `armed`, reports one clicked point to `onPick`.
 */
export interface ReviewState {
  armed: boolean;
  onPick?: (point: Point, floorId: string | null) => void;
}

export const reviewMode = writable<ReviewState | null>(null);

/** Pins drawn over the plan: reviewers' notes in the viewer, the owner's inbox in the editor. */
export const reviewPins = writable<ReviewPin[]>([]);
