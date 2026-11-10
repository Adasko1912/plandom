import type { FurnitureDef } from './furnitureCatalog';

/**
 * Generic product sizes common in Polish furniture and DIY stores. These are typical
 * dimensions, not any shop's products: names, photos and descriptions are not copied.
 * Models are the bundled CC0 Kenney Furniture Kit, stretched to each listed size.
 */
type Row = [
  id: string, en: string, pl: string, pt: string, category: string, icon: string, color: string,
  width: number, depth: number, height: number,
  /** Bundled model file, or null for a procedural shape. */
  model: string | null,
  /** Existing catalog item supplying the 2D symbol and the placeholder 3D shape. */
  base: string,
  /** Height of the underside above the floor, for items hung on a wall. */
  mountHeight?: number,
];

const SOFA = '#a78bfa', WOOD = '#92400e', OAK = '#a16207', WHITE = '#e5e7eb', STEEL = '#94a3b8', DARK = '#475569', RUG = '#c2956b', LAMP = '#fde68a';

const rows: Row[] = [
  // Sofas and corner sofas
  ['sofa_2', 'Sofa 2-seat', 'Sofa 2-osobowa', 'Sofá 2 lugares', 'Living Room', '🛋️', SOFA, 160, 92, 85, 'loungeDesignSofa', 'loveseat'],
  ['sofa_2_bed', 'Sofa bed 2-seat', 'Sofa 2-osobowa rozkładana', 'Sofá-cama 2 lugares', 'Living Room', '🛋️', SOFA, 175, 98, 90, 'loungeSofa', 'loveseat'],
  ['sofa_3', 'Sofa 3-seat', 'Sofa 3-osobowa', 'Sofá 3 lugares', 'Living Room', '🛋️', SOFA, 220, 95, 85, 'loungeDesignSofa', 'sofa'],
  ['sofa_3_bed', 'Sofa bed 3-seat', 'Sofa 3-osobowa rozkładana', 'Sofá-cama 3 lugares', 'Living Room', '🛋️', SOFA, 235, 100, 90, 'loungeSofa', 'sofa'],
  ['sofa_4', 'Sofa 4-seat', 'Sofa 4-osobowa', 'Sofá 4 lugares', 'Living Room', '🛋️', SOFA, 265, 100, 85, 'loungeSofaLong', 'sofa'],
  ['sofa_chaise', 'Sofa with chaise', 'Sofa z szezlongiem', 'Sofá com chaise', 'Living Room', '🛋️', SOFA, 240, 150, 85, 'loungeSofaCorner', 'sofa_corner'],
  ['corner_small', 'Small corner sofa', 'Narożnik mały', 'Sofá de canto pequeno', 'Living Room', '🛋️', SOFA, 230, 165, 85, 'loungeDesignSofaCorner', 'sofa_corner'],
  ['corner_medium', 'Corner sofa', 'Narożnik', 'Sofá de canto', 'Living Room', '🛋️', SOFA, 270, 190, 85, 'loungeDesignSofaCorner', 'sofa_corner'],
  ['corner_bed', 'Corner sofa bed', 'Narożnik rozkładany', 'Sofá de canto com cama', 'Living Room', '🛋️', SOFA, 290, 200, 90, 'loungeSofaCorner', 'sofa_corner'],
  ['corner_large', 'Large corner sofa', 'Narożnik duży', 'Sofá de canto grande', 'Living Room', '🛋️', SOFA, 320, 210, 90, 'loungeSofaCorner', 'sofa_corner'],
  ['corner_u', 'U-shaped sofa', 'Narożnik w kształcie U', 'Sofá em U', 'Living Room', '🛋️', '#c98a84', 340, 200, 85, null, 'sofa_u'],
  ['ottoman', 'Ottoman', 'Pufa', 'Pufe', 'Living Room', '🪑', SOFA, 60, 60, 45, 'loungeSofaOttoman', 'side_table'],
  ['ottoman_large', 'Large ottoman', 'Pufa duża', 'Pufe grande', 'Living Room', '🪑', SOFA, 100, 70, 45, 'loungeSofaOttoman', 'side_table'],
  ['armchair_wing', 'Wingback armchair', 'Fotel uszak', 'Poltrona bergère', 'Living Room', '💺', SOFA, 80, 85, 105, 'loungeDesignChair', 'chair'],
  ['armchair_recliner', 'Recliner', 'Fotel rozkładany', 'Poltrona reclinável', 'Living Room', '💺', SOFA, 85, 95, 105, 'loungeChairRelax', 'chair'],

  // Living room storage and tables
  ['tv_stand_120', 'TV stand 120 cm', 'Szafka RTV 120 cm', 'Rack TV 120 cm', 'Living Room', '📺', DARK, 120, 40, 50, 'cabinetTelevision', 'tv_stand'],
  ['tv_stand_160', 'TV stand 160 cm', 'Szafka RTV 160 cm', 'Rack TV 160 cm', 'Living Room', '📺', DARK, 160, 40, 50, 'cabinetTelevisionDoors', 'tv_stand'],
  ['tv_stand_200', 'TV stand 200 cm', 'Szafka RTV 200 cm', 'Rack TV 200 cm', 'Living Room', '📺', DARK, 200, 42, 50, 'cabinetTelevisionDoors', 'tv_stand'],
  ['tv_43', 'TV 43 inch', 'Telewizor 43 cale', 'TV 43 polegadas', 'Living Room', '📺', '#1e293b', 96, 8, 60, 'televisionModern', 'television'],
  ['tv_55', 'TV 55 inch', 'Telewizor 55 cali', 'TV 55 polegadas', 'Living Room', '📺', '#1e293b', 123, 8, 75, 'televisionModern', 'television'],
  ['tv_65', 'TV 65 inch', 'Telewizor 65 cali', 'TV 65 polegadas', 'Living Room', '📺', '#1e293b', 145, 8, 87, 'televisionModern', 'television'],
  ['tv_75', 'TV 75 inch', 'Telewizor 75 cali', 'TV 75 polegadas', 'Living Room', '📺', '#1e293b', 168, 8, 100, 'televisionModern', 'television'],
  ['coffee_square', 'Square coffee table', 'Stolik kawowy kwadratowy', 'Mesa de centro quadrada', 'Living Room', '☕', WOOD, 80, 80, 42, 'tableCoffeeSquare', 'coffee_table'],
  ['coffee_glass', 'Glass coffee table', 'Stolik szklany', 'Mesa de centro de vidro', 'Living Room', '☕', STEEL, 110, 60, 42, 'tableCoffeeGlass', 'coffee_table'],
  ['coffee_glass_square', 'Square glass coffee table', 'Stolik szklany kwadratowy', 'Mesa de vidro quadrada', 'Living Room', '☕', STEEL, 80, 80, 42, 'tableCoffeeGlassSquare', 'coffee_table'],
  ['side_table_drawers', 'Side table with drawers', 'Stolik z szufladami', 'Mesa lateral com gavetas', 'Living Room', '🪑', OAK, 50, 40, 60, 'sideTableDrawers', 'side_table'],
  ['shelf_low', 'Low bookcase', 'Regał niski', 'Estante baixa', 'Living Room', '📚', WOOD, 80, 35, 90, 'bookcaseOpenLow', 'bookshelf'],
  ['shelf_tall', 'Tall bookcase', 'Regał wysoki', 'Estante alta', 'Living Room', '📚', WOOD, 80, 35, 200, 'bookcaseOpen', 'bookshelf'],
  ['shelf_wide', 'Wide bookcase', 'Regał szeroki', 'Estante larga', 'Living Room', '📚', WOOD, 160, 35, 200, 'bookcaseOpen', 'bookshelf'],
  ['display_cabinet', 'Display cabinet', 'Witryna', 'Cristaleira', 'Living Room', '🗄️', OAK, 90, 40, 200, 'bookcaseClosedDoors', 'storage'],
  ['sideboard', 'Sideboard', 'Komoda salonowa', 'Aparador', 'Living Room', '🗄️', OAK, 160, 42, 85, 'cabinetTelevisionDoors', 'dresser'],

  // Beds: width is the bed's length, as for the existing beds
  ['bed_90', 'Bed 90 × 200', 'Łóżko 90 × 200', 'Cama 90 × 200', 'Bedroom', '🛏️', '#93c5fd', 208, 98, 50, 'bedSingle', 'bed_twin'],
  ['bed_120', 'Bed 120 × 200', 'Łóżko 120 × 200', 'Cama 120 × 200', 'Bedroom', '🛏️', '#93c5fd', 208, 128, 50, 'bedSingle', 'bed_twin'],
  ['bed_140', 'Bed 140 × 200', 'Łóżko 140 × 200', 'Cama 140 × 200', 'Bedroom', '🛏️', '#60a5fa', 208, 148, 50, 'bedDouble', 'bed_queen'],
  ['bed_160', 'Bed 160 × 200', 'Łóżko 160 × 200', 'Cama 160 × 200', 'Bedroom', '🛏️', '#60a5fa', 208, 168, 50, 'bedDouble', 'bed_queen'],
  ['bed_180', 'Bed 180 × 200', 'Łóżko 180 × 200', 'Cama 180 × 200', 'Bedroom', '🛏️', '#60a5fa', 208, 188, 50, 'bedDouble', 'bed_queen'],
  ['bed_200', 'Bed 200 × 200', 'Łóżko 200 × 200', 'Cama 200 × 200', 'Bedroom', '🛏️', '#60a5fa', 208, 208, 50, 'bedDouble', 'bed_queen'],
  ['bed_box_160', 'Boxspring bed 160', 'Łóżko kontynentalne 160', 'Cama box 160', 'Bedroom', '🛏️', '#3b82f6', 215, 175, 115, 'bedDouble', 'bed_queen'],
  ['bed_box_180', 'Boxspring bed 180', 'Łóżko kontynentalne 180', 'Cama box 180', 'Bedroom', '🛏️', '#3b82f6', 215, 195, 115, 'bedDouble', 'bed_queen'],
  ['bed_bunk', 'Bunk bed', 'Łóżko piętrowe', 'Beliche', 'Bedroom', '🛏️', '#93c5fd', 208, 98, 165, 'bedBunk', 'bed_twin'],

  // Wardrobes and drawers
  ['wardrobe_100', 'Wardrobe 100 cm', 'Szafa 100 cm', 'Roupeiro 100 cm', 'Bedroom', '🗄️', OAK, 100, 58, 210, 'bookcaseClosedDoors', 'wardrobe'],
  ['wardrobe_150', 'Wardrobe 150 cm', 'Szafa 150 cm', 'Roupeiro 150 cm', 'Bedroom', '🗄️', OAK, 150, 58, 210, 'bookcaseClosedDoors', 'wardrobe'],
  ['wardrobe_200', 'Sliding wardrobe 200 cm', 'Szafa przesuwna 200 cm', 'Roupeiro de correr 200 cm', 'Bedroom', '🗄️', OAK, 200, 62, 220, 'bookcaseClosedDoors', 'wardrobe'],
  ['wardrobe_250', 'Sliding wardrobe 250 cm', 'Szafa przesuwna 250 cm', 'Roupeiro de correr 250 cm', 'Bedroom', '🗄️', OAK, 250, 62, 220, 'bookcaseClosedDoors', 'wardrobe'],
  ['dresser_80', 'Chest of drawers 80 cm', 'Komoda 80 cm', 'Cômoda 80 cm', 'Bedroom', '🗄️', WOOD, 80, 42, 85, 'cabinetBedDrawer', 'dresser'],
  ['dresser_160', 'Chest of drawers 160 cm', 'Komoda 160 cm', 'Cômoda 160 cm', 'Bedroom', '🗄️', WOOD, 160, 42, 85, 'cabinetBedDrawer', 'dresser'],
  ['nightstand_small', 'Small nightstand', 'Szafka nocna mała', 'Mesa de cabeceira pequena', 'Bedroom', '🛏️', OAK, 40, 35, 45, 'cabinetBed', 'nightstand'],
  ['dressing_table', 'Dressing table', 'Toaletka', 'Penteadeira', 'Bedroom', '🪞', OAK, 100, 42, 76, 'desk', 'desk'],

  // Kitchen units: base units include the worktop (85 cm)
  ['kitchen_base_30', 'Base unit 30 cm', 'Szafka dolna 30 cm', 'Armário base 30 cm', 'Kitchen', '🔲', '#78716c', 30, 60, 85, 'kitchenCabinet', 'counter'],
  ['kitchen_base_40', 'Base unit 40 cm', 'Szafka dolna 40 cm', 'Armário base 40 cm', 'Kitchen', '🔲', '#78716c', 40, 60, 85, 'kitchenCabinet', 'counter'],
  ['kitchen_base_60', 'Base unit 60 cm', 'Szafka dolna 60 cm', 'Armário base 60 cm', 'Kitchen', '🔲', '#78716c', 60, 60, 85, 'kitchenCabinet', 'counter'],
  ['kitchen_base_80', 'Base unit 80 cm', 'Szafka dolna 80 cm', 'Armário base 80 cm', 'Kitchen', '🔲', '#78716c', 80, 60, 85, 'kitchenCabinet', 'counter'],
  ['kitchen_drawer_60', 'Drawer unit 60 cm', 'Szafka z szufladami 60 cm', 'Gaveteiro 60 cm', 'Kitchen', '🔲', '#78716c', 60, 60, 85, 'kitchenCabinetDrawer', 'counter'],
  ['kitchen_drawer_80', 'Drawer unit 80 cm', 'Szafka z szufladami 80 cm', 'Gaveteiro 80 cm', 'Kitchen', '🔲', '#78716c', 80, 60, 85, 'kitchenCabinetDrawer', 'counter'],
  ['kitchen_corner', 'Corner base unit', 'Szafka narożna dolna', 'Armário de canto', 'Kitchen', '🔲', '#78716c', 90, 90, 85, 'kitchenCabinetCornerInner', 'counter'],
  ['kitchen_upper_40', 'Wall unit 40 cm', 'Szafka górna 40 cm', 'Armário alto 40 cm', 'Kitchen', '🔲', '#a8a29e', 40, 32, 72, 'kitchenCabinetUpper', 'counter', 145],
  ['kitchen_upper_60', 'Wall unit 60 cm', 'Szafka górna 60 cm', 'Armário alto 60 cm', 'Kitchen', '🔲', '#a8a29e', 60, 32, 72, 'kitchenCabinetUpper', 'counter', 145],
  ['kitchen_upper_80', 'Wall unit 80 cm', 'Szafka górna 80 cm', 'Armário alto 80 cm', 'Kitchen', '🔲', '#a8a29e', 80, 32, 72, 'kitchenCabinetUpperDouble', 'counter', 145],
  ['kitchen_upper_low', 'Low wall unit 60 cm', 'Szafka górna niska 60 cm', 'Armário alto baixo 60 cm', 'Kitchen', '🔲', '#a8a29e', 60, 32, 36, 'kitchenCabinetUpperLow', 'counter', 145],
  ['kitchen_upper_corner', 'Corner wall unit', 'Szafka górna narożna', 'Armário alto de canto', 'Kitchen', '🔲', '#a8a29e', 60, 60, 72, 'kitchenCabinetUpperCorner', 'counter', 145],
  ['kitchen_tall', 'Tall unit 60 cm', 'Słupek kuchenny 60 cm', 'Armário torre 60 cm', 'Kitchen', '🔲', '#78716c', 60, 60, 215, 'bookcaseClosedDoors', 'wardrobe'],
  ['kitchen_island', 'Kitchen island', 'Wyspa kuchenna', 'Ilha de cozinha', 'Kitchen', '🔲', '#78716c', 180, 90, 90, 'kitchenBar', 'counter'],
  ['kitchen_bar', 'Breakfast bar', 'Barek kuchenny', 'Balcão', 'Kitchen', '🔲', '#78716c', 120, 45, 105, 'kitchenBarEnd', 'counter'],
  ['fridge_60', 'Fridge 60 cm', 'Lodówka 60 cm', 'Geladeira 60 cm', 'Kitchen', '🧊', WHITE, 60, 65, 185, 'kitchenFridge', 'fridge'],
  ['fridge_builtin', 'Built-in fridge', 'Lodówka do zabudowy', 'Geladeira de embutir', 'Kitchen', '🧊', WHITE, 60, 56, 178, 'kitchenFridgeBuiltIn', 'fridge'],
  ['fridge_sbs', 'Side-by-side fridge', 'Lodówka side by side', 'Geladeira side by side', 'Kitchen', '🧊', WHITE, 91, 72, 178, 'kitchenFridgeLarge', 'fridge'],
  ['fridge_small', 'Under-counter fridge', 'Lodówka podblatowa', 'Frigobar', 'Kitchen', '🧊', WHITE, 55, 58, 85, 'kitchenFridgeSmall', 'fridge'],
  ['cooker_50', 'Freestanding cooker 50 cm', 'Kuchnia wolnostojąca 50 cm', 'Fogão 50 cm', 'Kitchen', '🍳', '#f87171', 50, 60, 85, 'kitchenStove', 'stove'],
  ['dishwasher_45', 'Dishwasher 45 cm', 'Zmywarka 45 cm', 'Lava-louças 45 cm', 'Kitchen', '🫧', '#cbd5e1', 45, 60, 85, 'kitchenCabinetDrawer', 'dishwasher'],
  ['hood_60', 'Cooker hood 60 cm', 'Okap 60 cm', 'Coifa 60 cm', 'Kitchen', '🌀', STEEL, 60, 50, 60, 'hoodModern', 'counter', 150],
  ['hood_90', 'Cooker hood 90 cm', 'Okap 90 cm', 'Coifa 90 cm', 'Kitchen', '🌀', STEEL, 90, 50, 60, 'hoodLarge', 'counter', 150],
  ['microwave', 'Microwave', 'Kuchenka mikrofalowa', 'Micro-ondas', 'Kitchen', '📟', DARK, 50, 38, 30, 'kitchenMicrowave', 'counter', 85],
  ['coffee_machine', 'Coffee machine', 'Ekspres do kawy', 'Máquina de café', 'Kitchen', '☕', DARK, 25, 40, 35, 'kitchenCoffeeMachine', 'counter', 85],

  // Dining
  ['table_80', 'Table 80 × 80', 'Stół 80 × 80', 'Mesa 80 × 80', 'Dining', '🍽️', '#f59e0b', 80, 80, 75, 'table', 'dining_table'],
  ['table_140', 'Table 140 × 80', 'Stół 140 × 80', 'Mesa 140 × 80', 'Dining', '🍽️', '#f59e0b', 140, 80, 75, 'table', 'dining_table'],
  ['table_160', 'Table 160 × 90', 'Stół 160 × 90', 'Mesa 160 × 90', 'Dining', '🍽️', '#f59e0b', 160, 90, 75, 'tableCross', 'dining_table'],
  ['table_200', 'Table 200 × 100', 'Stół 200 × 100', 'Mesa 200 × 100', 'Dining', '🍽️', '#f59e0b', 200, 100, 75, 'tableCross', 'dining_table'],
  ['table_round_100', 'Round table 100 cm', 'Stół okrągły 100 cm', 'Mesa redonda 100 cm', 'Dining', '🍽️', '#f59e0b', 100, 100, 75, 'tableRound', 'dining_table'],
  ['table_round_120', 'Round table 120 cm', 'Stół okrągły 120 cm', 'Mesa redonda 120 cm', 'Dining', '🍽️', '#f59e0b', 120, 120, 75, 'tableRound', 'dining_table'],
  ['table_glass', 'Glass table', 'Stół szklany', 'Mesa de vidro', 'Dining', '🍽️', STEEL, 140, 80, 75, 'tableGlass', 'dining_table'],
  ['chair_padded', 'Upholstered chair', 'Krzesło tapicerowane', 'Cadeira estofada', 'Dining', '🪑', '#d97706', 46, 52, 92, 'chairCushion', 'dining_chair'],
  ['chair_modern', 'Modern chair', 'Krzesło nowoczesne', 'Cadeira moderna', 'Dining', '🪑', '#d97706', 46, 52, 88, 'chairModernCushion', 'dining_chair'],
  ['chair_frame', 'Frame chair', 'Krzesło na ramie', 'Cadeira de armação', 'Dining', '🪑', '#d97706', 46, 52, 88, 'chairModernFrameCushion', 'dining_chair'],
  ['chair_round', 'Tub chair', 'Krzesło kubełkowe', 'Cadeira concha', 'Dining', '🪑', '#d97706', 55, 55, 82, 'chairRounded', 'dining_chair'],
  ['bar_stool', 'Bar stool', 'Hoker', 'Banqueta alta', 'Dining', '🪑', '#d97706', 40, 40, 75, 'stoolBar', 'dining_chair'],
  ['bar_stool_square', 'Square bar stool', 'Hoker kwadratowy', 'Banqueta quadrada', 'Dining', '🪑', '#d97706', 40, 40, 75, 'stoolBarSquare', 'dining_chair'],
  ['bench_dining', 'Dining bench', 'Ławka do stołu', 'Banco de mesa', 'Dining', '🪑', '#d97706', 140, 38, 46, 'benchCushion', 'dining_chair'],

  // Bathroom
  ['toilet_wall', 'Wall-hung toilet', 'WC podwieszane', 'Vaso suspenso', 'Bathroom', '🚽', WHITE, 37, 54, 40, 'toiletSquare', 'toilet'],
  ['bathtub_150', 'Bathtub 150 cm', 'Wanna 150 cm', 'Banheira 150 cm', 'Bathroom', '🛁', '#93c5fd', 150, 70, 58, 'bathtub', 'bathtub'],
  ['bathtub_160', 'Bathtub 160 cm', 'Wanna 160 cm', 'Banheira 160 cm', 'Bathroom', '🛁', '#93c5fd', 160, 70, 58, 'bathtub', 'bathtub'],
  ['bathtub_180', 'Bathtub 180 cm', 'Wanna 180 cm', 'Banheira 180 cm', 'Bathroom', '🛁', '#93c5fd', 180, 80, 60, 'bathtub', 'bathtub'],
  ['bathtub_corner', 'Corner bathtub', 'Wanna narożna', 'Banheira de canto', 'Bathroom', '🛁', '#93c5fd', 150, 150, 60, 'bathtub', 'bathtub'],
  ['shower_80', 'Shower 80 × 80', 'Kabina 80 × 80', 'Box 80 × 80', 'Bathroom', '🚿', '#bae6fd', 80, 80, 195, 'shower', 'shower'],
  ['shower_90_round', 'Quadrant shower 90', 'Kabina półokrągła 90', 'Box canto 90', 'Bathroom', '🚿', '#bae6fd', 90, 90, 195, 'showerRound', 'shower'],
  ['shower_120', 'Shower 120 × 80', 'Kabina 120 × 80', 'Box 120 × 80', 'Bathroom', '🚿', '#bae6fd', 120, 80, 195, 'shower', 'shower'],
  ['shower_walkin', 'Walk-in shower', 'Kabina walk-in 120 × 90', 'Box walk-in', 'Bathroom', '🚿', '#bae6fd', 120, 90, 200, 'shower', 'shower'],
  ['vanity_60', 'Vanity unit 60 cm', 'Szafka z umywalką 60 cm', 'Gabinete com pia 60 cm', 'Bathroom', '🪥', WHITE, 60, 46, 85, 'bathroomSinkSquare', 'sink_b'],
  ['vanity_80', 'Vanity unit 80 cm', 'Szafka z umywalką 80 cm', 'Gabinete com pia 80 cm', 'Bathroom', '🪥', WHITE, 80, 46, 85, 'bathroomSinkSquare', 'sink_b'],
  ['vanity_100', 'Vanity unit 100 cm', 'Szafka z umywalką 100 cm', 'Gabinete com pia 100 cm', 'Bathroom', '🪥', WHITE, 100, 46, 85, 'bathroomSinkSquare', 'sink_b'],
  ['bathroom_tall', 'Tall bathroom cabinet', 'Słupek łazienkowy', 'Armário alto de banheiro', 'Bathroom', '🗄️', WHITE, 35, 32, 170, 'bathroomCabinet', 'storage'],
  ['bathroom_drawers', 'Bathroom drawer unit', 'Szafka łazienkowa z szufladami', 'Gaveteiro de banheiro', 'Bathroom', '🗄️', WHITE, 60, 40, 85, 'bathroomCabinetDrawer', 'storage'],
  ['bathroom_mirror', 'Bathroom mirror', 'Lustro łazienkowe', 'Espelho de banheiro', 'Bathroom', '🪞', STEEL, 80, 5, 70, 'bathroomMirror', 'mirror', 110],
  ['washer_front', 'Washing machine', 'Pralka', 'Máquina de lavar', 'Bathroom', '👕', WHITE, 60, 55, 85, 'washer', 'washer_dryer'],
  ['washer_slim', 'Slim washing machine', 'Pralka wąska', 'Máquina de lavar estreita', 'Bathroom', '👕', WHITE, 60, 40, 85, 'washer', 'washer_dryer'],
  ['dryer', 'Tumble dryer', 'Suszarka do ubrań', 'Secadora', 'Bathroom', '👕', WHITE, 60, 60, 85, 'dryer', 'washer_dryer'],
  ['towel_radiator', 'Towel radiator', 'Grzejnik łazienkowy', 'Toalheiro térmico', 'Bathroom', '♨️', WHITE, 50, 8, 120, null, 'storage', 40],

  // Office
  ['desk_100', 'Desk 100 cm', 'Biurko 100 cm', 'Escrivaninha 100 cm', 'Office', '🖥️', '#34d399', 100, 60, 75, 'desk', 'desk'],
  ['desk_120', 'Desk 120 cm', 'Biurko 120 cm', 'Escrivaninha 120 cm', 'Office', '🖥️', '#34d399', 120, 60, 75, 'desk', 'desk'],
  ['desk_160', 'Desk 160 cm', 'Biurko 160 cm', 'Escrivaninha 160 cm', 'Office', '🖥️', '#34d399', 160, 80, 75, 'desk', 'desk'],
  ['desk_corner', 'Corner desk', 'Biurko narożne', 'Escrivaninha de canto', 'Office', '🖥️', '#34d399', 160, 120, 75, 'deskCorner', 'desk'],
  ['monitor', 'Monitor', 'Monitor', 'Monitor', 'Office', '🖥️', '#1e293b', 62, 20, 45, 'computerScreen', 'television', 75],

  // Hallway
  ['shoe_cabinet', 'Shoe cabinet', 'Szafka na buty', 'Sapateira', 'Hallway', '👞', OAK, 80, 32, 100, 'cabinetBedDrawer', 'dresser'],
  ['hall_wardrobe', 'Hallway wardrobe', 'Szafa do przedpokoju', 'Roupeiro de entrada', 'Hallway', '🗄️', OAK, 120, 40, 200, 'bookcaseClosedDoors', 'wardrobe'],
  ['hall_bench', 'Hallway bench', 'Ławka do przedpokoju', 'Banco de entrada', 'Hallway', '🪑', OAK, 100, 35, 46, 'benchCushionLow', 'dining_chair'],
  ['coat_rack', 'Wall coat rack', 'Wieszak ścienny', 'Cabideiro de parede', 'Hallway', '🧥', WOOD, 80, 10, 20, 'coatRack', 'wall_art', 165],
  ['coat_stand', 'Coat stand', 'Wieszak stojący', 'Cabideiro de pé', 'Hallway', '🧥', WOOD, 45, 45, 180, 'coatRackStanding', 'side_table'],
  ['doormat', 'Doormat', 'Wycieraczka', 'Capacho', 'Hallway', '🟫', RUG, 60, 40, 1, 'rugDoormat', 'rug'],

  // Children's room
  ['crib', 'Cot 120 × 60', 'Łóżeczko 120 × 60', 'Berço 120 × 60', 'Kids Room', '🛏️', '#f9a8d4', 125, 66, 90, 'bedSingle', 'bed_twin'],
  ['bed_kids', 'Child bed 160 × 80', 'Łóżko dziecięce 160 × 80', 'Cama infantil 160 × 80', 'Kids Room', '🛏️', '#f9a8d4', 168, 88, 60, 'bedSingle', 'bed_twin'],
  ['kids_bunk', 'Child bunk bed', 'Łóżko piętrowe dziecięce', 'Beliche infantil', 'Kids Room', '🛏️', '#f9a8d4', 168, 88, 150, 'bedBunk', 'bed_twin'],
  ['changing_table', 'Changing table', 'Przewijak z komodą', 'Trocador', 'Kids Room', '🗄️', '#f9a8d4', 90, 55, 95, 'cabinetBedDrawer', 'dresser'],
  ['kids_desk', 'Child desk', 'Biurko dziecięce', 'Escrivaninha infantil', 'Kids Room', '🖥️', '#f9a8d4', 100, 55, 70, 'desk', 'desk'],
  ['toy_shelf', 'Toy shelf', 'Regał na zabawki', 'Estante de brinquedos', 'Kids Room', '📚', '#f9a8d4', 90, 35, 100, 'bookcaseOpenLow', 'bookshelf'],

  // Rugs
  ['rug_120', 'Rug 120 × 170', 'Dywan 120 × 170', 'Tapete 120 × 170', 'Decor', '🟫', RUG, 120, 170, 1, 'rugRectangle', 'rug'],
  ['rug_160', 'Rug 160 × 230', 'Dywan 160 × 230', 'Tapete 160 × 230', 'Decor', '🟫', RUG, 160, 230, 1, 'rugRectangle', 'rug'],
  ['rug_200', 'Rug 200 × 290', 'Dywan 200 × 290', 'Tapete 200 × 290', 'Decor', '🟫', RUG, 200, 290, 1, 'rugRectangle', 'rug'],
  ['rug_square', 'Square rug 200 cm', 'Dywan kwadratowy 200', 'Tapete quadrado 200', 'Decor', '🟫', RUG, 200, 200, 1, 'rugSquare', 'rug'],
  ['rug_round_120', 'Round rug 120 cm', 'Dywan okrągły 120', 'Tapete redondo 120', 'Decor', '⭕', RUG, 120, 120, 1, 'rugRound', 'round_rug'],
  ['rug_round_160', 'Round rug 160 cm', 'Dywan okrągły 160', 'Tapete redondo 160', 'Decor', '⭕', RUG, 160, 160, 1, 'rugRound', 'round_rug'],

  // Lighting
  ['lamp_floor_round', 'Round floor lamp', 'Lampa stojąca okrągła', 'Luminária de piso redonda', 'Lighting', '🪔', LAMP, 40, 40, 160, 'lampRoundFloor', 'floor_lamp'],
  ['lamp_floor_square', 'Square floor lamp', 'Lampa stojąca kwadratowa', 'Luminária de piso quadrada', 'Lighting', '🪔', LAMP, 40, 40, 160, 'lampSquareFloor', 'floor_lamp'],
  ['lamp_table_round', 'Round table lamp', 'Lampka okrągła', 'Abajur redondo', 'Lighting', '💡', LAMP, 25, 25, 45, 'lampRoundTable', 'table_lamp'],
  ['lamp_table_square', 'Square table lamp', 'Lampka kwadratowa', 'Abajur quadrado', 'Lighting', '💡', LAMP, 25, 25, 45, 'lampSquareTable', 'table_lamp'],
  ['ceiling_fan', 'Ceiling fan', 'Wentylator sufitowy', 'Ventilador de teto', 'Lighting', '🌀', STEEL, 120, 120, 40, 'ceilingFan', 'ceiling_light', 215],
];

export const marketFurniture: FurnitureDef[] = rows.map(([id, name, , , category, icon, color, width, depth, height, , base, mountHeight]) => ({
  id, name, category, icon, color, width, depth, height, base, ...(mountHeight === undefined ? {} : { mountHeight }),
}));

const pick = (index: number) => Object.fromEntries(rows.flatMap(row => row[index] === null ? [] : [[row[0], row[index] as string]]));

export const marketModelFiles: Readonly<Record<string, string>> = pick(10);
export const marketBases: Readonly<Record<string, string>> = pick(11);
export const marketPolishNames: Readonly<Record<string, string>> = pick(2);
export const marketPortugueseNames: Readonly<Record<string, string>> = pick(3);
