import { chatWithImages, type OpenAIConfig } from './openaiClient';
import { ROOM_TYPES } from './itemDetails';
import { ROOM_MAX_HEIGHT, ROOM_MAX_SIDE, ROOM_MIN_HEIGHT, ROOM_MIN_SIDE } from './roomFromDimensions';

export const MAX_ANALYSIS_PHOTOS = 6;

export interface RoomEstimate {
  name: string | null;
  roomType: string | null;
  length: number | null;
  width: number | null;
  height: number | null;
  confidence: 'low' | 'medium' | 'high';
  notes: string;
}

const LANGUAGES: Record<string, string> = { pl: 'Polish', en: 'English', pt: 'Portuguese' };

/** The instruction sent with the photos. Polish reference sizes keep estimates realistic. */
export function roomAnalysisPrompt(locale: string, hint: string): string {
  const language = LANGUAGES[locale] ?? 'English';
  return [
    'You estimate the clear interior dimensions of ONE room from the attached photos.',
    'Use objects of standard size as references, for example: interior doors 80–90 cm wide and about 205 cm high (door leaf 200 cm),',
    'kitchen worktops 85–90 cm high, wall sockets about 30 cm above the floor, light switches about 110 cm, radiators 60 cm high,',
    'floor tiles 60×60 or 30×60 cm, single beds 90×200 cm, double beds 160×200 cm. Polish ceilings are usually 250–280 cm.',
    hint.trim() ? `The owner adds: """${hint.trim().slice(0, 500)}"""` : '',
    `Reply with JSON only, no markdown: {"roomType": one of ${JSON.stringify(ROOM_TYPES)} or null,`,
    `"name": a short room name in ${language}, "length": cm (longer side), "width": cm, "height": cm,`,
    `"confidence": "low" | "medium" | "high", "notes": one or two sentences in ${language} naming the references used and what is uncertain}.`,
    'Use null for any dimension that cannot be estimated. Never invent precision: round to 5 cm.',
  ].filter(Boolean).join('\n');
}

function number(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n / 5) * 5;
}

/** Reads the model reply strictly: unknown fields are ignored, impossible values become null. */
export function parseRoomEstimate(reply: string): RoomEstimate {
  const start = reply.indexOf('{'), end = reply.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The AI reply contained no estimate. Try again or enter the dimensions yourself.');
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(reply.slice(start, end + 1)); } catch { throw new Error('The AI reply could not be read. Try again or enter the dimensions yourself.'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('The AI reply could not be read.');
  let length = number(raw.length, ROOM_MIN_SIDE, ROOM_MAX_SIDE);
  let width = number(raw.width, ROOM_MIN_SIDE, ROOM_MAX_SIDE);
  if (length !== null && width !== null && width > length) [length, width] = [width, length];
  const text = (v: unknown, max: number) => typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
  return {
    name: text(raw.name, 80),
    roomType: typeof raw.roomType === 'string' && ROOM_TYPES.includes(raw.roomType) ? raw.roomType : null,
    length, width,
    height: number(raw.height, ROOM_MIN_HEIGHT, ROOM_MAX_HEIGHT),
    confidence: raw.confidence === 'high' || raw.confidence === 'medium' ? raw.confidence : 'low',
    notes: text(raw.notes, 400) ?? '',
  };
}

export async function estimateRoomFromPhotos(
  config: OpenAIConfig, photos: string[], locale: string, hint = '',
  customFetch: typeof fetch = fetch, signal?: AbortSignal,
): Promise<RoomEstimate> {
  if (!photos.length) throw new Error('Add at least one photo of the room.');
  const reply = await chatWithImages(config, roomAnalysisPrompt(locale, hint), photos.slice(0, MAX_ANALYSIS_PHOTOS), customFetch, signal);
  return parseRoomEstimate(reply);
}
