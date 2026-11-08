import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  PLAN_PIXEL_LIMIT, PLAN_SIDE_LIMIT, cmPerPixelForDrawing, isPdfBytes, isPdfFile, parseDrawingScale, pdfRenderScale,
} from '$lib/utils/planImport';
import { activeFloor, createDefaultProject, currentProject, detectedRoomsStore } from '$lib/stores/project';
import { addRoomFromDimensions, rectangleRoomWalls, roomCategoryFor, validRoomDimensions } from '$lib/utils/roomFromDimensions';
import { interiorRoomArea } from '$lib/utils/interiorArea';
import { resolveRoomGeometry } from '$lib/utils/roomDetection';
import { itemDetails } from '$lib/utils/itemDetails';
import { estimateRoomFromPhotos, parseRoomEstimate, roomAnalysisPrompt } from '$lib/utils/roomPhotoAnalysis';
import { chatWithImages } from '$lib/utils/openaiClient';

// A4 portrait is 595.28 × 841.89 pt; A1 landscape 2383.94 × 1683.78 pt.
describe('PDF drawing scale', () => {
  it('renders A4 at 200 DPI and a 1:100 sheet maps 1 mm of paper to 10 cm', () => {
    const scale = pdfRenderScale(595.28, 841.89);
    expect(scale).toBeCloseTo(200 / 72, 6);
    // 200 DPI → 1 px = 0.127 mm of paper → 12.7 mm = 1.27 cm real at 1:100.
    expect(cmPerPixelForDrawing(100, scale)).toBeCloseTo(1.27, 6);
    expect(cmPerPixelForDrawing(50, scale)).toBeCloseTo(0.635, 6);
    // A 10 m wall drawn 100 mm long spans 100 mm / 0.127 mm ≈ 787.4 px → 1000 cm.
    expect((100 / 25.4) * 200 * cmPerPixelForDrawing(100, scale)).toBeCloseTo(1000, 6);
  });

  it('caps large sheets by pixel count and side length, keeping real size correct', () => {
    const scale = pdfRenderScale(2383.94, 1683.78);
    expect(2383.94 * scale * 1683.78 * scale).toBeLessThanOrEqual(PLAN_PIXEL_LIMIT + 1);
    expect(2383.94 * scale).toBeLessThanOrEqual(PLAN_SIDE_LIMIT);
    // Whatever the render resolution, the sheet width stays 841 mm × 100 = 84.1 m.
    expect(2383.94 * scale * cmPerPixelForDrawing(100, scale)).toBeCloseTo(8410, -1);
    expect(pdfRenderScale(14400, 100)).toBeCloseTo(PLAN_SIDE_LIMIT / 14400, 9);
  });

  it('rejects impossible input', () => {
    expect(() => pdfRenderScale(0, 100)).toThrow();
    expect(() => cmPerPixelForDrawing(0, 1)).toThrow();
    expect(() => cmPerPixelForDrawing(100, Number.NaN)).toThrow();
  });

  it('parses typed scales', () => {
    expect(parseDrawingScale('1:75')).toBe(75);
    expect(parseDrawingScale(' 1 : 100 ')).toBe(100);
    expect(parseDrawingScale('250')).toBe(250);
    expect(parseDrawingScale('1:2,5')).toBe(2.5);
    for (const bad of ['', '1:0', 'abc', '2:100', '1:99999', '-50']) expect(parseDrawingScale(bad)).toBeNull();
  });

  it('recognises PDFs by name, type and header bytes', () => {
    expect(isPdfFile({ name: 'Projekt.PDF', type: '' })).toBe(true);
    expect(isPdfFile({ name: 'rzut', type: 'application/pdf' })).toBe(true);
    expect(isPdfFile({ name: 'rzut.png', type: 'image/png' })).toBe(false);
    expect(isPdfBytes(new TextEncoder().encode('%PDF-1.7\n'))).toBe(true);
    expect(isPdfBytes(new TextEncoder().encode('<html>'))).toBe(false);
  });
});

describe('room from dimensions', () => {
  beforeEach(() => {
    currentProject.set(createDefaultProject('Room test'));
    detectedRoomsStore.set([]);
  });

  it('places wall centrelines half a thickness outside the clear interior', () => {
    const walls = rectangleRoomWalls({ x: 0, y: 0 }, 400, 300, 12);
    expect(walls[0]).toEqual({ start: { x: -206, y: -156 }, end: { x: 206, y: -156 } });
    expect(walls[2].start).toEqual({ x: 206, y: 156 });
    expect(walls.every((w, i) => w.end === walls[(i + 1) % 4].start || (w.end.x === walls[(i + 1) % 4].start.x && w.end.y === walls[(i + 1) % 4].start.y))).toBe(true);
  });

  it('validates dimensions and maps room categories', () => {
    expect(validRoomDimensions({ length: 400, width: 300, height: 260 })).toBe(true);
    expect(validRoomDimensions({ length: 40, width: 300, height: 260 })).toBe(false);
    expect(validRoomDimensions({ length: 400, width: 300, height: 100 })).toBe(false);
    expect(validRoomDimensions({ length: Number.NaN, width: 300, height: 260 })).toBe(false);
    expect(roomCategoryFor('garage')).toBe('garage');
    expect(roomCategoryFor('pantry')).toBe('utility');
    expect(roomCategoryFor('bedroom')).toBe('indoor');
    expect(roomCategoryFor(null)).toBe('indoor');
  });

  it('creates one named room with the exact clear area, wall height and details', () => {
    const id = addRoomFromDimensions({ center: { x: 500, y: 500 }, length: 420, width: 315, height: 255, thickness: 12, name: 'Sypialnia', roomType: 'bedroom' });
    expect(id).toBeTruthy();
    const floor = get(activeFloor)!;
    expect(floor.walls).toHaveLength(4);
    expect(floor.walls.every(w => w.thickness === 12 && w.height === 255)).toBe(true);
    const room = floor.rooms.find(r => r.id === id)!;
    expect(room).toMatchObject({ name: 'Sypialnia', roomType: 'indoor' });
    const polygon = resolveRoomGeometry(floor).find(g => g.room.id === id)!.polygon;
    expect(interiorRoomArea(polygon, [], floor.walls)).toBeCloseTo(4.2 * 3.15, 2);
    expect(itemDetails(get(currentProject)!, { floorId: floor.id, kind: 'rooms', id: id! })).toMatchObject({ roomType: 'bedroom', ceilingHeight: 255 });
  });

  it('ignores an unknown room type and refuses invalid sizes', () => {
    const id = addRoomFromDimensions({ center: { x: 0, y: 0 }, length: 300, width: 300, height: 250, thickness: 25, name: '', roomType: 'dungeon' });
    const floor = get(activeFloor)!;
    expect(floor.rooms.find(r => r.id === id)?.name).toBeTruthy();
    expect(itemDetails(get(currentProject)!, { floorId: floor.id, kind: 'rooms', id: id! }).roomType ?? null).toBeNull();
    expect(() => addRoomFromDimensions({ center: { x: 0, y: 0 }, length: 10, width: 300, height: 250, thickness: 12, name: 'x' })).toThrow();
  });
});

describe('room estimate from photos', () => {
  it('reads a clean reply, rounds to 5 cm and orders length ≥ width', () => {
    const estimate = parseRoomEstimate('```json\n{"roomType":"kitchen","name":"Kuchnia","length":312,"width":"418,4","height":262,"confidence":"medium","notes":"Drzwi 80 cm jako odniesienie."}\n```');
    expect(estimate).toEqual({ name: 'Kuchnia', roomType: 'kitchen', length: 420, width: 310, height: 260, confidence: 'medium', notes: 'Drzwi 80 cm jako odniesienie.' });
  });

  it('turns impossible or unknown values into null and low confidence', () => {
    const estimate = parseRoomEstimate('{"roomType":"ballroom","length":99999,"width":null,"height":20,"confidence":"certain"}');
    expect(estimate).toMatchObject({ roomType: null, length: null, width: null, height: null, confidence: 'low', notes: '', name: null });
    expect(() => parseRoomEstimate('I cannot tell.')).toThrow();
    expect(() => parseRoomEstimate('{not json}')).toThrow();
  });

  it('asks for the user language and includes a trimmed hint', () => {
    const prompt = roomAnalysisPrompt('pl', '  okno ma 150 cm  ');
    expect(prompt).toContain('Polish');
    expect(prompt).toContain('"""okno ma 150 cm"""');
    expect(roomAnalysisPrompt('en', '')).not.toContain('The owner adds');
  });

  it('sends photos to /chat/completions with the key and parses the answer', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({
      choices: [{ message: { content: '{"roomType":"bathroom","name":"Łazienka","length":250,"width":180,"height":250,"confidence":"high","notes":"Płytki 30×60."}' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const estimate = await estimateRoomFromPhotos({ apiKey: 'test-key', baseUrl: 'https://provider.test/v1', model: 'vision-model' },
      ['data:image/jpeg;base64,AAAA', 'data:image/jpeg;base64,BBBB'], 'pl', '', fetchMock as unknown as typeof fetch);
    expect(estimate).toMatchObject({ roomType: 'bathroom', length: 250, width: 180, confidence: 'high' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://provider.test/v1/chat/completions');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    expect(init!.credentials).toBe('omit');
    const body = JSON.parse(init!.body as string);
    expect(body.model).toBe('vision-model');
    expect(body.messages[0].content.filter((p: { type: string }) => p.type === 'image_url')).toHaveLength(2);
  });

  it('reports provider failures without echoing the response body', async () => {
    const fetchMock = vi.fn(async () => new Response('{"error":"secret-key-echo"}', { status: 401 }));
    await expect(chatWithImages({ apiKey: 'k', baseUrl: 'https://provider.test/v1' }, 'p', ['data:image/png;base64,AA'], fetchMock as unknown as typeof fetch))
      .rejects.toThrow(/HTTP 401/);
    await expect(chatWithImages({ apiKey: 'k', baseUrl: 'https://provider.test/v1' }, 'p', ['data:image/png;base64,AA'], fetchMock as unknown as typeof fetch))
      .rejects.not.toThrow(/secret/);
    const empty = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), { status: 200 }));
    await expect(chatWithImages({ apiKey: 'k', baseUrl: 'https://provider.test/v1' }, 'p', [], empty as unknown as typeof fetch)).rejects.toThrow(/no text/);
  });
});
