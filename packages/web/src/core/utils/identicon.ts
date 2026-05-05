// Port of the DarkMesh identicon flow:
// SHA-256(nodeId) -> Identikon-style SVG with the same default shape/color rules.

interface Point {
  x: number;
  y: number;
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Transform {
  x: number;
  y: number;
  size: number;
  rotation: number;
}

interface IdenticonStyle {
  backgroundColor: string;
  padding: number;
  saturation: number;
  colorLightness: readonly [number, number];
  grayScaleLightness: readonly [number, number];
}

interface ShapeCategory {
  colorIndex: number;
  shapes: readonly ShapeRenderer[];
  shapeIndex: number;
  rotationIndex: number | null;
  positions: readonly Point[];
}

interface ColorTheme {
  readonly count: 5;
  readonly colors: readonly [string, string, string, string, string];
}

type ShapeRenderer = (renderer: SvgRenderer, cell: number, index: number) => void;

const DEFAULT_IDENTICON_SIZE = 100;
const CELL_COUNT = 4;
const COMPENSATION_FACTORS = [0.55, 0.5, 0.5, 0.46, 0.6, 0.55, 0.55] as const;
const EMPTY_TRANSFORM: Transform = { x: 0, y: 0, size: 0, rotation: 0 };

const DEFAULT_STYLE: IdenticonStyle = {
  backgroundColor: "#ffffff",
  padding: 0.08,
  saturation: 0.5,
  colorLightness: [0.4, 0.8],
  grayScaleLightness: [0.3, 0.9],
};

const identiconCache = new Map<string, string>();
const pendingIdenticonCache = new Map<string, Promise<string>>();

const OUTER_SHAPES: readonly ShapeRenderer[] = [
  (renderer, cell) => {
    renderer.addTriangle(0, 0, cell, cell, 0);
  },
  (renderer, cell) => {
    renderer.addTriangle(0, cell / 2, cell, cell / 2, 0);
  },
  (renderer, cell) => {
    renderer.addRhombus(0, 0, cell, cell);
  },
  (renderer, cell) => {
    const margin = cell / 6;
    renderer.addCircle(margin, margin, cell - 2 * margin);
  },
];

const INNER_SHAPES: readonly ShapeRenderer[] = [
  (renderer, cell) => {
    const delta = cell * 0.42;
    renderer.addPolygon([
      { x: 0, y: 0 },
      { x: cell, y: 0 },
      { x: cell, y: cell - delta * 2 },
      { x: cell - delta, y: cell },
      { x: 0, y: cell },
    ]);
  },
  (renderer, cell) => {
    const width = cell * 0.5;
    const height = cell * 0.8;
    renderer.addTriangle(cell - width, 0, width, height, 2);
  },
  (renderer, cell) => {
    const margin = cell / 3;
    renderer.addRectangle(margin, margin, cell - margin, cell - margin);
  },
  (renderer, cell) => {
    const tmp = cell * 0.1;
    const inner = tmp > 1 ? Math.trunc(tmp) : tmp > 0.5 ? 1 : tmp;
    const outer = cell < 6 ? 1 : cell < 8 ? 2 : Math.trunc(cell / 4);
    renderer.addRectangle(outer, outer, cell - inner - outer, cell - inner - outer);
  },
  (renderer, cell) => {
    const margin = Math.trunc(cell * 0.15);
    const size = Math.trunc(cell * 0.5);
    const position = cell - size - margin;
    renderer.addCircle(position, position, size);
  },
  (renderer, cell) => {
    const inner = cell * 0.1;
    const outer = inner * 4;
    renderer.addRectangle(0, 0, cell, cell);
    renderer.addPolygon(
      [
        { x: outer, y: outer },
        { x: cell - inner, y: outer },
        { x: outer + (cell - outer - inner) / 2, y: cell - inner },
      ],
      true,
    );
  },
  (renderer, cell) => {
    renderer.addPolygon([
      { x: 0, y: 0 },
      { x: cell, y: 0 },
      { x: cell, y: cell * 0.7 },
      { x: cell * 0.4, y: cell * 0.4 },
      { x: cell * 0.7, y: cell },
      { x: 0, y: cell },
    ]);
  },
  (renderer, cell) => {
    renderer.addTriangle(cell / 2, cell / 2, cell / 2, cell / 2, 3);
  },
  (renderer, cell) => {
    renderer.addPolygon([
      { x: 0, y: 0 },
      { x: cell, y: 0 },
      { x: cell, y: cell / 2 },
      { x: cell / 2, y: cell },
      { x: 0, y: cell },
    ]);
  },
  (renderer, cell) => {
    const tmp = cell * 0.14;
    const inner = cell < 8 ? tmp : Math.trunc(tmp);
    const outer = cell < 4 ? 1 : cell < 6 ? 2 : Math.trunc(cell * 0.35);
    renderer.addRectangle(0, 0, cell, cell);
    renderer.addRectangle(outer, outer, cell - outer - inner, cell - outer - inner, true);
  },
  (renderer, cell) => {
    const inner = cell * 0.12;
    const outer = inner * 3;
    renderer.addRectangle(0, 0, cell, cell);
    renderer.addCircle(outer, outer, cell - inner - outer, true);
  },
  (renderer, cell) => {
    const margin = cell * 0.25;
    renderer.addRectangle(0, 0, cell, cell);
    renderer.addRhombus(margin, margin, cell - margin, cell - margin, true);
  },
  (renderer, cell, index) => {
    if (index !== 0) {
      const margin = cell * 0.4;
      const size = cell * 1.2;
      renderer.addCircle(margin, margin, size);
    }
  },
];

const DEFAULT_CATEGORIES: readonly ShapeCategory[] = [
  {
    colorIndex: 8,
    shapes: OUTER_SHAPES,
    shapeIndex: 2,
    rotationIndex: 3,
    positions: [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 0, y: 2 },
    ],
  },
  {
    colorIndex: 9,
    shapes: OUTER_SHAPES,
    shapeIndex: 4,
    rotationIndex: 5,
    positions: [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
      { x: 0, y: 3 },
    ],
  },
  {
    colorIndex: 10,
    shapes: INNER_SHAPES,
    shapeIndex: 1,
    rotationIndex: null,
    positions: [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ],
  },
];

class SvgPath {
  private readonly commands: string[] = [];

  moveTo(x: number, y: number) {
    this.commands.push(`M${formatNumber(x)} ${formatNumber(y)}`);
  }

  lineTo(x: number, y: number) {
    this.commands.push(`L${formatNumber(x)} ${formatNumber(y)}`);
  }

  arcBy(
    xRadius: number,
    yRadius: number,
    xAxisRotation: number,
    dxEnd: number,
    dyEnd: number,
    largeArc = false,
    clockwise = false,
  ) {
    this.commands.push(
      `a${formatNumber(xRadius)},${formatNumber(yRadius)} ${formatNumber(
        xAxisRotation,
      )} ${largeArc ? 1 : 0},${clockwise ? 1 : 0} ${formatNumber(dxEnd)},${formatNumber(dyEnd)}`,
    );
  }

  close() {
    this.commands.push("Z");
  }

  toString() {
    return this.commands.join("");
  }
}

class SvgRenderer {
  transform: Transform = EMPTY_TRANSFORM;
  private backgroundColor = "#00000000";
  private currentPath = new SvgPath();
  private readonly pathsByColor = new Map<string, SvgPath>();

  setBackground(color: string) {
    this.backgroundColor = color;
  }

  renderShape(color: string, action: () => void) {
    const path = this.pathsByColor.get(color);
    if (path) {
      this.currentPath = path;
    } else {
      const nextPath = new SvgPath();
      this.pathsByColor.set(color, nextPath);
      this.currentPath = nextPath;
    }
    action();
  }

  addRectangle(x: number, y: number, width: number, height: number, invert = false) {
    this.addPolygonInternal(
      [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ],
      invert,
    );
  }

  addCircle(x: number, y: number, size: number, invert = false) {
    const northWest = transformPoint(this.transform, x, y, size, size);
    this.addCircleNoTransform(northWest, size, invert);
  }

  addPolygon(points: readonly Point[], invert = false) {
    this.addPolygonInternal(points, invert);
  }

  addTriangle(
    x: number,
    y: number,
    width: number,
    height: number,
    direction: 0 | 1 | 2 | 3,
    invert = false,
  ) {
    const points = [
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
      { x, y },
    ];
    points.splice(direction, 1);
    this.addPolygonInternal(points, invert);
  }

  addRhombus(x: number, y: number, width: number, height: number, invert = false) {
    this.addPolygonInternal(
      [
        { x: x + width / 2, y },
        { x: x + width, y: y + height / 2 },
        { x: x + width / 2, y: y + height },
        { x, y: y + height / 2 },
      ],
      invert,
    );
  }

  toSvg(width: number, height: number) {
    const pathEntries = Array.from(this.pathsByColor.entries());
    const background =
      this.backgroundColor !== "#00000000"
        ? `\n  <rect fill="${this.backgroundColor}" x="0" y="0" width="${width}" height="${height}" />`
        : "";
    const paths = pathEntries
      .map(([color, path]) => `\n  <path fill="${color}" d="${path}" />`)
      .join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${background}${paths}\n</svg>`;
  }

  private addCircleNoTransform(location: Point, diameter: number, counterClockwise: boolean) {
    const radius = diameter / 2;
    this.currentPath.moveTo(location.x, location.y + radius);
    this.currentPath.arcBy(radius, radius, 0, diameter, 0, false, !counterClockwise);
    this.currentPath.arcBy(radius, radius, 0, -diameter, 0, false, !counterClockwise);
    this.currentPath.close();
  }

  private addPolygonInternal(points: readonly Point[], invert: boolean) {
    const transformedPoints = points.map((point) =>
      transformPoint(this.transform, point.x, point.y),
    );
    if (invert) {
      transformedPoints.reverse();
    }

    const [firstPoint, ...remainingPoints] = transformedPoints;
    if (!firstPoint) {
      return;
    }

    this.currentPath.moveTo(firstPoint.x, firstPoint.y);
    for (const point of remainingPoints) {
      this.currentPath.lineTo(point.x, point.y);
    }
    this.currentPath.close();
  }
}

function formatNumber(value: number) {
  const rounded = Math.round(value * 1000) / 1000;
  if (Object.is(rounded, -0)) {
    return "0";
  }
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function toHex(component: number) {
  return component.toString(16).padStart(2, "0");
}

function rgba(red: number, green: number, blue: number) {
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function hslToRgb(hue: number, saturation: number, lightness: number) {
  if (saturation === 0) {
    const gray = Math.round(lightness * 255);
    return rgba(gray, gray, gray);
  }

  const m2 =
    lightness <= 0.5
      ? lightness * (saturation + 1)
      : lightness + saturation - lightness * saturation;
  const m1 = lightness * 2 - m2;

  return rgba(
    hueToRgb(m1, m2, hue * 6 + 2),
    hueToRgb(m1, m2, hue * 6),
    hueToRgb(m1, m2, hue * 6 - 2),
  );
}

function hueToRgb(m1: number, m2: number, hue: number) {
  const normalizedHue = hue < 0 ? hue + 6 : hue > 6 ? hue - 6 : hue;
  const channel =
    normalizedHue < 1
      ? m1 + (m2 - m1) * normalizedHue
      : normalizedHue < 3
        ? m2
        : normalizedHue < 4
          ? m1 + (m2 - m1) * (4 - normalizedHue)
          : m1;
  return Math.round(channel * 255);
}

function compensateLightness(lightness: number, hue: number) {
  const compensationIndex = Math.trunc(hue * 6 + 0.5);
  const compensationFactor = COMPENSATION_FACTORS[compensationIndex];
  const compensation = compensationFactor === undefined ? 0.55 : compensationFactor;
  return lightness < 0.5
    ? lightness * compensation * 2
    : compensation + (lightness - 0.5) * (1 - compensation) * 2;
}

function buildColorTheme(hue: number, style: IdenticonStyle): ColorTheme {
  const [colorLightnessStart, colorLightnessEnd] = style.colorLightness;
  const [grayScaleLightnessStart, grayScaleLightnessEnd] = style.grayScaleLightness;

  return {
    count: 5,
    colors: [
      hslToRgb(0, 0, grayScaleLightnessStart),
      hslToRgb(
        hue,
        style.saturation,
        compensateLightness((colorLightnessStart + colorLightnessEnd) / 2, hue),
      ),
      hslToRgb(0, 0, grayScaleLightnessEnd),
      hslToRgb(hue, style.saturation, compensateLightness(colorLightnessStart, hue)),
      hslToRgb(hue, style.saturation, compensateLightness(colorLightnessEnd, hue)),
    ],
  };
}

function bytesToUint32(hash: Uint8Array) {
  return (
    (((hash[0] ?? 0) << 24) | ((hash[1] ?? 0) << 16) | ((hash[2] ?? 0) << 8) | (hash[3] ?? 0)) >>> 0
  );
}

function computeHue(hash: Uint8Array) {
  return bytesToUint32(hash) / 0xffffffff;
}

function getOctet(hash: Uint8Array, index: number) {
  return hash[index % hash.length] ?? 0;
}

function isDuplicate(
  source: readonly number[],
  newValue: number,
  duplicateValues: readonly number[],
) {
  if (!duplicateValues.includes(newValue)) {
    return false;
  }

  return duplicateValues.some((value) => source.includes(value));
}

function getIconBounds(size: number, style: IdenticonStyle): Rectangle {
  const scaledPadding = Math.trunc(style.padding * size);
  return {
    x: scaledPadding,
    y: scaledPadding,
    width: size - scaledPadding * 2,
    height: size - scaledPadding * 2,
  };
}

function normalizeRectangle(rect: Rectangle): Rectangle {
  let size = Math.min(rect.width, rect.height);
  size -= size % CELL_COUNT;

  return {
    x: rect.x + Math.trunc((rect.width - size) / 2),
    y: rect.y + Math.trunc((rect.height - size) / 2),
    width: size,
    height: size,
  };
}

function transformPoint(transform: Transform, x: number, y: number, width = 0, height = 0): Point {
  const right = transform.x + transform.size;
  const bottom = transform.y + transform.size;

  switch (transform.rotation) {
    case 1:
      return { x: right - y - height, y: transform.y + x };
    case 2:
      return { x: right - x - width, y: bottom - y - height };
    case 3:
      return { x: transform.x + y, y: bottom - x - width };
    default:
      return { x: transform.x + x, y: transform.y + y };
  }
}

export function resolveNodeAvatarId(nodeNum: number, nodeId?: string) {
  const trimmedId = nodeId?.trim();
  return trimmedId && trimmedId.length > 0 ? trimmedId : `!${nodeNum.toString(16)}`;
}

export function getCachedNodeIdenticon(nodeId: string) {
  return identiconCache.get(nodeId);
}

export function renderDarkMeshIdenticonSvg(
  hash: Uint8Array,
  size = DEFAULT_IDENTICON_SIZE,
  style: IdenticonStyle = DEFAULT_STYLE,
) {
  if (hash.length < 6) {
    throw new Error("Input hash should be composed at least of 6 bytes.");
  }

  const renderer = new SvgRenderer();
  const hue = computeHue(hash);
  const colorTheme = buildColorTheme(hue, style);
  const usedColorThemeIndexes: number[] = [];
  const bounds = normalizeRectangle(getIconBounds(size, style));
  const cellSize = bounds.width / CELL_COUNT;

  renderer.setBackground(style.backgroundColor);

  for (const category of DEFAULT_CATEGORIES) {
    let colorThemeIndex = getOctet(hash, category.colorIndex) % colorTheme.count;

    if (
      isDuplicate(usedColorThemeIndexes, colorThemeIndex, [0, 4]) ||
      isDuplicate(usedColorThemeIndexes, colorThemeIndex, [2, 3])
    ) {
      colorThemeIndex = 1;
    }

    usedColorThemeIndexes.push(colorThemeIndex);

    const startRotationIndex =
      category.rotationIndex == null ? 0 : getOctet(hash, category.rotationIndex);
    const shapeIndex = getOctet(hash, category.shapeIndex) % category.shapes.length;
    const shape = category.shapes[shapeIndex];
    if (!shape) {
      continue;
    }
    let rotation = startRotationIndex;
    const fillColor = colorTheme.colors[colorThemeIndex] ?? colorTheme.colors[1];

    renderer.renderShape(fillColor, () => {
      for (const [index, position] of category.positions.entries()) {
        renderer.transform = {
          x: bounds.x + position.x * cellSize,
          y: bounds.y + position.y * cellSize,
          size: cellSize,
          rotation: rotation % 4,
        };
        rotation += 1;
        shape(renderer, cellSize, index);
      }
    });
  }

  return renderer.toSvg(size, size);
}

async function sha256Bytes(value: string) {
  const encodedValue = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encodedValue);
  return new Uint8Array(digest);
}

export async function getNodeIdenticonDataUri(nodeId: string) {
  const cached = identiconCache.get(nodeId);
  if (cached) {
    return cached;
  }

  const pending = pendingIdenticonCache.get(nodeId);
  if (pending) {
    return pending;
  }

  const nextPromise = sha256Bytes(nodeId)
    .then((hash) => {
      const svg = renderDarkMeshIdenticonSvg(hash);
      const dataUri = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
      identiconCache.set(nodeId, dataUri);
      return dataUri;
    })
    .finally(() => {
      pendingIdenticonCache.delete(nodeId);
    });

  pendingIdenticonCache.set(nodeId, nextPromise);
  return nextPromise;
}
