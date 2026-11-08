import type { Project, Floor, Wall, Door, Window, FurnitureItem, Stair, Room, RoomCategory, Point } from '$lib/models/types';
import { resolveRoomGeometry } from './roomDetection';
import { pointInPolygon } from './hitTesting';
import type { HouseTemplate } from './houseTemplates';

/*
 * Polish starter plans. Coordinates are wall centerlines in cm; a room's clear size is the
 * centerline span minus half of each bounding wall. Room programmes follow the Polish building
 * regulation (WT 2021) minimums checked in tests/polish-templates.test.ts.
 */

export const T_EXTERIOR = 44;   // 24 cm masonry + 20 cm insulation
export const T_FLAT_EXTERIOR = 30; // flat outer/party wall
export const T_LOAD_BEARING = 25;
export const T_PARTITION = 12;
export const STOREY_HEIGHT = 270;
/** Simplified attic until roofs arrive (stage F7): knee walls on the eaves sides, full-height gables. */
export const KNEE_WALL_HEIGHT = 100;
export const ATTIC_PARTITION_HEIGHT = 250;

export type PolishRoomKind = 'living' | 'bedroom' | 'study' | 'hall' | 'vestibule' | 'bathroom' | 'wc'
  | 'wardrobe' | 'storage' | 'utility' | 'corridor';
/** Rooms people live in: they need daylight and the minimum area/width rules. */
export const HABITABLE: ReadonlySet<PolishRoomKind> = new Set(['living', 'bedroom', 'study']);

export interface WallSpec { a: Point; b: Point; thickness: number; height?: number }
export interface RoomSpec { name: string; kind: PolishRoomKind; at: Point; minArea?: number }
/** `at` is the opening centre in cm from the wall's start point. */
export interface OpeningSpec { wall: number; at: number; width: number; entrance?: boolean; sill?: number; height?: number; type?: Door['type'] }
export interface FloorSpec {
  name: string;
  level: number;
  walls: WallSpec[];
  rooms: RoomSpec[];
  doors: OpeningSpec[];
  windows: OpeningSpec[];
  furniture: [catalogId: string, x: number, y: number, rotation?: number][];
  stairs?: Omit<Stair, 'id'>[];
}
export interface PolishTemplateSpec {
  key: string;
  name: string;
  /** Target usable (net) floor area in m² and the allowed relative deviation. */
  targetArea: number;
  tolerance: number;
  floors: FloorSpec[];
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const w = (x1: number, y1: number, x2: number, y2: number, thickness: number, height?: number): WallSpec =>
  ({ a: { x: x1, y: y1 }, b: { x: x2, y: y2 }, thickness, height });

const roomCategory = (kind: PolishRoomKind): RoomCategory => kind === 'utility' ? 'utility' : 'indoor';

/** Build one floor: walls, openings, furniture, and rooms named by the point each spec marks. */
export function buildFloor(spec: FloorSpec): Floor {
  const walls: Wall[] = spec.walls.map(s => {
    const height = s.height ?? STOREY_HEIGHT;
    return { id: uid(), start: { ...s.a }, end: { ...s.b }, thickness: s.thickness, height, startHeight: height, endHeight: height, color: '#444444' };
  });
  const length = (i: number) => Math.hypot(spec.walls[i].b.x - spec.walls[i].a.x, spec.walls[i].b.y - spec.walls[i].a.y);
  const doors: Door[] = spec.doors.map(d => ({
    id: uid(), wallId: walls[d.wall].id, position: d.at / length(d.wall), width: d.width, height: 210,
    type: d.type ?? 'single', swingDirection: 'left', flipSide: false,
  }));
  const windows: Window[] = spec.windows.map(o => ({
    id: uid(), wallId: walls[o.wall].id, position: o.at / length(o.wall), width: o.width,
    height: o.height ?? 120, sillHeight: o.sill ?? 90, type: 'standard',
  }));
  const furniture: FurnitureItem[] = spec.furniture.map(([catalogId, x, y, rotation = 0]) =>
    ({ id: uid(), catalogId, position: { x, y }, rotation, scale: { x: 1, y: 1, z: 1 } }));
  const stairs: Stair[] = (spec.stairs ?? []).map(s => ({ ...s, position: { ...s.position }, id: uid() }));
  const floor: Floor = {
    id: uid(), name: spec.name, level: spec.level, walls, rooms: [], doors, windows, furniture, stairs,
    columns: [], guides: [], measurements: [], annotations: [], textAnnotations: [], groups: [],
  };
  // Rooms come from wall geometry; saved rooms only carry names/categories matched by boundary.
  const rooms: Room[] = [];
  for (const { room, polygon } of resolveRoomGeometry(floor)) {
    const named = spec.rooms.find(r => pointInPolygon(r.at, polygon));
    rooms.push(named ? { ...room, name: named.name, roomType: roomCategory(named.kind) } : room);
  }
  floor.rooms = rooms;
  return floor;
}

export function buildPolishProject(spec: PolishTemplateSpec): Project {
  const floors = spec.floors.map(buildFloor);
  return { id: uid(), name: spec.name, floors, activeFloorId: floors[0].id, createdAt: new Date(), updatedAt: new Date() };
}

// ─── M2: 38 m² flat ─── pokój dzienny 21.2, sypialnia 10.8, przedpokój 2.7, łazienka 2.9
const m2: PolishTemplateSpec = {
  key: 'pl-m2', name: 'Mieszkanie M2', targetArea: 38, tolerance: 0.05,
  floors: [{
    name: 'Mieszkanie', level: 0,
    walls: [
      w(0, 0, 760, 0, T_FLAT_EXTERIOR), w(760, 0, 760, 560, T_FLAT_EXTERIOR),
      w(0, 560, 760, 560, T_FLAT_EXTERIOR), w(0, 0, 0, 560, T_FLAT_EXTERIOR),
      w(420, 0, 420, 560, T_PARTITION), w(420, 360, 760, 360, T_PARTITION), w(580, 360, 580, 560, T_PARTITION),
    ],
    rooms: [
      { name: 'Pokój dzienny z aneksem kuchennym', kind: 'living', at: { x: 200, y: 280 } },
      { name: 'Sypialnia', kind: 'bedroom', at: { x: 590, y: 180 } },
      { name: 'Przedpokój', kind: 'hall', at: { x: 500, y: 460 } },
      { name: 'Łazienka', kind: 'bathroom', at: { x: 670, y: 460 } },
    ],
    doors: [
      { wall: 2, at: 500, width: 90, entrance: true },
      { wall: 4, at: 455, width: 80 },  // przedpokój → pokój dzienny
      { wall: 5, at: 80, width: 80 },   // przedpokój → sypialnia
      { wall: 6, at: 100, width: 80 },  // przedpokój → łazienka
    ],
    windows: [
      { wall: 0, at: 215, width: 150 }, { wall: 3, at: 300, width: 120 }, { wall: 0, at: 585, width: 120 },
    ],
    furniture: [
      ['fridge', 55, 505], ['counter', 50, 410, 90], ['stove', 50, 320], ['sink_k', 42.5, 260, 90],
      ['dining_table', 200, 470], ['sofa', 230, 180], ['coffee_table', 230, 270], ['tv_stand', 390, 200, 90],
      ['bed_queen', 585, 125, 90], ['wardrobe', 585, 320], ['nightstand', 480, 45],
      ['shower', 695, 495], ['toilet', 620, 505], ['sink_b', 690, 395],
    ],
  }],
};

// ─── M3: 52 m² flat ─── pokój dzienny 17.3, pokoje 10.4 i 9.6, przedpokój 11.2, łazienka 3.8, schowek 1.0
const m3: PolishTemplateSpec = {
  key: 'pl-m3', name: 'Mieszkanie M3', targetArea: 52, tolerance: 0.05,
  floors: [{
    name: 'Mieszkanie', level: 0,
    walls: [
      w(0, 0, 980, 0, T_FLAT_EXTERIOR), w(980, 0, 980, 630, T_FLAT_EXTERIOR),
      w(0, 630, 980, 630, T_FLAT_EXTERIOR), w(0, 0, 0, 630, T_FLAT_EXTERIOR),
      w(0, 430, 980, 430, T_LOAD_BEARING),
      w(450, 0, 450, 430, T_PARTITION), w(720, 0, 720, 430, T_PARTITION),
      w(240, 430, 240, 630, T_PARTITION), w(900, 430, 900, 630, T_PARTITION),
    ],
    rooms: [
      { name: 'Pokój dzienny z aneksem kuchennym', kind: 'living', at: { x: 225, y: 215 } },
      { name: 'Pokój', kind: 'bedroom', at: { x: 585, y: 215 } },
      { name: 'Pokój dziecięcy', kind: 'bedroom', at: { x: 850, y: 215 } },
      { name: 'Łazienka', kind: 'bathroom', at: { x: 120, y: 530 } },
      { name: 'Przedpokój', kind: 'hall', at: { x: 570, y: 530 } },
      { name: 'Schowek', kind: 'storage', at: { x: 940, y: 530 } },
    ],
    doors: [
      { wall: 2, at: 600, width: 90, entrance: true },
      { wall: 4, at: 350, width: 90 },  // przedpokój → pokój dzienny
      { wall: 4, at: 585, width: 80 },  // przedpokój → pokój
      { wall: 4, at: 810, width: 80 },  // przedpokój → pokój dziecięcy
      { wall: 7, at: 100, width: 80 },  // przedpokój → łazienka
      { wall: 8, at: 100, width: 70 },  // przedpokój → schowek
    ],
    windows: [
      { wall: 0, at: 240, width: 180 }, { wall: 0, at: 585, width: 120 }, { wall: 0, at: 850, width: 120 },
    ],
    furniture: [
      ['fridge', 55, 60], ['counter', 50, 155, 90], ['stove', 50, 245], ['sink_k', 42.5, 305, 90],
      ['dining_table', 330, 120], ['sofa', 200, 330], ['coffee_table', 200, 240], ['tv_stand', 420, 280, 90],
      ['bed_queen', 585, 140, 90], ['wardrobe', 585, 380], ['nightstand', 483, 60],
      ['bed_twin', 800, 120, 90], ['desk', 880, 380], ['wardrobe', 933, 180, 90],
      ['shower', 65, 565], ['toilet', 150, 580], ['sink_b', 190, 470],
      ['wardrobe', 700, 475],
    ],
  }],
};

// ─── Dom parterowy ~100 m² ─── salon 37.3, sypialnie 12.2/12.2/10.5, hol 10.0, łazienka 5.1, …
const singleStorey: PolishTemplateSpec = {
  key: 'pl-dom-parterowy', name: 'Dom parterowy', targetArea: 100, tolerance: 0.05,
  floors: [{
    name: 'Parter', level: 0,
    walls: [
      w(0, 0, 1320, 0, T_EXTERIOR), w(1320, 0, 1320, 900, T_EXTERIOR),
      w(0, 900, 1320, 900, T_EXTERIOR), w(0, 0, 0, 900, T_EXTERIOR),
      w(470, 0, 470, 900, T_LOAD_BEARING),
      w(470, 390, 1320, 390, T_PARTITION), w(470, 525, 1320, 525, T_PARTITION),
      w(825, 0, 825, 390, T_PARTITION), w(955, 0, 955, 390, T_PARTITION),
      w(605, 525, 605, 900, T_PARTITION), w(730, 525, 730, 900, T_PARTITION),
      w(830, 525, 830, 900, T_PARTITION), w(990, 525, 990, 900, T_PARTITION),
    ],
    rooms: [
      { name: 'Salon z jadalnią i kuchnią', kind: 'living', at: { x: 235, y: 450 } },
      { name: 'Sypialnia', kind: 'bedroom', at: { x: 650, y: 200 } },
      { name: 'Garderoba', kind: 'wardrobe', at: { x: 890, y: 200 } },
      { name: 'Sypialnia', kind: 'bedroom', at: { x: 1130, y: 200 } },
      { name: 'Hol', kind: 'hall', at: { x: 900, y: 457 } },
      { name: 'Wiatrołap', kind: 'vestibule', at: { x: 537, y: 700 } },
      { name: 'Pomieszczenie gospodarcze', kind: 'utility', at: { x: 667, y: 700 } },
      { name: 'WC', kind: 'wc', at: { x: 780, y: 700 } },
      { name: 'Łazienka', kind: 'bathroom', at: { x: 910, y: 700 } },
      { name: 'Sypialnia', kind: 'bedroom', at: { x: 1155, y: 700 } },
    ],
    doors: [
      { wall: 2, at: 537, width: 90, entrance: true },
      { wall: 6, at: 67, width: 80 },     // wiatrołap → hol
      { wall: 4, at: 457.5, width: 90 },  // hol → salon
      { wall: 5, at: 170, width: 80 },    // hol → sypialnia 1
      { wall: 5, at: 420, width: 70 },    // hol → garderoba
      { wall: 5, at: 630, width: 80 },    // hol → sypialnia 2
      { wall: 6, at: 197.5, width: 70 },  // hol → gospodarcze
      { wall: 6, at: 310, width: 80 },    // hol → WC
      { wall: 6, at: 440, width: 80 },    // hol → łazienka
      { wall: 6, at: 630, width: 80 },    // hol → sypialnia 3
    ],
    windows: [
      { wall: 0, at: 235, width: 240 }, { wall: 3, at: 450, width: 150 }, { wall: 2, at: 300, width: 150 },
      { wall: 0, at: 647.5, width: 120 }, { wall: 0, at: 1137, width: 150 }, { wall: 2, at: 1155, width: 150 },
      { wall: 2, at: 910, width: 60, sill: 150, height: 60 },
    ],
    furniture: [
      ['fridge', 60, 60], ['counter', 55, 155, 90], ['stove', 55, 245], ['sink_k', 47.5, 305, 90], ['dishwasher', 55, 365],
      ['dining_table', 250, 200], ['sofa', 240, 640], ['coffee_table', 240, 540], ['tv_stand', 240, 850], ['chair', 400, 600],
      ['bed_queen', 650, 140, 90], ['wardrobe', 650, 345], ['nightstand', 530, 50],
      ['wardrobe', 865, 100, 90], ['wardrobe', 865, 250, 90],
      ['bed_queen', 1130, 140, 90], ['wardrobe', 1130, 345],
      ['bed_twin', 1060, 740, 90], ['desk', 1200, 840], ['wardrobe', 1265, 640, 90],
      ['bathtub', 946, 780, 90], ['toilet', 870, 840], ['sink_b', 870, 580],
      ['toilet', 780, 840], ['sink_b', 780, 760],
      ['washer_dryer', 650, 840],
    ],
  }],
};

// ─── Dom z poddaszem użytkowym ~140 m² ─── parter 71.6 + poddasze 71.3
const atticHouse: PolishTemplateSpec = {
  key: 'pl-dom-poddasze', name: 'Dom z poddaszem użytkowym', targetArea: 140, tolerance: 0.07,
  floors: [
    {
      name: 'Parter', level: 0,
      walls: [
        w(0, 0, 1040, 0, T_EXTERIOR), w(1040, 0, 1040, 800, T_EXTERIOR),
        w(0, 800, 1040, 800, T_EXTERIOR), w(0, 0, 0, 800, T_EXTERIOR),
        w(520, 0, 520, 800, T_LOAD_BEARING),
        w(740, 0, 740, 800, T_PARTITION), w(520, 600, 740, 600, T_PARTITION),
        w(740, 360, 1040, 360, T_PARTITION), w(740, 540, 1040, 540, T_PARTITION),
      ],
      rooms: [
        { name: 'Salon z kuchnią i jadalnią', kind: 'living', at: { x: 260, y: 400 } },
        { name: 'Hol ze schodami', kind: 'hall', at: { x: 680, y: 300 } },
        { name: 'Wiatrołap', kind: 'vestibule', at: { x: 630, y: 700 } },
        { name: 'Gabinet', kind: 'study', at: { x: 890, y: 180 } },
        { name: 'Łazienka', kind: 'bathroom', at: { x: 890, y: 450 } },
        { name: 'Pomieszczenie gospodarcze', kind: 'utility', at: { x: 890, y: 670 } },
      ],
      doors: [
        { wall: 2, at: 630, width: 100, entrance: true },
        { wall: 6, at: 160, width: 90 },  // wiatrołap → hol
        { wall: 4, at: 85, width: 90 },   // hol → salon
        { wall: 5, at: 180, width: 80 },  // hol → gabinet
        { wall: 5, at: 450, width: 80 },  // hol → łazienka
        { wall: 5, at: 690, width: 80 },  // wiatrołap → gospodarcze
      ],
      windows: [
        { wall: 3, at: 250, width: 180 }, { wall: 3, at: 560, width: 180 }, { wall: 0, at: 250, width: 150 },
        { wall: 0, at: 880, width: 120 }, { wall: 1, at: 450, width: 60, sill: 150, height: 60 },
      ],
      furniture: [
        ['fridge', 60, 60], ['counter', 55, 155, 90], ['stove', 55, 245], ['sink_k', 47.5, 305, 90],
        ['dining_table', 250, 180], ['sofa', 260, 560], ['coffee_table', 260, 460], ['tv_stand', 260, 750],
        ['desk', 880, 60], ['office_chair', 880, 120], ['bookshelf', 1000, 250, 90],
        ['shower', 800, 480], ['toilet', 900, 500], ['sink_b', 960, 390],
        ['washer_dryer', 800, 740], ['storage', 930, 750],
      ],
      // 17 risers of 17.6 cm over the 300 cm floor-to-floor height, 26 cm treads (2r + t = 61.3 cm).
      stairs: [{ position: { x: 580.5, y: 371 }, rotation: 0, width: 95, depth: 442, riserCount: 17, direction: 'up', stairType: 'straight' }],
    },
    {
      name: 'Poddasze', level: 1,
      walls: [
        w(0, 0, 1040, 0, T_EXTERIOR, KNEE_WALL_HEIGHT), w(1040, 0, 1040, 800, T_EXTERIOR),
        w(0, 800, 1040, 800, T_EXTERIOR, KNEE_WALL_HEIGHT), w(0, 0, 0, 800, T_EXTERIOR),
        w(520, 0, 520, 800, T_LOAD_BEARING, ATTIC_PARTITION_HEIGHT),
        w(740, 0, 740, 800, T_PARTITION, ATTIC_PARTITION_HEIGHT), w(0, 400, 520, 400, T_PARTITION, ATTIC_PARTITION_HEIGHT),
        w(740, 480, 1040, 480, T_PARTITION, ATTIC_PARTITION_HEIGHT), w(740, 640, 1040, 640, T_PARTITION, ATTIC_PARTITION_HEIGHT),
      ],
      rooms: [
        { name: 'Sypialnia', kind: 'bedroom', at: { x: 260, y: 200 } },
        { name: 'Sypialnia', kind: 'bedroom', at: { x: 260, y: 600 } },
        { name: 'Korytarz', kind: 'corridor', at: { x: 680, y: 300 } },
        { name: 'Sypialnia', kind: 'bedroom', at: { x: 890, y: 240 } },
        { name: 'Garderoba', kind: 'wardrobe', at: { x: 890, y: 560 } },
        { name: 'Łazienka', kind: 'bathroom', at: { x: 890, y: 710 } },
      ],
      doors: [
        { wall: 4, at: 85, width: 80 },   // korytarz → sypialnia 1 (beyond the stair opening)
        { wall: 4, at: 690, width: 80 },  // korytarz → sypialnia 2
        { wall: 5, at: 250, width: 80 },  // korytarz → sypialnia 3
        { wall: 5, at: 560, width: 70 },  // korytarz → garderoba
        { wall: 5, at: 710, width: 80 },  // korytarz → łazienka
      ],
      windows: [
        { wall: 3, at: 200, width: 120 }, { wall: 3, at: 600, width: 120 }, { wall: 1, at: 250, width: 120 },
        { wall: 1, at: 710, width: 60, sill: 150, height: 60 },
      ],
      furniture: [
        ['bed_queen', 260, 150, 90], ['wardrobe', 260, 360], ['nightstand', 150, 50],
        ['bed_queen', 260, 640, 90], ['wardrobe', 260, 440],
        ['bed_twin', 820, 140, 90], ['desk', 930, 435],
        ['wardrobe', 830, 520], ['wardrobe', 955, 520],
        ['bathtub', 850, 740], ['toilet', 980, 690], ['sink_b', 980, 750],
      ],
    },
  ],
};

export const polishTemplateSpecs: readonly PolishTemplateSpec[] = [m2, m3, singleStorey, atticHouse];

export const polishHouseTemplates: HouseTemplate[] = [
  { name: m2.name, description: 'Pokój dzienny z aneksem, sypialnia, łazienka, przedpokój', icon: '🏢', area: '38 m²', tags: ['apartment', 'pl'], create: () => buildPolishProject(m2) },
  { name: m3.name, description: 'Pokój dzienny z aneksem, 2 pokoje, łazienka, przedpokój, schowek', icon: '🏬', area: '53 m²', tags: ['apartment', 'pl'], create: () => buildPolishProject(m3) },
  { name: singleStorey.name, description: 'Salon z kuchnią, 3 sypialnie, garderoba, łazienka, WC, wiatrołap, gospodarcze', icon: '🏡', area: '103 m²', tags: ['house', 'pl'], create: () => buildPolishProject(singleStorey) },
  { name: atticHouse.name, description: 'Parter: salon z kuchnią, gabinet, łazienka; poddasze: 3 sypialnie, garderoba, łazienka', icon: '🏠', area: '143 m²', tags: ['house', 'pl', 'attic'], create: () => buildPolishProject(atticHouse) },
];
