import { registeredCustomMaterial } from './customMaterialRegistry';
export interface FloorMaterial {
  id: string;
  name: string;
  color: string;
  pattern?: 'hardwood' | 'tile' | 'carpet' | 'concrete' | 'marble' | 'bamboo' | 'laminate' | 'slate' | 'vinyl';
  roughness?: number;
}

export interface WallColor {
  id: string;
  name: string;
  color: string;
  texture?: 'brick' | 'stone' | 'wood-panel' | 'concrete' | 'tile';
  /** Listed with the textures only, not among the paint colours. */
  finishOnly?: boolean;
}

export const floorMaterials: FloorMaterial[] = [
  // 'none' = no texture; floor renders as a solid color (room.color when set)
  { id: 'none', name: 'Solid Color', color: '#e8e4dc', roughness: 0.9 },
  { id: 'light-oak', name: 'Light Oak', color: '#ddc9a8', pattern: 'hardwood', roughness: 0.8 },
  { id: 'walnut', name: 'Walnut', color: '#8b6f47', pattern: 'hardwood', roughness: 0.8 },
  { id: 'bamboo', name: 'Bamboo', color: '#e6d3a7', pattern: 'bamboo', roughness: 0.7 },
  { id: 'laminate', name: 'Laminate', color: '#b8a082', pattern: 'laminate', roughness: 0.6 },
  { id: 'ceramic-white', name: 'White Tile', color: '#f8f8f8', pattern: 'tile', roughness: 0.3 },
  { id: 'ceramic-gray', name: 'Gray Tile', color: '#d4cfc9', pattern: 'tile', roughness: 0.3 },
  { id: 'porcelain', name: 'Porcelain', color: '#f5f5f5', pattern: 'tile', roughness: 0.2 },
  { id: 'marble-white', name: 'White Marble', color: '#f8f6f0', pattern: 'marble', roughness: 0.1 },
  { id: 'marble-dark', name: 'Dark Marble', color: '#4a4a4a', pattern: 'marble', roughness: 0.1 },
  { id: 'carpet-beige', name: 'Beige Carpet', color: '#d2b48c', pattern: 'carpet', roughness: 1.0 },
  { id: 'carpet-gray', name: 'Gray Carpet', color: '#a8a29e', pattern: 'carpet', roughness: 1.0 },
  { id: 'concrete', name: 'Concrete', color: '#9ca3af', pattern: 'concrete', roughness: 0.9 },
  { id: 'slate', name: 'Slate', color: '#708090', pattern: 'slate', roughness: 0.8 },
  { id: 'vinyl', name: 'Vinyl', color: '#c4a882', pattern: 'vinyl', roughness: 0.5 },
  // Finishes common in Polish DIY stores (textures: ambientCG, CC0)
  { id: 'oak-natural', name: "Natural Oak", color: '#9b7b5d', pattern: 'hardwood', roughness: 0.75 },
  { id: 'oak-honey', name: "Honey Oak", color: '#6c4314', pattern: 'hardwood', roughness: 0.75 },
  { id: 'oak-bleached', name: "Bleached Oak", color: '#e0c59b', pattern: 'hardwood', roughness: 0.75 },
  { id: 'oak-grey', name: "Grey Oak", color: '#9d8166', pattern: 'hardwood', roughness: 0.75 },
  { id: 'oak-rustic', name: "Rustic Oak", color: '#916c43', pattern: 'hardwood', roughness: 0.8 },
  { id: 'oak-dark', name: "Dark Oak", color: '#44332f', pattern: 'hardwood', roughness: 0.7 },
  { id: 'plank-aged', name: "Aged Plank", color: '#5c4b39', pattern: 'hardwood', roughness: 0.85 },
  { id: 'vinyl-oak', name: "Vinyl Light Oak", color: '#9f7147', pattern: 'hardwood', roughness: 0.5 },
  { id: 'vinyl-dark', name: "Vinyl Dark Wood", color: '#433728', pattern: 'hardwood', roughness: 0.5 },
  { id: 'herringbone', name: "Herringbone", color: '#907057', pattern: 'hardwood', roughness: 0.6 },
  { id: 'chevron', name: "Chevron", color: '#99795c', pattern: 'hardwood', roughness: 0.6 },
  { id: 'parquet-classic', name: "Classic Parquet", color: '#9a7a5d', pattern: 'hardwood', roughness: 0.6 },
  { id: 'parquet-light', name: "Light Parquet", color: '#cc9268', pattern: 'hardwood', roughness: 0.6 },
  { id: 'parquet-dark', name: "Dark Parquet", color: '#59360e', pattern: 'hardwood', roughness: 0.55 },
  { id: 'gres-white', name: "White Porcelain", color: '#d3cac2', pattern: 'tile', roughness: 0.3 },
  { id: 'gres-beige', name: "Beige Porcelain", color: '#b49f89', pattern: 'tile', roughness: 0.35 },
  { id: 'gres-anthracite', name: "Anthracite Porcelain", color: '#353636', pattern: 'tile', roughness: 0.35 },
  { id: 'gres-concrete', name: "Concrete-look Porcelain", color: '#63615c', pattern: 'tile', roughness: 0.5 },
  { id: 'tile-checker', name: "Checkerboard Tile", color: '#868481', pattern: 'tile', roughness: 0.3 },
  { id: 'tile-marble-checker', name: "Marble Checkerboard", color: '#554b43', pattern: 'tile', roughness: 0.2 },
  { id: 'tile-patchwork', name: "Patchwork Tile", color: '#997d57', pattern: 'tile', roughness: 0.35 },
  { id: 'hex-white', name: "White Hexagon", color: '#ecebeb', pattern: 'tile', roughness: 0.3 },
  { id: 'hex-dark', name: "Dark Hexagon", color: '#25292c', pattern: 'tile', roughness: 0.4 },
  { id: 'mosaic-white', name: "White Mosaic", color: '#d1dde0', pattern: 'tile', roughness: 0.3 },
  { id: 'mosaic-blue', name: "Blue Mosaic", color: '#41505c', pattern: 'tile', roughness: 0.25 },
  { id: 'terrazzo-light', name: "Light Terrazzo", color: '#d1ccc7', pattern: 'tile', roughness: 0.3 },
  { id: 'terrazzo-grey', name: "Grey Terrazzo", color: '#c1bcb8', pattern: 'tile', roughness: 0.3 },
  { id: 'travertine', name: "Travertine", color: '#dfcbac', pattern: 'marble', roughness: 0.3 },
  { id: 'marble-cream', name: "Cream Marble", color: '#d1c4b1', pattern: 'marble', roughness: 0.15 },
  { id: 'marble-black', name: "Black Marble", color: '#575e64', pattern: 'marble', roughness: 0.15 },
  { id: 'carpet-cream', name: "Cream Carpet", color: '#bcb093', pattern: 'carpet', roughness: 1 },
  { id: 'carpet-navy', name: "Navy Carpet", color: '#343b48', pattern: 'carpet', roughness: 1 },
];

export const wallColors: WallColor[] = [
  { id: 'white', name: 'White', color: '#ffffff' },
  { id: 'cream', name: 'Cream', color: '#fffdd0' },
  { id: 'warm-white', name: 'Warm White', color: '#faf7f2' },
  { id: 'light-gray', name: 'Light Gray', color: '#d1d5db' },
  { id: 'medium-gray', name: 'Medium Gray', color: '#9ca3af' },
  { id: 'charcoal', name: 'Charcoal', color: '#374151' },
  { id: 'navy-blue', name: 'Navy Blue', color: '#1e3a8a' },
  { id: 'light-blue', name: 'Light Blue', color: '#dbeafe' },
  { id: 'sage-green', name: 'Sage Green', color: '#d4e2d4' },
  { id: 'olive', name: 'Olive', color: '#a3a058' },
  { id: 'terracotta', name: 'Terracotta', color: '#d2691e' },
  { id: 'blush-pink', name: 'Blush Pink', color: '#f4c2c2' },
  { id: 'lavender', name: 'Lavender', color: '#e6e6fa' },
  { id: 'butter-yellow', name: 'Butter Yellow', color: '#fff8dc' },
  { id: 'taupe', name: 'Taupe', color: '#b8a082' },
  // Textured walls
  { id: 'red-brick', name: 'Red Brick', color: '#8B4513', texture: 'brick' },
  { id: 'exposed-brick', name: 'Exposed Brick', color: '#A0522D', texture: 'brick' },
  { id: 'stone', name: 'Stone', color: '#808080', texture: 'stone' },
  { id: 'wood-panel', name: 'Wood Panel', color: '#8B6914', texture: 'wood-panel' },
  { id: 'concrete-block', name: 'Concrete Block', color: '#999999', texture: 'concrete' },
  { id: 'subway-tile', name: 'Subway Tile', color: '#F0F0F0', texture: 'tile' },
  { id: 'white-brick', name: "White Brick", color: '#ddd7d3', texture: 'brick', finishOnly: true },
  { id: 'cream-brick', name: "Cream Brick", color: '#b9946b', texture: 'brick', finishOnly: true },
  { id: 'stone-cladding', name: "Stone Cladding", color: '#8d836e', texture: 'stone', finishOnly: true },
  { id: 'sandstone-wall', name: "Sandstone", color: '#927955', texture: 'stone', finishOnly: true },
  { id: 'wood-cladding', name: "Wood Cladding", color: '#4d3e33', texture: 'wood-panel', finishOnly: true },
  { id: 'plaster-white', name: "White Plaster", color: '#d7d3d0', texture: 'concrete', finishOnly: true },
  { id: 'arch-concrete', name: "Architectural Concrete", color: '#989488', texture: 'concrete', finishOnly: true },
  { id: 'wall-metro-white', name: "White Metro Tile", color: '#ccced1', texture: 'tile', finishOnly: true },
  { id: 'wall-zellige-green', name: "Green Glazed Tile", color: '#1e4f37', texture: 'tile', finishOnly: true },
  { id: 'wall-tile-teal', name: "Teal Glazed Tile", color: '#1a4c57', texture: 'tile', finishOnly: true },
  { id: 'wall-marble-white', name: "Marble Wall", color: '#acadb6', texture: 'stone', finishOnly: true },
  { id: 'wall-onyx', name: "Onyx", color: '#cdcbc8', texture: 'stone', finishOnly: true },
  { id: 'wall-gres-white', name: "White Porcelain Wall", color: '#d3cac2', texture: 'tile', finishOnly: true },
  { id: 'wall-gres-beige', name: "Beige Porcelain Wall", color: '#b49f89', texture: 'tile', finishOnly: true },
  { id: 'wall-gres-anthracite', name: "Anthracite Porcelain Wall", color: '#353636', texture: 'tile', finishOnly: true },
  { id: 'wall-terrazzo', name: "Terrazzo Wall", color: '#d1ccc7', texture: 'tile', finishOnly: true },
];

export function getMaterial(id: string): FloorMaterial {
  const custom = registeredCustomMaterial(id);
  if (custom) return { id, name: custom.name, color: custom.color, roughness: 0.7 };
  // Handle legacy material IDs
  const legacyMap: Record<string, string> = {
    'hardwood': 'light-oak',
    'tile': 'ceramic-white', 
    'carpet': 'carpet-beige',
    'marble': 'marble-white',
    'light-wood': 'light-oak',
    'dark-wood': 'walnut',
  };
  
  const materialId = legacyMap[id] || id;
  return floorMaterials.find(m => m.id === materialId)
    ?? floorMaterials.find(m => m.id === 'light-oak')!;
}

export function getWallColor(id: string): WallColor {
  // Handle legacy color IDs
  const legacyMap: Record<string, string> = {
    'gray': 'light-gray',
    'beige': 'cream',
    'sage': 'sage-green',
  };
  
  const colorId = legacyMap[id] || id;
  return wallColors.find(c => c.id === colorId) ?? wallColors[0];
}
