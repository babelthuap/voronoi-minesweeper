onmessage = function(e) {
  const [start, end, width, tiles, metric] = e.data;
  partition(start, end, width, tiles, metric);
};

const metrics = {
  1: (x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2),
  2: (x1, y1, x2, y2) => (x1 - x2) ** 2 + (y1 - y2) ** 2,
  3: (x1, y1, x2, y2) => Math.abs(x1 - x2) ** 3 + Math.abs(y1 - y2) ** 3,
};

function updateTileBounds(x, y, tile) {
  if (tile in this) {
    const bounds = this[tile];
    if (x < bounds[0]) {
      bounds[0] = x;
    } else if (x > bounds[1]) {
      bounds[1] = x;
    }
    if (y < bounds[2]) {
      bounds[2] = y;
    } else if (y > bounds[3]) {
      bounds[3] = y;
    }
  } else {
    this[tile] = [x, y, x, y];
  }
}

function partition(start, end, width, tiles, metric) {
  const distFunction = metrics[metric];
  const labeledPixels = new Array(end - start);
  const tileBounds = {};
  const updateBounds = updateTileBounds.bind(tileBounds);
  // Label tiles
  for (let y = start; y < end; y++) {
    const row = labeledPixels[y - start] = new Array(width);
    for (let x = 0; x < width; x++) {
      let closestTile;
      let minDist = Infinity;
      for (let i = 0; i < tiles.length; i++) {
        const [tileX, tileY] = tiles[i];
        const dist = distFunction(x, y, tileX, tileY);
        if (dist < minDist) {
          minDist = dist;
          closestTile = i;
        }
      }
      row[x] = closestTile;
      updateBounds(x, y, closestTile);
    }
  }

  // TODO: Calculate borders and neighbors
  const neighbors = {};

  postMessage([labeledPixels, tileBounds]);
}
