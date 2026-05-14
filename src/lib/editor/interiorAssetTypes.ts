/**
 * Interior Asset Type System
 *
 * Flexible, extensible framework for all interior objects (furniture, fixtures) that
 * can be placed, moved, and managed inside rooms.
 *
 * Design principles:
 * - Discriminated union by asset type (future-proof for new furniture)
 * - Common properties and behaviours shared across all assets
 * - Type-specific properties isolated to each asset variant
 * - Anchoring concept included for future wall/ceiling attachment
 * - Existing stairs continue to work unchanged
 */

import type { StairDirection } from "./types";

/**
 * Anchor determines where an asset attaches geometrically.
 * Currently all assets anchor to floor.
 *
 * Future use cases:
 * - floor: traditional placement on ground level
 * - wall: shelves, cabinets, mounted fixtures
 * - ceiling: hanging fixtures, beams
 * - wall-corner: corner units
 */
export type InteriorAssetAnchor = "floor" | "wall" | "ceiling";

/**
 * Common properties shared across all interior assets.
 *
 * These represent the minimal interface that every interior asset must implement.
 * All geometry and transform operations work through these properties.
 */
export interface InteriorAssetCommonProperties {
  /**
   * Unique identifier within the room's interiorAssets array.
   */
  id: string;

  /**
   * User-visible name (e.g. "Bed 1", "Kitchen Counter", "Main Stairs").
   * Used in sidebar hierarchy and for accessibility.
   */
  name: string;

  /**
   * Position in room-local coordinates (millimetres).
   * Origin varies by asset type:
   * - stairs: centre of bounding box
   * - future furniture: typically bottom-left corner or centre
   */
  xMm: number;
  yMm: number;

  /**
   * Dimensions in room-local coordinates (millimetres).
   * Measured along the asset's local axes (affected by rotation).
   * - widthMm: primary horizontal extent (X-axis when rotation=0)
   * - depthMm: primary depth extent (Y-axis when rotation=0)
   *
   * Constraints:
   * - stairs: width snaps to grid, depth snaps to tread spacing (300mm)
   * - furniture: typically locked or user-resizable
   */
  widthMm: number;
  depthMm: number;

  /**
   * Rotation in degrees, clockwise on screen.
   * Typical values: 0, 90, 180, 270
   * Stairs currently support 0 and 90 (cardinal directions).
   * Future furniture may support arbitrary rotation.
   *
   * Constraints:
   * - stairs: 90° rotation requires sufficient room depth
   * - furniture: asset must remain inside room bounds after rotation
   */
  rotationDegrees: number;

  /**
   * Geometric anchor point (currently always "floor").
   * Reserved for future wall/ceiling anchoring without restructuring.
   */
  anchor: InteriorAssetAnchor;

  /**
   * Unit system preference for this asset (optional).
   * Default: "metric"
   *
   * Used by display helpers to format dimensions appropriately:
   * - "metric": metres and centimetres (e.g. "1.00m × 0.60m")
   * - "imperial": feet and inches (e.g. "3' 3\" × 2' 0\"")
   *
   * Project-level defaults can override per-asset, but this allows
   * individual assets to maintain their original units during migration.
   * Defaults to metric for backward compatibility.
   */
  unitSystem?: "metric" | "imperial";

  /**
   * Preset identifier for this asset size (optional).
   * String key for future localisation of preset names.
   * Examples: "standard-queen-bed", "wardrobe-sliding-2door", "dining-table-6seat"
   *
   * Enables:
   * - Future UI to display localised names
   * - Analytics on common size preferences
   * - Quick presets in asset creation UI
   *
   * Not enforced (assets can be custom-sized), but guides user choices.
   */
  sizePreset?: string;
}

/**
 * Stairs: vertical circulation between floors.
 *
 * Common behaviours:
 * - Move: drag constrained inside room bounds
 * - Resize: depth snaps to tread spacing (300mm), width snaps to grid
 * - Rotate: 0° or 90°; auto-constrain if 90° won't fit
 * - Copy/paste: supported; creates duplicate in room or sibling room
 * - Cut/paste: supported; removes from source, adds to target
 * - Select: click or sidebar; shows inspector with dimensions and controls
 * - Delete: removes from room; connected floor relationships automatically cleaned
 *
 * Type-specific properties:
 * - connectionId: links to a sibling stair on an adjacent floor (optional)
 * - arrowEnabled: directional arrow visibility
 * - arrowDirection: "forward" or "reverse"
 * - arrowLabel: user-editable label (e.g. "UP", "DOWN")
 */
export interface InteriorAssetStairs extends InteriorAssetCommonProperties {
  type: "stairs";

  /**
   * ID of the connected stair on an adjacent floor.
   * Used by the multi-floor system to link vertical circulation.
   * null = no connection (standalone stair).
   */
  connectionId: string | null;

  /**
   * Whether the directional arrow is visible.
   * Default: true
   */
  arrowEnabled: boolean;

  /**
   * Directional arrow orientation.
   * "forward" = arrow points along positive rotation axis
   * "reverse" = arrow points opposite
   * Default: "forward" (typically "UP")
   */
  arrowDirection: StairDirection;

  /**
   * User-editable label placed at the arrow tail.
   * Common: "UP", "DOWN", or custom text.
   * Empty string = no label displayed.
   */
  arrowLabel: string;
}

/**
 * Wardrobe: freestanding or built-in clothing storage with configurable door types.
 *
 * Common behaviours:
 * - Move: drag constrained inside room bounds
 * - Resize: user-resizable within reasonable furniture dimensions
 * - Rotate: supports cardinal rotation (0°, 90°, 180°, 270°)
 * - Copy/paste: supported; creates duplicate (respects doorType and constraint)
 * - Cut/paste: supported; moves between rooms
 * - Select: click or sidebar; shows inspector with door configuration
 * - Delete: removes from room
 *
 * Type-specific properties:
 * - doorType: "swing" (hinged) or "sliding" (gliding doors)
 * - doorConstraint: minimum width (in current unitSystem) for sliding door operation
 */
export interface InteriorAssetWardrobe extends InteriorAssetCommonProperties {
  type: "wardrobe";

  /**
   * Door mechanism type.
   * "swing" = traditional hinged doors (like cabinet or room door)
   * "sliding" = gliding bifold or pocket doors (space-efficient)
   * Default: "swing"
   */
  doorType: "swing" | "sliding";

  /**
   * Minimum clear width (in the current unitSystem) required for sliding doors to operate.
   * Measured in millimetres (always stored in mm for consistency).
   * Only applied when doorType === "sliding".
   *
   * Example constraints:
   * - Standard bifold: 800mm minimum
   * - Pocket sliding: 1200mm minimum
   * - Bypass sliding: 600mm minimum
   *
   * Used in room layout checks to warn users if wardrobe placement
   * would block door operation due to insufficient clear space.
   */
  doorConstraint: number;
}

/**
 * Bed: sleeping furniture (single, double, king, etc.).
 *
 * Common behaviours:
 * - Move: drag constrained inside room bounds
 * - Resize: user-resizable (width × depth)
 * - Rotate: supports cardinal rotation (0°, 90°, 180°, 270°)
 * - Copy/paste: supported; creates duplicate (respects size preset)
 * - Cut/paste: supported; moves between rooms
 * - Select: click or sidebar; shows inspector with dimensions
 * - Delete: removes from room
 *
 * Type-specific properties:
 * - Currently no specific properties; all data captured in common properties
 * - Future: could add properties like mattressType, headboardStyle, etc.
 *
 * Examples:
 * - Single: 900mm × 1900mm
 * - Double: 1350mm × 1900mm
 * - King: 1800mm × 2000mm
 */
export interface InteriorAssetBed extends InteriorAssetCommonProperties {
  type: "bed";
}

/**
 * Sofa: seating furniture (loveseat, sectional, etc.).
 *
 * Common behaviours:
 * - Move: drag constrained inside room bounds
 * - Resize: user-resizable (width × depth)
 * - Rotate: supports cardinal rotation (0°, 90°, 180°, 270°)
 * - Copy/paste: supported; creates duplicate (respects size preset)
 * - Cut/paste: supported; moves between rooms
 * - Select: click or sidebar; shows inspector with dimensions
 * - Delete: removes from room
 *
 * Type-specific properties:
 * - Currently no specific properties; all data captured in common properties
 * - Future: could add properties like seatCount, armStyle, upholsteryType, etc.
 *
 * Examples:
 * - 2-seater: 1400mm × 900mm
 * - 3-seater: 2000mm × 900mm
 * - Sectional: variable dimensions
 */
export interface InteriorAssetSofa extends InteriorAssetCommonProperties {
  type: "sofa";
}

/**
 * Dining Table: gathering furniture with shape variants.
 *
 * Common behaviours:
 * - Move: drag constrained inside room bounds
 * - Resize: user-resizable (width × depth, or diameter for round)
 * - Rotate: supports cardinal rotation (0°, 90°, 180°, 270°)
 * - Copy/paste: supported; creates duplicate (respects shape and size preset)
 * - Cut/paste: supported; moves between rooms
 * - Select: click or sidebar; shows inspector with dimensions and shape
 * - Delete: removes from room
 *
 * Type-specific properties:
 * - shape: "rectangular" | "round" — determines visual and interaction model
 *
 * Examples:
 * - Rectangular 6-seat: 1600mm × 900mm, shape: "rectangular"
 * - Round 4-seat: 1000mm diameter (stored as 1000mm × 1000mm, shape: "round")
 */
export interface InteriorAssetDiningTable extends InteriorAssetCommonProperties {
  type: "dining-table";

  /**
   * Table shape affects both visual rendering and interaction.
   * "rectangular" = standard four-legged or pedestal table
   * "round" = circular top, typically pedestal-based
   *
   * For round tables, widthMm and depthMm are equal (diameter).
   * UI may constraint resize to maintain circular shape.
   */
  shape: "rectangular" | "round";
}

/**
 * Kitchen Unit: simple resizable kitchen fixture (counter, island, appliance placement).
 *
 * Common behaviours:
 * - Move: drag constrained inside room bounds
 * - Resize: user-resizable (width × depth)
 * - Rotate: supports cardinal rotation (0°, 90°, 180°, 270°)
 * - Copy/paste: supported; creates duplicate (respects size preset)
 * - Cut/paste: supported; moves between rooms
 * - Select: click or sidebar; shows inspector with dimensions
 * - Delete: removes from room
 *
 * Type-specific properties:
 * - Currently no specific properties; all data captured in common properties
 * - Future: could add properties like applianceType, cabinetStyle, etc.
 *
 * Examples:
 * - Single: 900mm × 600mm
 * - Double: 1800mm × 600mm
 */
export interface InteriorAssetKitchenUnit extends InteriorAssetCommonProperties {
  type: "kitchen-unit";
}

/**
 * Kitchen appliance: generic placeholder for kitchen appliances (microwave, oven, etc.)
 *
 * Common behaviours:
 * - Move: drag constrained inside room bounds
 * - Resize: user-resizable within reasonable furniture dimensions
 * - Rotate: supports cardinal rotation (0°, 90°, 180°, 270°)
 * - Copy/paste: supported; creates duplicate
 * - Cut/paste: supported; moves between rooms
 * - Select: click or sidebar; shows inspector with dimensions
 * - Delete: removes from room
 *
 * Type-specific properties:
 * - Currently no specific properties; all data captured in common properties
 * - Future: could add properties like applianceType (microwave, oven, etc.)
 *
 * Visual distinction:
 * - Rendered with subtle corner lines for microwave-style appearance
 *
 * Examples:
 * - Microwave: 600mm × 600mm
 * - Built-in oven: 600mm × 600mm
 */
export interface InteriorAssetKitchenAppliance extends InteriorAssetCommonProperties {
  type: "kitchen-appliance";
}

/**
 * Hob: cooktop/hob with configurable burner arrangement
 *
 * Common behaviours:
 * - Move: drag constrained inside room bounds
 * - Resize: user-resizable within reasonable furniture dimensions
 * - Rotate: supports cardinal rotation (0°, 90°, 180°, 270°)
 * - Copy/paste: supported; creates duplicate
 * - Cut/paste: supported; moves between rooms
 * - Select: click or sidebar; shows inspector with dimensions
 * - Delete: removes from room
 *
 * Type-specific properties:
 * - burnerCount: number of burners (2/4/5/6) - default 4
 *
 * Visual distinction:
 * - Rendered with burner circles positioned in standard patterns
 *
 * Examples:
 * - Standard 4-burner: 600mm × 600mm
 * - 5-burner island: 750mm × 750mm
 * - 2-burner portable: 400mm × 400mm
 */
export interface InteriorAssetHob extends InteriorAssetCommonProperties {
  type: "hob";
  burnerCount?: 2 | 4 | 5 | 6;
}

/**
 * Sink: kitchen or bathroom sink with configurable bowl type and optional drainer
 *
 * Common behaviours:
 * - Move: drag constrained inside room bounds
 * - Resize: user-resizable within reasonable furniture dimensions
 * - Rotate: supports cardinal rotation (0°, 90°, 180°, 270°)
 * - Copy/paste: supported; creates duplicate
 * - Cut/paste: supported; moves between rooms
 * - Select: click or sidebar; shows inspector with dimensions
 * - Delete: removes from room
 *
 * Type-specific properties:
 * - bowlType: "single" or "1.5" (1.5 is main bowl + smaller secondary) - default "single"
 * - hasDefaultDrainer: whether to show drainer visualization - default false
 *
 * Visual distinction:
 * - Single bowl: rounded square inside square outline
 * - 1.5 bowl: narrower rounded square + smaller rounded rectangle (secondary bowl)
 * - With drainer: rectangle shape with parallel lines running toward drainer circle
 *
 * Examples:
 * - Standard single bowl: 600mm × 600mm
 * - 1.5 bowl: 600mm × 600mm with proportional secondary bowl
 * - Single with drainer: 800mm × 600mm with drainer detail
 */
export interface InteriorAssetSink extends InteriorAssetCommonProperties {
  type: "sink";
  bowlType?: "single" | "1.5";
  hasDefaultDrainer?: boolean;
  drainerSide?: "depth" | "width";
}

/**
 * Toilet: bathroom toilet fixture.
 *
 * Visual distinction:
 * - Cistern: rectangle at the back (frontC1/frontC2 = cistern side)
 * - Outer bowl: large oval spanning most of the remaining depth
 * - Inner hole: smaller oval inside bowl, nearer the cistern
 *
 * Examples:
 * - Standard: 400mm × 700mm
 */
export interface InteriorAssetToilet extends InteriorAssetCommonProperties {
  type: "toilet";
}

/**
 * Bath fixture with rectangular tub outline and drain details.
 *
 * Common behaviours:
 * - Move: drag constrained inside room bounds
 * - Resize: user-resizable (width × depth)
 * - Rotate: supports cardinal rotation (0°, 90°, 180°, 270°)
 * - Copy/paste: supported; creates duplicate
 * - Cut/paste: supported; moves between rooms
 * - Select: click or sidebar; shows inspector with dimensions
 * - Delete: removes from room
 *
 * Visual distinction:
 * - Outer rectangle boundary
 * - Inner oval (rounded rectangle) tub interior
 * - Circle plug hole positioned at one end
 *
 * Examples:
 * - Standard: 700mm × 1600mm
 */
export interface InteriorAssetBath extends InteriorAssetCommonProperties {
  type: "bath";
}

/**
 * Shower fixture with placeholder representation (square with details).
 * No type-specific properties — uses common dimensions only.
 */
export interface InteriorAssetShower extends InteriorAssetCommonProperties {
  type: "shower";
}

/**
 * Basin fixture with semicircular outer shape and concentric inner detail.
 *
 * Common behaviours:
 * - Move: drag constrained inside room bounds
 * - Resize: user-resizable (width × depth)
 * - Rotate: supports cardinal rotation (0°, 90°, 180°, 270°)
 * - Copy/paste: supported; creates duplicate
 * - Cut/paste: supported; moves between rooms
 * - Select: click or sidebar; shows inspector with dimensions
 * - Delete: removes from room
 *
 * Visual distinction:
 * - Outer semicircular boundary
 * - Inner concentric semicircular detail
 *
 * Examples:
 * - Standard: 500mm × 400mm
 */
export interface InteriorAssetBasin extends InteriorAssetCommonProperties {
  type: "basin";
}

/**
 * Desk: Rectangular work surface with fixed-size semicircle chair on one long side.
 *
 * Visual representation:
 * - Rectangle: desk surface (work plane)
 * - Semicircle: fixed 500mm diameter chair, centred on one long side
 *
 * Examples:
 * - Standard: 1200mm × 600mm, 500mm diameter chair
 */
export interface InteriorAssetDesk extends InteriorAssetCommonProperties {
  type: "desk";
}

/**
 * Discriminated union of all interior asset types.
 *
 * Extends over time as new furniture is added:
 * - Stairs (Phase 1) ✓
 * - Wardrobe (Phase 2) ✓
 * - Bed (Phase 3) ✓
 * - Sofa (Phase 3) ✓
 * - Dining Table (Phase 3) ✓
 * - Kitchen Unit (Phase 4) ✓
 * - [Future: Sink, Toilet, Range, Island, Shelving, Armchair, etc.]
 *
 * Usage:
 * ```typescript
 * function handleAsset(asset: InteriorAsset) {
 *   if (asset.type === "stairs") {
 *     // stairs-specific logic
 *     console.log(asset.arrowLabel);
 *   } else if (asset.type === "wardrobe") {
 *     // wardrobe-specific logic
 *     console.log(asset.doorType);
 *   } else if (asset.type === "dining-table") {
 *     // dining table-specific logic
 *     console.log(asset.shape);
 *   }
 * }
 * ```
 */
export type InteriorAsset = InteriorAssetStairs | InteriorAssetWardrobe | InteriorAssetBed | InteriorAssetSofa | InteriorAssetDiningTable | InteriorAssetKitchenUnit | InteriorAssetKitchenAppliance | InteriorAssetHob | InteriorAssetSink | InteriorAssetToilet | InteriorAssetShower | InteriorAssetBath | InteriorAssetBasin | InteriorAssetDesk;

/**
 * Type guard to safely extract stairs from discriminated union.
 *
 * Usage:
 * ```typescript
 * if (isStairs(asset)) {
 *   console.log(asset.arrowLabel); // type-safe
 * }
 * ```
 */
export function isStairs(asset: InteriorAsset): asset is InteriorAssetStairs {
  return asset.type === "stairs";
}

/**
 * Type guard to safely extract wardrobe from discriminated union.
 *
 * Usage:
 * ```typescript
 * if (isWardrobe(asset)) {
 *   console.log(asset.doorType); // type-safe
 * }
 * ```
 */
export function isWardrobe(asset: InteriorAsset): asset is InteriorAssetWardrobe {
  return asset.type === "wardrobe";
}

/**
 * Type guard to safely extract bed from discriminated union.
 *
 * Usage:
 * ```typescript
 * if (isBed(asset)) {
 *   // asset-specific logic
 * }
 * ```
 */
export function isBed(asset: InteriorAsset): asset is InteriorAssetBed {
  return asset.type === "bed";
}

/**
 * Type guard to safely extract sofa from discriminated union.
 *
 * Usage:
 * ```typescript
 * if (isSofa(asset)) {
 *   // asset-specific logic
 * }
 * ```
 */
export function isSofa(asset: InteriorAsset): asset is InteriorAssetSofa {
  return asset.type === "sofa";
}

/**
 * Type guard to safely extract dining table from discriminated union.
 *
 * Usage:
 * ```typescript
 * if (isDiningTable(asset)) {
 *   console.log(asset.shape); // type-safe
 * }
 * ```
 */
export function isDiningTable(asset: InteriorAsset): asset is InteriorAssetDiningTable {
  return asset.type === "dining-table";
}

/**
 * Type guard to safely extract kitchen unit from discriminated union.
 *
 * Usage:
 * ```typescript
 * if (isKitchenUnit(asset)) {
 *   // asset-specific logic
 * }
 * ```
 */
export function isKitchenUnit(asset: InteriorAsset): asset is InteriorAssetKitchenUnit {
  return asset.type === "kitchen-unit";
}

/**
 * Type guard to safely extract kitchen appliance from discriminated union.
 *
 * Usage:
 * ```typescript
 * if (isKitchenAppliance(asset)) {
 *   // asset-specific logic
 * }
 * ```
 */
export function isKitchenAppliance(asset: InteriorAsset): asset is InteriorAssetKitchenAppliance {
  return asset.type === "kitchen-appliance";
}

/**
 * Type guard to safely extract hob from discriminated union.
 *
 * Usage:
 * ```typescript
 * if (isHob(asset)) {
 *   console.log(asset.burnerCount); // type-safe
 * }
 * ```
 */
export function isHob(asset: InteriorAsset): asset is InteriorAssetHob {
  return asset.type === "hob";
}

/**
 * Type guard to safely extract sink from discriminated union.
 *
 * Usage:
 * ```typescript
 * if (isSink(asset)) {
 *   console.log(asset.bowlType); // type-safe
 * }
 * ```
 */
export function isSink(asset: InteriorAsset): asset is InteriorAssetSink {
  return asset.type === "sink";
}

/**
 * Common behaviour interface (documentation layer).
 *
 * All interior assets support these operations.
 * Implementation is modular across stores/components; this documents the contract.
 */
export interface InteriorAssetBehaviours {
  /**
   * Move: Translate asset to new position.
   * - Constrained: asset must remain inside room bounds
   * - Grid-aware: snap to editor grid if enabled
   * - Continuous: smooth during drag, committed on release
   * - Undo-tracked: writes to history
   */
  move(asset: InteriorAsset, newXMm: number, newYMm: number): InteriorAsset;

  /**
   * Resize: Change asset dimensions.
   * - Constrained: respect asset type's min/max sizes
   * - Type-aware: stairs depth snaps to 300mm; furniture may be locked
   * - Bounded: asset must remain inside room after resize
   * - Feedback: shows new dimensions during interaction
   * - Undo-tracked: writes to history
   */
  resize(
    asset: InteriorAsset,
    newWidthMm: number,
    newDepthMm: number
  ): InteriorAsset;

  /**
   * Rotate: Change asset orientation.
   * - Discrete: typically 0°, 90°, 180°, 270° (cardinal directions)
   * - Constrained: rotation must not exceed room bounds
   * - Auto-correct: may auto-nudge position to fit after rotation
   * - Feedback: visual arrow rotates with stairs
   * - Undo-tracked: writes to history
   */
  rotate(asset: InteriorAsset, deltaDegreesClockwise: number): InteriorAsset;

  /**
   * Select: Highlight asset on canvas and show inspector.
   * - Single-click: deselects others
   * - Ctrl/Cmd+click: add/remove from multi-selection
   * - Sidebar click: same as single-click
   * - Transient: not written to undo history
   */
  select(asset: InteriorAsset, roomId: string): void;

  /**
   * Copy: Add asset to clipboard for pasting.
   * - Deep clone: all properties including type-specific fields
   * - Transient: doesn't affect current document
   * - Preparation for paste (same or different room)
   */
  copy(asset: InteriorAsset, roomId: string): void;

  /**
   * Paste: Create new instance of clipboard asset in target room.
   * - Position: placed near cursor or default location
   * - Unique ID: new id generated to avoid collisions
   * - Smart naming: if copied name exists, append suffix
   * - Undo-tracked: writes to history
   * - Multi-asset paste: supports pasting multiple items
   */
  paste(asset: InteriorAsset, targetRoomId: string): void;

  /**
   * Cut: Copy and remove asset from source room.
   * - Combines copy + delete operations
   * - Clipboard: asset available for paste
   * - Source: asset removed from room
   * - Undo-tracked: single history entry
   */
  cut(asset: InteriorAsset, roomId: string): void;

  /**
   * Delete: Remove asset from room.
   * - Immediate: no confirmation (undo available)
   * - Cleanup: removes asset-specific state (e.g., connected floor relationships)
   * - Undo-tracked: writes to history
   * - Multi-delete: supports bulk deletion of multiple selected assets
   */
  delete(asset: InteriorAsset, roomId: string): void;

  /**
   * Rename: Change asset's display name.
   * - User input: inline editing or dialog
   * - Validation: typically no restrictions
   * - Undo-tracked: writes to history
   * - Sidebar: name updates immediately
   */
  rename(asset: InteriorAsset, newName: string): InteriorAsset;
}

/**
 * Helpers for working with the common properties layer.
 */
export function getAssetBounds(asset: InteriorAsset) {
  return {
    minX: asset.xMm - asset.widthMm / 2,
    maxX: asset.xMm + asset.widthMm / 2,
    minY: asset.yMm - asset.depthMm / 2,
    maxY: asset.yMm + asset.depthMm / 2,
  };
}

export function updateAssetPosition(
  asset: InteriorAsset,
  xMm: number,
  yMm: number
): InteriorAsset {
  return { ...asset, xMm, yMm };
}

export function updateAssetDimensions(
  asset: InteriorAsset,
  widthMm: number,
  depthMm: number
): InteriorAsset {
  return { ...asset, widthMm, depthMm };
}

export function updateAssetRotation(
  asset: InteriorAsset,
  rotationDegrees: number
): InteriorAsset {
  return { ...asset, rotationDegrees };
}

export function updateAssetName(asset: InteriorAsset, name: string): InteriorAsset {
  return { ...asset, name };
}

/**
 * Format asset dimensions as a human-readable string.
 *
 * Respects the asset's unitSystem preference (default: metric).
 *
 * @param asset - The interior asset to display
 * @returns Formatted dimension string
 *
 * Examples:
 * - Metric: "1.00m × 0.60m" (1000mm × 600mm, metric units)
 * - Imperial: "3' 3\" × 2' 0\"" (1000mm × 600mm, imperial units)
 *
 * Implementation:
 * - Metric: converts mm to metres, formatted to 2 decimal places
 * - Imperial: converts mm to feet/inches, formatted with foot symbol and inch marks
 * - Rounds to nearest sensible value for furniture (0.01m or 1/8")
 *
 * Future: This helper will be used by:
 * - Inspector UI to display dimensions
 * - Export functions for project metadata
 * - Localisation layer (preset names can be translated)
 */
export function getAssetDisplayDimensions(asset: InteriorAsset): string {
  const unitSystem = asset.unitSystem ?? "metric";

  if (unitSystem === "metric") {
    const widthM = (asset.widthMm / 1000).toFixed(2);
    const depthM = (asset.depthMm / 1000).toFixed(2);
    return `${widthM}m × ${depthM}m`;
  } else {
    // Imperial: convert mm to feet and inches
    const widthInches = asset.widthMm / 25.4;
    const depthInches = asset.depthMm / 25.4;

    const formatFeetInches = (inches: number): string => {
      const feet = Math.floor(inches / 12);
      const remainder = Math.round(inches % 12);
      // Handle rounding up to next foot
      if (remainder === 12) {
        return `${feet + 1}'`;
      }
      if (feet === 0) {
        return `${remainder}"`;
      }
      return `${feet}' ${remainder}"`;
    };

    return `${formatFeetInches(widthInches)} × ${formatFeetInches(depthInches)}`;
  }
}

/**
 * Get a friendly display name for an interior asset.
 *
 * Returns a human-readable name based on asset type and optional preset.
 * Used in UI, exports, and user-facing contexts.
 *
 * @param asset - The interior asset to name
 * @returns Friendly display name
 *
 * Examples:
 * - Stairs: "Stairs" or custom name "Main Stairs"
 * - Bed: "Bed" or custom name "Double Bed 1"
 * - Sofa: "Sofa" or custom name "3-Seater"
 * - Dining Table (rectangular): "Dining Table" or custom name "Round Dining Table 1.8m"
 * - Dining Table (round): "Round Dining Table" or custom name
 *
 * Implementation strategy:
 * - For most assets: use the asset's name field (user-editable)
 * - Optionally append size preset if available (from sizePreset field)
 * - Handle special cases like dining table shape for better defaults
 *
 * Future enhancement:
 * - Localise preset names based on locale
 * - Extract material/style from sizePreset key
 * - Add seat count inference for sofa/bed variations
 */
export function getAssetDisplayName(asset: InteriorAsset): string {
  // For dining tables, consider the shape in the default name generation
  if (isDiningTable(asset)) {
    const shapePrefix = asset.shape === "round" ? "Round " : "";
    // If custom name, use it; otherwise suggest based on shape
    if (asset.name !== "Table") {
      return asset.name;
    }
    return `${shapePrefix}Table`;
  }

  // For all other assets, use the name field
  // This is user-editable and takes precedence
  return asset.name;
}
