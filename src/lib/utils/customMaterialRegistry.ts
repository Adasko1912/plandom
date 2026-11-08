/** Dependency-free registry of the current project's custom materials, read by texture and material lookups. */
export const CUSTOM_MATERIAL_PREFIX = 'custom:';

export interface RegisteredCustomMaterial {
  id: string;
  name: string;
  color: string;
  textureDataUrl?: string;
  tileWidth: number;
  tileHeight: number;
}

let registry = new Map<string, RegisteredCustomMaterial>();
const listeners = new Set<(changed: string[]) => void>();

export const customMaterialKey = (id: string) => `${CUSTOM_MATERIAL_PREFIX}${id}`;
export const isCustomMaterialKey = (key: string | undefined | null): key is string => !!key && key.startsWith(CUSTOM_MATERIAL_PREFIX);

export function registeredCustomMaterial(key: string): RegisteredCustomMaterial | undefined {
  return isCustomMaterialKey(key) ? registry.get(key) : undefined;
}

/** Replaces the registry; listeners get the keys whose texture or size changed or disappeared. */
export function registerCustomMaterials(list: RegisteredCustomMaterial[]): void {
  const next = new Map(list.map(m => [customMaterialKey(m.id), m]));
  const changed: string[] = [];
  for (const [key, old] of registry) {
    const now = next.get(key);
    if (!now || now.textureDataUrl !== old.textureDataUrl || now.tileWidth !== old.tileWidth || now.tileHeight !== old.tileHeight || now.color !== old.color) changed.push(key);
  }
  registry = next;
  if (changed.length) for (const listener of listeners) listener(changed);
}

export function onCustomMaterialChange(listener: (changed: string[]) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
