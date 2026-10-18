/** Static SVG only. Accepted input is rebuilt and used solely as an <img> source. */
const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_SOURCE_CHARS = 100_000;
const MAX_ELEMENTS = 1_000;
const MAX_DEPTH = 32;
const MAX_DIMENSION = 12_000;
const ID = /^[A-Za-z_][\w.-]{0,99}$/;
const ELEMENTS = new Set([
  "svg",
  "g",
  "defs",
  "title",
  "desc",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "linearGradient",
  "radialGradient",
  "stop",
  "marker",
  "clipPath",
  "mask",
]);
const PRESENTATION = new Set([
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "opacity",
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-anchor",
  "dominant-baseline",
  "alignment-baseline",
  "letter-spacing",
  "word-spacing",
  "text-decoration",
  "stop-color",
  "stop-opacity",
  "clip-path",
  "clip-rule",
  "mask",
  "marker-start",
  "marker-mid",
  "marker-end",
  "vector-effect",
  "paint-order",
  "visibility",
  "display",
  "shape-rendering",
  "text-rendering",
]);
const ATTRIBUTES = new Set([
  ...PRESENTATION,
  "id",
  "class",
  "version",
  "viewBox",
  "preserveAspectRatio",
  "width",
  "height",
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "transform",
  "dx",
  "dy",
  "rotate",
  "textLength",
  "lengthAdjust",
  "offset",
  "fx",
  "fy",
  "fr",
  "gradientUnits",
  "gradientTransform",
  "spreadMethod",
  "markerWidth",
  "markerHeight",
  "markerUnits",
  "refX",
  "refY",
  "orient",
  "clipPathUnits",
  "maskUnits",
  "maskContentUnits",
  "role",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
]);
const RESOURCES = new Set([
  "marker",
  "clipPath",
  "mask",
  "linearGradient",
  "radialGradient",
]);
const REFERENCES: Record<string, string[]> = {
  fill: ["linearGradient", "radialGradient"],
  stroke: ["linearGradient", "radialGradient"],
  "clip-path": ["clipPath"],
  mask: ["mask"],
  "marker-start": ["marker"],
  "marker-mid": ["marker"],
  "marker-end": ["marker"],
};

function reject(): never {
  throw new Error("Unsupported SVG");
}

/** No DOM access: also usable for cheap rejection before XML parsing. */
export function acceptsSvgSource(source: string): boolean {
  return (
    source.length > 0 &&
    source.length <= MAX_SOURCE_CHARS &&
    !/<!DOCTYPE|<!ENTITY|<\?/i.test(source)
  );
}

export function prepareSvg(source: string) {
  if (!acceptsSvgSource(source)) reject();
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = parsed.documentElement;
  if (parsed.querySelector("parsererror") || root.localName !== "svg") reject();
  const output = document.implementation.createDocument(SVG_NS, "svg", null);
  const ids = new Map<string, string>();
  const references: { property: string; id: string }[] = [];
  let count = 0;

  function value(property: string, raw: string, inResource: boolean) {
    const text = raw.trim();
    // Reject CSS escapes, comments and indirect/remote resource syntax, including entity-decoded values.
    if (
      Array.from(text).some((char) => char.charCodeAt(0) < 32) ||
      /[\\@]|\/\*|(?:https?:|data:|javascript:|\/\/)|\b(?:var|env|expression)\s*\(/i.test(
        text,
      )
    )
      reject();
    if (/url\s*\(/i.test(text)) {
      const match = /^url\(\s*(['"]?)#([A-Za-z_][\w.-]{0,99})\1\s*\)$/i.exec(
        text,
      );
      if (!match || !REFERENCES[property]) reject();
      // A resource can paint with a gradient, but cannot recursively instantiate another resource.
      if (inResource && property !== "fill" && property !== "stroke") reject();
      references.push({ property, id: match[2] });
    }
    return text;
  }

  function copy(
    element: Element,
    parent: Element,
    depth: number,
    inResource: boolean,
  ) {
    count += 1;
    if (
      count > MAX_ELEMENTS ||
      depth > MAX_DEPTH ||
      !ELEMENTS.has(element.localName) ||
      element.prefix ||
      (element.namespaceURI && element.namespaceURI !== SVG_NS) ||
      (depth > 0 && element.localName === "svg")
    )
      reject();
    const resource = inResource || RESOURCES.has(element.localName);
    const target =
      depth === 0
        ? output.documentElement
        : output.createElementNS(SVG_NS, element.localName);
    for (const attr of Array.from(element.attributes)) {
      if (attr.name === "xmlns" && depth === 0 && attr.value === SVG_NS)
        continue;
      if (
        attr.name === "xml:space" &&
        ["preserve", "default"].includes(attr.value)
      ) {
        target.setAttributeNS(
          "http://www.w3.org/XML/1998/namespace",
          "xml:space",
          attr.value,
        );
        continue;
      }
      if (attr.namespaceURI) reject();
      if (attr.name === "style") {
        // Only presentation declarations; no stylesheets, layout, animation, fonts or imports.
        const declarations = attr.value
          .split(";")
          .filter((part) => part.trim());
        const safe = declarations.map((part) => {
          const colon = part.indexOf(":");
          const property = part.slice(0, colon).trim().toLowerCase();
          if (colon < 1 || !PRESENTATION.has(property)) reject();
          return `${property}:${value(property, part.slice(colon + 1), resource)}`;
        });
        target.setAttribute("style", safe.join(";"));
        continue;
      }
      if (!ATTRIBUTES.has(attr.name)) reject();
      if (attr.name === "id") {
        if (!ID.test(attr.value) || ids.has(attr.value)) reject();
        ids.set(attr.value, element.localName);
      }
      target.setAttribute(attr.name, value(attr.name, attr.value, resource));
    }
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        copy(child as Element, target, depth + 1, resource);
      } else if (
        child.nodeType === Node.TEXT_NODE ||
        child.nodeType === Node.CDATA_SECTION_NODE
      ) {
        target.appendChild(output.createTextNode(child.textContent ?? ""));
      } else if (child.nodeType !== Node.COMMENT_NODE) reject();
    }
    if (depth > 0) parent.appendChild(target);
  }
  copy(root, output.documentElement, 0, false);
  for (const ref of references) {
    if (!REFERENCES[ref.property].includes(ids.get(ref.id) ?? "")) reject();
  }
  const svg = output.documentElement;
  const dimension = (raw: string | null) => {
    if (!raw || !/^\d+(?:\.\d+)?(?:px)?$/.test(raw.trim())) return null;
    const number = Number.parseFloat(raw);
    return number > 0 && number <= MAX_DIMENSION ? number : null;
  };
  const box = svg
    .getAttribute("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  let width: number;
  let height: number;
  if (box) {
    if (
      box.length !== 4 ||
      !box.every(Number.isFinite) ||
      box.some((n) => Math.abs(n) > MAX_DIMENSION) ||
      box[2] <= 0 ||
      box[3] <= 0
    )
      reject();
    width = box[2];
    height = box[3];
  } else {
    const w = dimension(svg.getAttribute("width"));
    const h = dimension(svg.getAttribute("height"));
    if (!w || !h) reject();
    width = w;
    height = h;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  // Use the bounded viewBox's intrinsic size; do not trust root percentage/huge dimensions.
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  const label = (
    svg.querySelector("title")?.textContent ||
    svg.getAttribute("aria-label") ||
    ""
  )
    .trim()
    .slice(0, 300);
  return {
    svg: new XMLSerializer().serializeToString(svg),
    width,
    height,
    label,
  };
}
