/**
 * WebGL2 cell drawing — mirrors Canvas2D drawOneCell visual output.
 */
export function registerTexture(renderer, key, img) {
  if (!img || !img.width) return 0;
  const tex = renderer.textureFromImage(img, key);
  renderer.texCache.set(key, { tex, width: img.width, height: img.height });
  return key;
}

export function drawCellGL(renderer, cell, S, helpers) {
  if (!cell.shouldRender()) return;

  const getSkinImage = helpers.getSkinImage;
  const loadCachedImage = helpers.loadCachedImage;
  const normalizeNick = helpers.normalizeNick;
  const transparent = S.transparent || new Set();
  const invisible = S.invisible || new Set();
  const rotation = S.rotation || new Set();
  const skinList = S.skinList || {};

  if (cell._posFrame !== S.frameId) cell.updatePos();
  let renderSize = cell.size;
  if (renderSize === 0) renderSize = 20;
  const noBorder = S.closebord || S.renderQuality === "low";
  const borderPx = noBorder ? 0 : 10;
  const isTransp = S.showSkin && transparent.has(cell.name);
  const cellColor = cell.getEffectiveColor();
  const fillCss = isTransp ? "rgba(0,0,0,0)" : cellColor;
  const strokeCss = isTransp ? "rgba(0,0,0,0)" : cellColor;

  const useVirusImageFill =
    cell.isVirus &&
    !isTransp &&
    S.customVirusBgEnabled &&
    S.virusBgImage &&
    S.virusBgImage.complete &&
    S.virusBgImage.width;

  if (useVirusImageFill) {
    const half = renderSize * 1.15;
    const key = "virus-bg";
    registerTexture(renderer, key, S.virusBgImage);
    renderer.pushCircle(
      cell.x,
      cell.y,
      half,
      fillCss,
      strokeCss,
      0,
      true,
      1,
      1,
      0,
      key
    );
  } else {
    renderer.pushCircle(cell.x, cell.y, renderSize, fillCss, strokeCss, borderPx, false, 1, 1, 0, 0);
  }

  if (S.showSkin && !cell.isVirus) {
    const skinName = cell._skinNameKey != null ? cell._skinNameKey : normalizeNick(cell.name);
    if (cell._skinNameKey !== skinName) {
      cell._skinNameKey = skinName;
      cell._skinId = skinList[skinName] || null;
    }
    const skinId = cell._skinId;
    if (skinId) {
      const skinImg = getSkinImage(skinId);
      if (skinImg && skinImg.complete && skinImg.width > 0) {
        if (typeof cell.skinZoom === "undefined") cell.skinZoom = 1;
        if (typeof cell.skinPhase === "undefined") cell.skinPhase = 0;
        if (cell.glowActive && S.showGlow) {
          cell.skinPhase += 0.05;
          const targetZoom = 1 + Math.abs(Math.sin(cell.skinPhase)) * 0.08;
          cell.skinZoom += (targetZoom - cell.skinZoom) * 0.1;
        } else {
          cell.skinZoom += (1 - cell.skinZoom) * 0.05;
          cell.skinPhase = 0;
        }
        const fw = skinImg.width;
        const fh = skinImg.height;
        const frame = fw > fh ? Math.floor(Date.now() / 100 % Math.floor(fw / fh)) : 0;
        const sz = renderSize;
        const z = Math.max(1, cell.skinZoom || 1);
        const texKey = `skin:${skinId}:${fw}x${fh}`;
        registerTexture(renderer, texKey, skinImg);

        let rot = 0;
        if (rotation.has(skinName)) {
          if (!cell._rot) {
            cell._rot = { target: 0, current: 0, lastAngle: null };
          }
          const vx = cell.nx - cell.ox;
          const vy = cell.ny - cell.oy;
          let rawAngle;
          if (Math.abs(vx) < 1e-6 && Math.abs(vy) < 1e-6) {
            rawAngle = cell._rot.lastAngle != null ? cell._rot.lastAngle : cell._rot.current;
          } else {
            rawAngle = Math.atan2(vy, vx);
          }
          if (cell._rot.lastAngle == null) {
            cell._rot.lastAngle = rawAngle;
            cell._rot.target = rawAngle;
            cell._rot.current = rawAngle;
          } else {
            let d = rawAngle - cell._rot.lastAngle;
            if (d > Math.PI) d -= 2 * Math.PI;
            if (d < -Math.PI) d += 2 * Math.PI;
            cell._rot.target += d;
            cell._rot.lastAngle = rawAngle;
          }
          cell._rot.current += (cell._rot.target - cell._rot.current) * 0.12;
          rot = cell._rot.current;
        }

        const uvScaleX = (fw > fh ? fh / fw : 1) / z;
        const frameW = fw > fh ? fh / fw : 1;
        const uvOffset = (fw > fh ? (frame * fh) / fw : 0) + (frameW - uvScaleX) * 0.5;
        renderer.pushCircle(
          cell.x,
          cell.y,
          sz,
          "#ffffff",
          "#ffffff",
          0,
          true,
          uvScaleX,
          1 / z,
          rot,
          texKey,
          uvOffset
        );
      }
    }
  }

  const mass = Math.floor(cell.size * cell.size * 0.01);
  if (typeof cell.glowActive === "undefined") cell.glowActive = false;
  const host = String(S.CONNECTION_URL || S.currentWebSocketUrl || S.wsUrl || "");
  const glowMass = (typeof getLimitGlowMassBounds === "function")
    ? getLimitGlowMassBounds(host)
    : (/megasplit5k|\/ms5k/i.test(host) ? { on: 32400, off: 32300 } : { on: 22400, off: 22300 });
  if (!glowMass) {
    cell.glowActive = false;
  } else {
    if (!cell.glowActive && mass >= glowMass.on) cell.glowActive = true;
    if (cell.glowActive && mass <= glowMass.off) cell.glowActive = false;
  }

  if (cell.glowActive && S.showGlow) {
    const effectImg = loadCachedImage("/photo/limited.png");
    if (effectImg && effectImg.complete && effectImg.width > 0) {
      const edrawSize = 2 * renderSize;
      const key = "limited";
      registerTexture(renderer, key, effectImg);
      renderer.pushCircle(cell.x, cell.y, edrawSize / 2, "#ffffff", "#ffffff", 0, true, 1, 1, 0, key);
    }
  }

  if (S.showStickers && cell.stickerActive && cell.currentSticker) {
    const stickerUrl = helpers.getStickerUrl(S.stickerList, cell.name, cell.currentSticker);
    if (stickerUrl) {
      const stickerImg = loadCachedImage(stickerUrl);
      if (stickerImg && stickerImg.complete && stickerImg.width > 0) {
        const key = `sticker:${stickerUrl}`;
        registerTexture(renderer, key, stickerImg);
        renderer.pushCircle(cell.x, cell.y, cell.size, "#ffffff", "#ffffff", 0, true, 1, 1, 0, key);
      }
    }
  }

  if (cell.id !== 0) {
    const x = cell.x;
    const y = cell.y;
    const zoomRatio = Math.ceil(10 * S.viewZoom) * 0.1;
    const invZoom = 1 / zoomRatio;

    if (S.showName && cell.name && cell.nameCache && cell.size > 10) {
      let displayName = cell.name;
      const lowerName = cell.name.toLowerCase();
      if (invisible.has(lowerName)) displayName = "";
      cell.nameCache.setValue(displayName);
      cell.nameCache.setSize(cell.getNameSize());
      cell.nameCache.setScale(zoomRatio);
      cell.nameCache.setStroke(S.renderQuality !== "low");
      const img = cell.nameCache.render();
      let drawWidth = img.width * invZoom;
      let drawHeight = img.height * invZoom;
      const maxAllowedWidth = cell.size * 2;
      if (drawWidth > maxAllowedWidth) {
        const shrink = maxAllowedWidth / drawWidth;
        drawWidth *= shrink;
        drawHeight *= shrink;
      }
      const texKey = `name:${cell.id}:${displayName}:${img.width}x${img.height}`;
      const tex = renderer.textureFromCanvas(img, texKey);
      renderer.texCache.set(texKey, { tex, width: img.width, height: img.height });
      renderer.pushTexturedQuad(x, y, drawWidth, drawHeight, 0, tex);
    }

    if (
      S.renderQuality !== "low" &&
      S.showMass &&
      !cell.isVirus &&
      !cell.isEjected &&
      !cell.isAgitated &&
      cell.size > 100
    ) {
      const massVal = Math.floor(cell.size * cell.size * 0.01);
      cell.sizeCache.setValue(massVal);
      cell.sizeCache.setScale(zoomRatio);
      const img = cell.sizeCache.render();
      const w = img.width * invZoom;
      const h = img.height * invZoom;
      const texKey = `mass:${cell.id}:${massVal}:${img.width}x${img.height}`;
      const tex = renderer.textureFromCanvas(img, texKey);
      renderer.texCache.set(texKey, { tex, width: img.width, height: img.height });
      renderer.pushTexturedQuad(x, y + img.height * 0.9 * invZoom + h / 2, w, h, 0, tex);
    }
  }
}
