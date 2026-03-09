"use client";

import { useEffect, useRef } from "react";
import { Application, Graphics } from "pixi.js";
import { screenToWorld } from "@/lib/editor/camera";
import { GRID_MINOR_SIZE_MM, GRID_SIZE_MM, ZOOM_STEP } from "@/lib/editor/constants";
import type { CameraState, ScreenPoint, ViewportSize } from "@/lib/editor/types";
import { useEditorStore } from "@/stores/editorStore";

export default function EditorCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;

    const app = new Application();

    async function init() {
      await app.init({
        resizeTo: containerRef.current!,
        background: "#111111",
        antialias: true,
      });

      if (destroyed || !containerRef.current) return;

      containerRef.current.appendChild(app.canvas);
      app.canvas.style.touchAction = "none";

      const grid = new Graphics();
      app.stage.addChild(grid);

      const syncViewport = () => {
        useEditorStore.getState().setViewport(app.screen.width, app.screen.height);
      };

      syncViewport();
      drawGrid(grid, useEditorStore.getState().camera, useEditorStore.getState().viewport);

      const handleResize = () => {
        syncViewport();
      };

      app.renderer.on("resize", handleResize);

      const unsubscribe = useEditorStore.subscribe((state) => {
        drawGrid(grid, state.camera, state.viewport);
      });

      // Space-to-pan is a core editor affordance; add this to onboarding/tutorial later.
      let isSpaceHeld = false;
      let isPanning = false;
      let activePointerId: number | null = null;
      let lastPointer: ScreenPoint = { x: 0, y: 0 };

      const updateCursor = () => {
        if (isPanning) {
          app.canvas.style.cursor = "grabbing";
          return;
        }

        app.canvas.style.cursor = isSpaceHeld ? "grab" : "default";
      };

      const canStartPan = (button: number) => {
        const isMiddleButton = button === 1;
        const isSpaceLeftButton = button === 0 && isSpaceHeld;
        return isMiddleButton || isSpaceLeftButton;
      };

      const onPointerDown = (event: PointerEvent) => {
        if (!canStartPan(event.button)) return;
        event.preventDefault();
        isPanning = true;
        activePointerId = event.pointerId;
        lastPointer = { x: event.clientX, y: event.clientY };
        app.canvas.setPointerCapture(event.pointerId);
        updateCursor();
      };

      const onPointerMove = (event: PointerEvent) => {
        if (!isPanning || activePointerId !== event.pointerId) return;
        const nextPointer = { x: event.clientX, y: event.clientY };

        useEditorStore.getState().panCameraByPx({
          x: nextPointer.x - lastPointer.x,
          y: nextPointer.y - lastPointer.y,
        });

        lastPointer = nextPointer;
      };

      const onPointerUp = (event: PointerEvent) => {
        if (activePointerId !== event.pointerId) return;
        isPanning = false;
        activePointerId = null;
        if (app.canvas.hasPointerCapture(event.pointerId)) {
          app.canvas.releasePointerCapture(event.pointerId);
        }
        updateCursor();
      };

      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        const rect = app.canvas.getBoundingClientRect();
        const cursorInCanvas = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const scaleFactor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        useEditorStore.getState().zoomAtScreenPoint(cursorInCanvas, scaleFactor);
      };

      const isTypingTarget = (target: EventTarget | null) => {
        if (!(target instanceof HTMLElement)) return false;
        const tag = target.tagName;
        return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.code !== "Space" || isTypingTarget(event.target)) return;
        event.preventDefault();
        if (!isSpaceHeld) {
          isSpaceHeld = true;
          updateCursor();
        }
      };

      const onKeyUp = (event: KeyboardEvent) => {
        if (event.code !== "Space" || isTypingTarget(event.target)) return;
        event.preventDefault();
        isSpaceHeld = false;
        updateCursor();
      };

      const onWindowBlur = () => {
        isSpaceHeld = false;
        isPanning = false;
        activePointerId = null;
        updateCursor();
      };

      app.canvas.addEventListener("pointerdown", onPointerDown);
      app.canvas.addEventListener("pointermove", onPointerMove);
      app.canvas.addEventListener("pointerup", onPointerUp);
      app.canvas.addEventListener("pointercancel", onPointerUp);
      app.canvas.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onWindowBlur);
      updateCursor();

      return () => {
        app.canvas.removeEventListener("pointerdown", onPointerDown);
        app.canvas.removeEventListener("pointermove", onPointerMove);
        app.canvas.removeEventListener("pointerup", onPointerUp);
        app.canvas.removeEventListener("pointercancel", onPointerUp);
        app.canvas.removeEventListener("wheel", onWheel);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onWindowBlur);
        unsubscribe();
        app.renderer.off("resize", handleResize);
      };
    }

    let teardown: (() => void) | undefined;
    init().then((cleanup) => {
      teardown = cleanup;
    });

    return () => {
      destroyed = true;
      teardown?.();
      app.destroy(true, { children: true });
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}

function drawGrid(
  graphics: Graphics,
  camera: CameraState,
  viewport: ViewportSize
) {
  const { width, height } = viewport;
  graphics.clear();

  if (width <= 0 || height <= 0) return;

  const topLeftWorld = screenToWorld({ x: 0, y: 0 }, camera, viewport);
  const bottomRightWorld = screenToWorld({ x: width, y: height }, camera, viewport);

  const minX = Math.min(topLeftWorld.x, bottomRightWorld.x);
  const maxX = Math.max(topLeftWorld.x, bottomRightWorld.x);
  const minY = Math.min(topLeftWorld.y, bottomRightWorld.y);
  const maxY = Math.max(topLeftWorld.y, bottomRightWorld.y);

  if (GRID_MINOR_SIZE_MM * camera.pixelsPerMm >= 8) {
    drawGridLines(graphics, camera, viewport, minX, maxX, minY, maxY, GRID_MINOR_SIZE_MM, {
      width: 1,
      color: 0x242424,
      alpha: 1,
    });
  }

  drawGridLines(graphics, camera, viewport, minX, maxX, minY, maxY, GRID_SIZE_MM, {
    width: 1,
    color: 0x343434,
    alpha: 1,
  });

  const originX = (0 - camera.xMm) * camera.pixelsPerMm + width / 2;
  const originY = (0 - camera.yMm) * camera.pixelsPerMm + height / 2;
  graphics.setStrokeStyle({ width: 1.5, color: 0x4f4f4f, alpha: 1 });
  graphics.moveTo(originX, 0);
  graphics.lineTo(originX, height);
  graphics.moveTo(0, originY);
  graphics.lineTo(width, originY);
  graphics.stroke();
}

function drawGridLines(
  graphics: Graphics,
  camera: CameraState,
  viewport: ViewportSize,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  stepMm: number,
  stroke: { width: number; color: number; alpha: number }
) {
  const firstX = Math.floor(minX / stepMm) * stepMm;
  const firstY = Math.floor(minY / stepMm) * stepMm;
  const { width, height } = viewport;

  graphics.setStrokeStyle(stroke);

  for (let xMm = firstX; xMm <= maxX; xMm += stepMm) {
    const x = (xMm - camera.xMm) * camera.pixelsPerMm + width / 2;
    graphics.moveTo(x, 0);
    graphics.lineTo(x, height);
  }

  for (let yMm = firstY; yMm <= maxY; yMm += stepMm) {
    const y = (yMm - camera.yMm) * camera.pixelsPerMm + height / 2;
    graphics.moveTo(0, y);
    graphics.lineTo(width, y);
  }

  graphics.stroke();
}
