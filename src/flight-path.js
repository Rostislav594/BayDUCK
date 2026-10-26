const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const inside = (p, r) => p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom;

// Direct collection flights intentionally cross the hero instead of detouring.
export function planStraightFlight({start, end}) {
  const length = distance(start, end);
  return {points:[{...start}, {...end}], lengths:[0, length], length};
}

const cubic = (a, b, c, d, t) => {
  const s = 1 - t;
  return {
    x: s*s*s*a.x + 3*s*s*t*b.x + 3*s*t*t*c.x + t*t*t*d.x,
    y: s*s*s*a.y + 3*s*s*t*b.y + 3*s*t*t*c.y + t*t*t*d.y,
  };
};
const measure = points => {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths.at(-1) + distance(points[i - 1], points[i]));
  return lengths;
};
const rectGap = (p, r) => Math.hypot(Math.max(r.left - p.x, 0, p.x - r.right), Math.max(r.top - p.y, 0, p.y - r.bottom));

// The largest loop that fits beside the path at `index`: inside the hero and
// clear of the basket, with the circle tangent to the path so speed and
// heading stay continuous.
function fitLoop(points, index, {width, height, pad, basketRect, radius, gap}) {
  const p = points[index], q = points[Math.min(points.length - 1, index + 1)], o = points[Math.max(0, index - 1)];
  const span = Math.max(0.001, distance(o, q));
  const u = {x:(q.x - o.x) / span, y:(q.y - o.y) / span};
  let best = null;
  for (const n of [{x:-u.y, y:u.x}, {x:u.y, y:-u.x}]) {
    for (let r = radius; r >= radius / 2; r -= 2) {
      const c = {x:p.x + r*n.x, y:p.y + r*n.y};
      if (c.x - r < pad || c.x + r > width - pad || c.y - r < pad || c.y + r > height - pad) continue;
      if (rectGap(c, basketRect) < r + gap) continue;
      if (!best || r > best.r) best = {r, c, n, u, turn:Math.sign(u.x*n.y - u.y*n.x)};
      break;
    }
  }
  return best;
}

// Collection flights finish with a strictly vertical drop into the upright
// basket. Items that start below the basket loop the loop on the way up.
export function planDropFlight({start, basket, width, height, pad, catchDistance, loopRadius = 0}) {
  const end = {x:basket.x, y:basket.y + basket.width*.17};
  const approach = {x:end.x, y:Math.max(pad, end.y - catchDistance)};
  const lift = Math.max(1, Math.min(distance(start, approach)*.45, approach.y - pad));
  // A control point straight above the approach makes the curve arrive heading down.
  const c2 = {x:approach.x, y:approach.y - lift};
  const half = basket.width / 2;
  const basketRect = {left:basket.x - half, right:basket.x + half, top:basket.y - half, bottom:basket.y + half};
  const below = start.y > basketRect.bottom;
  const bezier = c1 => {
    const steps = Math.max(8, Math.ceil((distance(start, c1) + distance(c1, c2) + distance(c2, approach)) / 4));
    const points = Array.from({length:steps + 1}, (_, i) => cubic(start, c1, c2, approach, i / steps));
    points[0] = {...start};
    return points;
  };
  const largestLoop = points => {
    if (!(loopRadius > 0)) return null;
    const lengths = measure(points);
    let best = null;
    for (let share = .15; share <= .801; share += .05) {
      const index = lengths.findIndex(at => at >= lengths.at(-1)*share);
      const candidate = fitLoop(points, index, {width, height, pad, basketRect, radius:loopRadius, gap:pad*.5});
      if (candidate && (!best || candidate.r >= best.r)) best = {...candidate, index};
    }
    return best;
  };
  let curve = bezier(mix(start, c2, 1/3)), loop = null;
  if (below) {
    // Rise beside the basket, never through it: prefer the start's side, then
    // the side where the artwork fits, then the side with room for the loop.
    const room = side => side > 0 ? width - basketRect.right : basketRect.left;
    const clear = points => points.every(p => p.y < basketRect.top || rectGap(p, basketRect) >= pad);
    const preferred = Math.sign(start.x - basket.x) || 1;
    const sides = [preferred, -preferred].filter(side => room(side) >= pad*1.5);
    let fallback = null;
    for (const side of sides.length ? sides : [room(1) >= room(-1) ? 1 : -1]) {
      let candidate = null;
      for (let offset = half + pad*.5; offset <= width; offset += 8) {
        candidate = bezier({x:basket.x + side*offset, y:basketRect.top});
        if (clear(candidate)) break;
      }
      fallback ??= candidate;
      loop = largestLoop(candidate);
      if (loop) { curve = candidate; break; }
    }
    if (!loop) curve = fallback;
  }
  const dropSteps = Math.max(2, Math.ceil(distance(approach, end) / 4));
  const drop = Array.from({length:dropSteps}, (_, i) => mix(approach, end, (i + 1) / dropSteps));

  let points = [...curve, ...drop], range = null;
  if (loop) {
    const {r, c, n, u, index} = loop;
    const count = Math.ceil(2*Math.PI*r / 4);
    const circle = Array.from({length:count}, (_, i) => {
      const phi = (i + 1) / count * 2*Math.PI;
      return {x:c.x - r*n.x*Math.cos(phi) + r*u.x*Math.sin(phi), y:c.y - r*n.y*Math.cos(phi) + r*u.y*Math.sin(phi)};
    });
    circle[count - 1] = {...curve[index]};
    points = [...curve.slice(0, index + 1), ...circle, ...curve.slice(index + 1), ...drop];
    range = {start:index, end:index + count, turn:loop.turn, radius:r};
  }
  const lengths = measure(points);
  return {points, lengths, length:lengths.at(-1), approach, end, loop:range, dropStart:points.length - dropSteps - 1};
}

function intersects(a, b, rect) {
  let low = 0, high = 1;
  for (const [origin, delta, min, max] of [
    [a.x, b.x - a.x, rect.left, rect.right],
    [a.y, b.y - a.y, rect.top, rect.bottom],
  ]) {
    if (Math.abs(delta) < 0.0001) {
      if (origin <= min || origin >= max) return false;
    } else {
      const t1 = (min - origin) / delta, t2 = (max - origin) / delta;
      low = Math.max(low, Math.min(t1, t2));
      high = Math.min(high, Math.max(t1, t2));
    }
  }
  return low < high && low < 1 && high > 0;
}

function visibilityRoute(start, goal, bounds, obstacles) {
  const valid = p => p.x >= bounds.left && p.x <= bounds.right
    && p.y >= bounds.top && p.y <= bounds.bottom
    && !obstacles.some(r => inside(p, r));
  if (!valid(start) || !valid(goal)) return null;
  const corners = r => [
    { x:r.left - 0.5, y:r.top - 0.5 }, { x:r.right + 0.5, y:r.top - 0.5 },
    { x:r.right + 0.5, y:r.bottom + 0.5 }, { x:r.left - 0.5, y:r.bottom + 0.5 },
  ];
  const nodes = [start, goal, ...obstacles.flatMap(corners).filter(valid)];
  const costs = nodes.map(() => Infinity), previous = [], visited = new Set();
  costs[0] = 0;
  while (visited.size < nodes.length) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++) {
      if (!visited.has(i) && (current === -1 || costs[i] < costs[current])) current = i;
    }
    if (current === -1 || costs[current] === Infinity) return null;
    if (current === 1) {
      const route = [];
      for (let i = 1; i !== undefined; i = previous[i]) route.unshift(nodes[i]);
      return route;
    }
    visited.add(current);
    for (let next = 0; next < nodes.length; next++) {
      if (visited.has(next) || obstacles.some(r => intersects(nodes[current], nodes[next], r))) continue;
      const cost = costs[current] + distance(nodes[current], nodes[next]);
      if (cost < costs[next]) { costs[next] = cost; previous[next] = current; }
    }
  }
  return null;
}

function roundedPoints(vertices, obstacles, safePadding) {
  const protectedRects = obstacles.map(r => ({left:r.left-safePadding, right:r.right+safePadding, top:r.top-safePadding, bottom:r.bottom+safePadding}));
  const points = [vertices[0]];
  const lineTo = end => {
    const start = points.at(-1), steps = Math.max(1, Math.ceil(distance(start, end) / 5));
    for (let i = 1; i <= steps; i++) points.push(mix(start, end, i / steps));
  };
  for (let i = 1; i < vertices.length - 1; i++) {
    const before = vertices[i - 1], corner = vertices[i], after = vertices[i + 1];
    let radius = Math.min(34, distance(before, corner) / 3, distance(corner, after) / 3);
    let curve;
    do {
      const a = mix(corner, before, radius / Math.max(0.001, distance(corner, before)));
      const b = mix(corner, after, radius / Math.max(0.001, distance(corner, after)));
      curve = Array.from({length:17}, (_, j) => {
        const t = j / 16;
        return mix(mix(a, corner, t), mix(corner, b, t), t);
      });
      if (!curve.some(p => protectedRects.some(r => inside(p, r)))) break;
      radius /= 2;
    } while (radius > 0.2);
    lineTo(curve[0]);
    points.push(...curve.slice(1));
  }
  lineTo(vertices.at(-1));
  return points;
}

// The hero's actual obstacles determine the route. Rounding is checked again
// against the protected rectangles so a pretty corner cannot cut through a card.
export function planFlightPath({start, approach, end, width, height, obstacles, radius, minClearance = radius+1}) {
  const bounds = {left:radius + 1, top:radius + 1, right:width - radius - 1, bottom:height - radius - 1};
  for (const clearance of new Set([radius + 18, radius + 8, radius + 1, minClearance])) {
    const inflated = obstacles.map(r => ({left:r.left-clearance, right:r.right+clearance, top:r.top-clearance, bottom:r.bottom+clearance}));
    const route = visibilityRoute(start, approach, bounds, inflated);
    if (!route) continue;
    const points = roundedPoints([...route, end], obstacles, Math.min(radius,Math.max(0,clearance-1)));
    const lengths = [0];
    for (let i = 1; i < points.length; i++) lengths.push(lengths.at(-1) + distance(points[i - 1], points[i]));
    return {points, lengths, length:lengths.at(-1), clearance};
  }
  throw new Error("No clear route to the illustrated basket");
}

export function sampleFlightPath(route, position) {
  const at = Math.max(0, Math.min(route.length, position));
  let low = 1, high = route.lengths.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (route.lengths[mid] < at) low = mid + 1;
    else high = mid;
  }
  const index = low, a = route.points[index - 1], b = route.points[index];
  const span = route.lengths[index] - route.lengths[index - 1];
  return {...mix(a, b, span ? (at-route.lengths[index-1])/span : 0), angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};
}

// Keep full-size artwork inside the hero. Only the final basket approach may
// use a smaller footprint; remeasure afterwards so speed follows the new path.
// A planned vertical drop (from route.dropStart) is kept exactly as planned.
export function fitFlightPath(route, {width, height, halfWidth, halfHeight, catchDistance}) {
  const points = route.points.map((p,index) => {
    if (index >= (route.dropStart ?? Infinity)) return p;
    const footprint = Math.min(1, (route.length-route.lengths[index])/catchDistance+.15);
    const xPad = halfWidth*footprint+1, yPad = halfHeight*footprint+1;
    return {x:Math.max(xPad,Math.min(width-xPad,p.x)), y:Math.max(yPad,Math.min(height-yPad,p.y))};
  });
  const lengths = measure(points);
  return {...route,points,lengths,length:lengths.at(-1)};
}
