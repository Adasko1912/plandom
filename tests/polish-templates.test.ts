import { describe, expect, it } from 'vitest';
import type { Floor, Point, Wall } from '$lib/models/types';
import {
  buildPolishProject, polishTemplateSpecs, HABITABLE, STOREY_HEIGHT,
  type FloorSpec, type PolishRoomKind, type PolishTemplateSpec,
} from '$lib/utils/polishTemplates';
import { houseTemplates } from '$lib/utils/houseTemplates';
import { resolveRoomGeometry, resolveRooms } from '$lib/utils/roomDetection';
import { roomHoles } from '$lib/utils/roomNesting';
import { interiorRoomArea } from '$lib/utils/interiorArea';
import { pointInPolygon } from '$lib/utils/hitTesting';
import { getFurnitureSize, getCatalogItem } from '$lib/utils/furnitureCatalog';
import { readProject } from '$lib/utils/projectValidation';

/** Floor-to-floor height the editor stacks storeys at (legacy `level × 300`). */
const FLOOR_TO_FLOOR = 300;

interface RoomInfo { name: string; kind: PolishRoomKind; polygon: Point[]; area: number; clearW: number; clearH: number }

const len = (w: Wall) => Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
const along = (w: Wall, t: number): Point => ({ x: w.start.x + (w.end.x - w.start.x) * t, y: w.start.y + (w.end.y - w.start.y) * t });
const normal = (w: Wall): Point => { const l = len(w); return { x: -(w.end.y - w.start.y) / l, y: (w.end.x - w.start.x) / l }; };

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
const insideWall = (p: Point, walls: Wall[]) => walls.some(w => distanceToSegment(p, w.start, w.end) < w.thickness / 2 - 1e-6);

function rooms(floor: Floor, spec: FloorSpec): RoomInfo[] {
  const geometry = resolveRoomGeometry(floor);
  const holes = roomHoles(geometry.map(g => g.polygon));
  return geometry.map(({ room, polygon }, i) => {
    const named = spec.rooms.find(r => pointInPolygon(r.at, polygon));
    expect(named, `unnamed room ${room.name}`).toBeTruthy();
    const xs = polygon.map(p => p.x), ys = polygon.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    // Half of the thickest wall on each side of the room's bounding box.
    const half = (onSide: (w: Wall) => boolean) => Math.max(0, ...floor.walls.filter(onSide).map(w => w.thickness / 2));
    const vertical = (x: number) => (w: Wall) => w.start.x === x && w.end.x === x && Math.max(w.start.y, w.end.y) > minY && Math.min(w.start.y, w.end.y) < maxY;
    const horizontal = (y: number) => (w: Wall) => w.start.y === y && w.end.y === y && Math.max(w.start.x, w.end.x) > minX && Math.min(w.start.x, w.end.x) < maxX;
    return {
      name: named!.name, kind: named!.kind, polygon,
      area: interiorRoomArea(polygon, holes[i], floor.walls)!,
      clearW: maxX - minX - half(vertical(minX)) - half(vertical(maxX)),
      clearH: maxY - minY - half(horizontal(minY)) - half(horizontal(maxY)),
    };
  });
}

/** Rooms on both sides of an opening, found just beyond each wall face. */
function sides(wall: Wall, t: number, info: RoomInfo[]): (RoomInfo | undefined)[] {
  const c = along(wall, t), n = normal(wall), d = wall.thickness / 2 + 5;
  return [1, -1].map(s => info.find(r => pointInPolygon({ x: c.x + n.x * d * s, y: c.y + n.y * d * s }, r.polygon)));
}

function isPerimeter(wall: Wall, floor: Floor) {
  const xs = floor.walls.flatMap(w => [w.start.x, w.end.x]), ys = floor.walls.flatMap(w => [w.start.y, w.end.y]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return (wall.start.x === wall.end.x && (wall.start.x === minX || wall.start.x === maxX))
    || (wall.start.y === wall.end.y && (wall.start.y === minY || wall.start.y === maxY));
}

/** Both jambs of an opening sit in clear wall: not inside a crossing wall, and inside the rooms it joins. */
function expectOpeningFits(wall: Wall, position: number, width: number, floor: Floor, label: string) {
  const l = len(wall), n = normal(wall), d = wall.thickness / 2 + 1;
  for (const edge of [position * l - width / 2, position * l + width / 2]) {
    expect(edge, `${label} runs past the wall end`).toBeGreaterThan(0);
    expect(edge, `${label} runs past the wall end`).toBeLessThan(l);
    const p = along(wall, edge / l);
    for (const s of [1, -1]) {
      const face = { x: p.x + n.x * d * s, y: p.y + n.y * d * s };
      if (isPerimeter(wall, floor) && s === -1 && !floor.walls.some(w => w !== wall && distanceToSegment(face, w.start, w.end) < w.thickness / 2)) continue;
      expect(insideWall(face, floor.walls.filter(w => w !== wall)), `${label} jamb hits a crossing wall`).toBe(false);
    }
  }
}

describe.each(polishTemplateSpecs.map(spec => [spec.name, spec] as [string, PolishTemplateSpec]))('%s', (_name, spec) => {
  const project = buildPolishProject(spec);
  const floors = project.floors;
  const info = floors.map((floor, i) => rooms(floor, spec.floors[i]));
  const table = () => info.map((r, i) => `${floors[i].name}: ` + r.map(x => `${x.name} ${x.area.toFixed(2)} m² (${x.clearW.toFixed(0)}×${x.clearH.toFixed(0)})`).join(', ')).join('\n');

  it('detects exactly the designed rooms with their names', () => {
    floors.forEach((floor, i) => {
      expect(info[i].length, table()).toBe(spec.floors[i].rooms.length);
      for (const designed of spec.floors[i].rooms) expect(info[i].filter(r => pointInPolygon(designed.at, r.polygon))).toHaveLength(1);
      expect(floor.rooms.map(r => r.name).sort()).toEqual(spec.floors[i].rooms.map(r => r.name).sort());
    });
  });

  it('meets the target usable area', () => {
    const total = info.flat().reduce((sum, r) => sum + r.area, 0);
    expect(Math.abs(total - spec.targetArea) / spec.targetArea, `${total.toFixed(2)} m²\n${table()}`).toBeLessThanOrEqual(spec.tolerance);
  });

  it('meets Polish minimum room sizes', () => {
    for (const r of info.flat()) {
      const shorter = Math.min(r.clearW, r.clearH);
      if (r.kind === 'living') expect(r.area, r.name).toBeGreaterThanOrEqual(16);
      if (r.kind === 'bedroom' || r.kind === 'study') {
        expect(r.area, r.name).toBeGreaterThanOrEqual(8);
        expect(shorter, r.name).toBeGreaterThanOrEqual(220);
      }
      if (r.kind === 'hall' || r.kind === 'corridor') expect(shorter, r.name).toBeGreaterThanOrEqual(120);
      if (r.kind === 'bathroom') expect(r.area, r.name).toBeGreaterThanOrEqual(2.5);
    }
  });

  it('has sized doors in clear wall, and every room reachable from the entrance', () => {
    let entrances = 0;
    floors.forEach((floor, i) => {
      const graph = new Map<RoomInfo, Set<RoomInfo>>(info[i].map(r => [r, new Set()]));
      let start: RoomInfo | undefined;
      for (const door of floor.doors) {
        const wall = floor.walls.find(w => w.id === door.wallId)!;
        const [a, b] = sides(wall, door.position, info[i]);
        const label = `door ${door.width} between ${a?.name ?? 'outside'} and ${b?.name ?? 'outside'}`;
        expectOpeningFits(wall, door.position, door.width, floor, label);
        if (!a || !b) {
          entrances++;
          expect(isPerimeter(wall, floor), label).toBe(true);
          expect(door.width, label).toBeGreaterThanOrEqual(90);
          expect(door.width, label).toBeLessThanOrEqual(100);
          start = a ?? b;
          continue;
        }
        graph.get(a)!.add(b); graph.get(b)!.add(a);
        const kinds = [a.kind, b.kind];
        if (kinds.some(k => k === 'bathroom' || k === 'wc')) expect(door.width, label).toBeGreaterThanOrEqual(80);
        else if (kinds.some(k => k === 'wardrobe' || k === 'storage' || k === 'utility')) expect(door.width, label).toBeGreaterThanOrEqual(60);
        else { expect(door.width, label).toBeGreaterThanOrEqual(80); expect(door.width, label).toBeLessThanOrEqual(90); }
      }
      if (i > 0) {
        // Upper floors are entered by the stairs of the floor below.
        const stair = floors[i - 1].stairs[0];
        expect(stair, 'upper floor without stairs below').toBeTruthy();
        start = info[i].find(r => pointInPolygon(stair.position, r.polygon));
      }
      expect(start, `${floor.name}: no entry room`).toBeTruthy();
      const seen = new Set([start!]), queue = [start!];
      while (queue.length) for (const next of graph.get(queue.shift()!)!) if (!seen.has(next)) { seen.add(next); queue.push(next); }
      expect(info[i].filter(r => !seen.has(r)).map(r => r.name), `${floor.name}: unreachable rooms`).toEqual([]);
    });
    expect(entrances).toBe(1);
  });

  it('has daylight in every habitable room through exterior windows', () => {
    floors.forEach((floor, i) => {
      const lit = new Set<RoomInfo>();
      for (const win of floor.windows) {
        const wall = floor.walls.find(w => w.id === win.wallId)!;
        const room = sides(wall, win.position, info[i]).find(Boolean);
        expect(isPerimeter(wall, floor), `window in ${room?.name}`).toBe(true);
        expectOpeningFits(wall, win.position, win.width, floor, `window in ${room?.name}`);
        expect(room, 'window opens into no room').toBeTruthy();
        lit.add(room!);
        const wet = room!.kind === 'bathroom' || room!.kind === 'wc';
        expect(win.sillHeight, room!.name).toBeGreaterThanOrEqual(wet ? 120 : 85);
        expect(win.sillHeight, room!.name).toBeLessThanOrEqual(wet ? 150 : 90);
        expect(win.sillHeight + win.height, `${room!.name} window taller than its wall`).toBeLessThanOrEqual(wall.height);
      }
      for (const r of info[i]) if (HABITABLE.has(r.kind)) expect(lit.has(r), `${r.name} has no window`).toBe(true);
    });
  });

  it('has no duplicated or overlapping walls and storey-height walls on the ground floor', () => {
    floors.forEach(floor => {
      for (let i = 0; i < floor.walls.length; i++) for (let j = i + 1; j < floor.walls.length; j++) {
        const a = floor.walls[i], b = floor.walls[j];
        const sameLine = (a.start.x === a.end.x && b.start.x === b.end.x && a.start.x === b.start.x)
          || (a.start.y === a.end.y && b.start.y === b.end.y && a.start.y === b.start.y);
        if (!sameLine) continue;
        const span = (w: Wall) => a.start.x === a.end.x ? [Math.min(w.start.y, w.end.y), Math.max(w.start.y, w.end.y)] : [Math.min(w.start.x, w.end.x), Math.max(w.start.x, w.end.x)];
        const [a0, a1] = span(a), [b0, b1] = span(b);
        expect(Math.min(a1, b1) - Math.max(a0, b0), `${floor.name}: walls ${i} and ${j} overlap`).toBeLessThanOrEqual(0);
      }
      if (floor.level === 0) for (const wall of floor.walls) expect(wall.height).toBe(STOREY_HEIGHT);
      for (const wall of floor.walls) expect(wall.startHeight === wall.height && wall.endHeight === wall.height).toBe(true);
    });
  });

  it('has comfortable stairs inside one room', () => {
    floors.forEach((floor, i) => {
      for (const stair of floor.stairs) {
        const riser = FLOOR_TO_FLOOR / stair.riserCount, tread = stair.depth / stair.riserCount;
        expect(stair.width).toBeGreaterThanOrEqual(90);
        expect(riser).toBeLessThanOrEqual(19);
        expect(2 * riser + tread).toBeGreaterThanOrEqual(60);
        expect(2 * riser + tread).toBeLessThanOrEqual(65);
        expect(stair.rotation).toBe(0);
        const corners = [-1, 1].flatMap(sx => [-1, 1].map(sy => ({ x: stair.position.x + sx * stair.width / 2, y: stair.position.y + sy * stair.depth / 2 })));
        const room = info[i].find(r => corners.every(c => pointInPolygon(c, r.polygon)));
        expect(room?.kind, 'stairs not inside a hall').toBe('hall');
        for (const c of corners) expect(insideWall(c, floor.walls), 'stairs cut into a wall').toBe(false);
        expect(floors[i + 1], 'stairs lead nowhere').toBeTruthy();
      }
    });
  });

  it('places catalog furniture inside rooms without hitting walls or each other', () => {
    floors.forEach((floor, i) => {
      const boxes = floor.furniture.map(item => {
        expect(getCatalogItem(item.catalogId), item.catalogId).toBeTruthy();
        const size = getFurnitureSize(item), turned = Math.abs(item.rotation % 180) === 90;
        const hw = (turned ? size.depth : size.width) / 2, hd = (turned ? size.width : size.depth) / 2;
        const box = { id: item.catalogId, l: item.position.x - hw, r: item.position.x + hw, t: item.position.y - hd, b: item.position.y + hd };
        const corners = [{ x: box.l, y: box.t }, { x: box.r, y: box.t }, { x: box.l, y: box.b }, { x: box.r, y: box.b }];
        expect(info[i].some(r => corners.every(c => pointInPolygon(c, r.polygon))), `${item.catalogId} straddles rooms`).toBe(true);
        for (const wall of floor.walls) {
          const h = wall.thickness / 2;
          const wl = Math.min(wall.start.x, wall.end.x) - (wall.start.x === wall.end.x ? h : 0), wr = Math.max(wall.start.x, wall.end.x) + (wall.start.x === wall.end.x ? h : 0);
          const wt = Math.min(wall.start.y, wall.end.y) - (wall.start.y === wall.end.y ? h : 0), wb = Math.max(wall.start.y, wall.end.y) + (wall.start.y === wall.end.y ? h : 0);
          const overlap = Math.min(box.r, wr) - Math.max(box.l, wl) > 1e-6 && Math.min(box.b, wb) - Math.max(box.t, wt) > 1e-6;
          expect(overlap, `${item.catalogId} at ${item.position.x},${item.position.y} hits a wall`).toBe(false);
        }
        return box;
      });
      for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
        const A = boxes[a], B = boxes[b];
        const overlap = Math.min(A.r, B.r) - Math.max(A.l, B.l) > 1e-6 && Math.min(A.b, B.b) - Math.max(A.t, B.t) > 1e-6;
        expect(overlap, `${A.id}/${B.id} overlap`).toBe(false);
      }
    });
  });

  it('keeps room names and floors through validation and room re-detection', () => {
    const loaded = readProject(structuredClone(project));
    expect(loaded.floors.map(f => [f.name, f.level])).toEqual(spec.floors.map(f => [f.name, f.level]));
    loaded.floors.forEach((floor, i) => {
      expect(resolveRooms(floor).map(r => r.name).sort()).toEqual(spec.floors[i].rooms.map(r => r.name).sort());
    });
  });
});

it('lists the Polish templates first, keeping the original ones', () => {
  expect(houseTemplates.slice(0, 4).map(t => t.name)).toEqual(polishTemplateSpecs.map(s => s.name));
  expect(houseTemplates.map(t => t.name)).toEqual(expect.arrayContaining(['Studio Apartment', 'L-Shaped House']));
  for (const template of houseTemplates.slice(0, 4)) expect(template.create().floors.length).toBeGreaterThan(0);
});
