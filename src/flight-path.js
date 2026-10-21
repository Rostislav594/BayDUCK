const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const inside = (p, r) => p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom;

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
export function fitFlightPath(route, {width, height, halfWidth, halfHeight, catchDistance}) {
  const points = route.points.map((p,index) => {
    const footprint = Math.min(1, (route.length-route.lengths[index])/catchDistance+.15);
    const xPad = halfWidth*footprint+1, yPad = halfHeight*footprint+1;
    return {x:Math.max(xPad,Math.min(width-xPad,p.x)), y:Math.max(yPad,Math.min(height-yPad,p.y))};
  });
  const lengths = [0];
  for (let i=1;i<points.length;i++) lengths.push(lengths.at(-1)+distance(points[i-1],points[i]));
  return {...route,points,lengths,length:lengths.at(-1)};
}
