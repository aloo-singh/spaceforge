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
 * Discriminated union of all interior asset types.
 *
 * Extends over time as new furniture is added:
 * - Stairs (Phase 1) ✓
 * - Bed (Phase 2)
 * - Wardrobe (Phase 2)
 * - Sofa (Phase 2)
 * - Dining Table (Phase 2)
 * - [Future: Sink, Toilet, Range, Island, Shelving, etc.]
 *
 * Usage:
 * ```typescript
 * function handleAsset(asset: InteriorAsset) {
 *   if (asset.type === "stairs") {
 *     // stairs-specific logic
 *     console.log(asset.arrowLabel);
 *   } else if (asset.type === "bed") {
 *     // bed-specific logic
 *   }
 * }
 * ```
 */
export type InteriorAsset = InteriorAssetStairs;

/**
 * Type guard to safely extract asset type from discriminated union.
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
