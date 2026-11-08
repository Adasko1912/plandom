import { get } from 'svelte/store';
import type { Point, RoomCategory } from '$lib/models/types';
import { activeFloor, addWall, beginUndoGroup, detectedRoomsStore, endUndoGroup, updateItemDetails, updateRoom } from '$lib/stores/project';
import { resolveRoomGeometry } from './roomDetection';
import { ROOM_TYPES } from './itemDetails';

/** Limits for a single room typed in by hand (cm). */
export const ROOM_MIN_SIDE = 50;
export const ROOM_MAX_SIDE = 3000;
export const ROOM_MIN_HEIGHT = 180;
export const ROOM_MAX_HEIGHT = 600;

export interface RoomDimensions {
  /** Clear interior length along x, wall face to wall face (cm). */
  length: number;
  /** Clear interior width along y (cm). */
  width: number;
  /** Ceiling height (cm); also the wall height. */
  height: number;
}

export function validRoomDimensions(d: Partial<RoomDimensions>): d is RoomDimensions {
  const side = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= ROOM_MIN_SIDE && v <= ROOM_MAX_SIDE;
  return side(d.length) && side(d.width) && typeof d.height === 'number' && Number.isFinite(d.height)
    && d.height >= ROOM_MIN_HEIGHT && d.height <= ROOM_MAX_HEIGHT;
}

/**
 * Wall centrelines of a rectangle whose clear interior is `length` × `width`.
 * Each centreline sits half a wall thickness outside the interior face.
 */
export function rectangleRoomWalls(center: Point, length: number, width: number, thickness: number): { start: Point; end: Point }[] {
  const hx = (length + thickness) / 2, hy = (width + thickness) / 2;
  const a = { x: center.x - hx, y: center.y - hy }, b = { x: center.x + hx, y: center.y - hy };
  const c = { x: center.x + hx, y: center.y + hy }, d = { x: center.x - hx, y: center.y + hy };
  return [{ start: a, end: b }, { start: b, end: c }, { start: c, end: d }, { start: d, end: a }];
}

/** Category used by area summaries for a detailed room type. */
export function roomCategoryFor(roomType: string | null | undefined): RoomCategory {
  if (roomType === 'garage') return 'garage';
  if (roomType === 'laundryRoom' || roomType === 'closet' || roomType === 'pantry') return 'utility';
  return 'indoor';
}

function inside(p: Point, polygon: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

export interface RoomFromDimensionsSpec extends RoomDimensions {
  center: Point;
  name: string;
  roomType?: string | null;
  thickness: number;
}

/**
 * Draws the four walls and saves the enclosed room with its name, type and ceiling
 * height as one undo step. Returns the room id, or null when no room was enclosed
 * (for example because the rectangle crossed existing walls).
 */
export function addRoomFromDimensions(spec: RoomFromDimensionsSpec): string | null {
  if (!validRoomDimensions(spec) || !(spec.thickness > 0)) throw new Error('Invalid room dimensions');
  const roomType = spec.roomType && ROOM_TYPES.includes(spec.roomType) ? spec.roomType : null;
  beginUndoGroup();
  try {
    for (const wall of rectangleRoomWalls(spec.center, spec.length, spec.width, spec.thickness)) {
      addWall(wall.start, wall.end, { thickness: spec.thickness, height: spec.height });
    }
    const floor = get(activeFloor);
    if (!floor) return null;
    const faces = resolveRoomGeometry(floor, get(detectedRoomsStore));
    // The innermost room containing the centre: the smallest polygon that holds it.
    const face = faces.filter(f => inside(spec.center, f.polygon)).sort((x, y) => x.room.area - y.room.area)[0];
    if (!face) return null;
    detectedRoomsStore.set(faces.map(f => f.room));
    updateRoom(face.room.id, { name: spec.name.trim() || face.room.name, roomType: roomCategoryFor(roomType) });
    updateItemDetails({ floorId: floor.id, kind: 'rooms', id: face.room.id }, { roomType, ceilingHeight: spec.height });
    return face.room.id;
  } finally {
    endUndoGroup('Added room from dimensions');
  }
}
