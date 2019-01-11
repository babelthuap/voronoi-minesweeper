import Canvas from './Canvas.js';
import {rand} from './util.js';

const BLACK = new Uint8ClampedArray(3).fill(0);
const GREY_A = new Uint8ClampedArray(3).fill(0xAA);
const GREY_B = new Uint8ClampedArray(3).fill(0xBB);
const NEIGHBOR_OFFSETS = [
          [1, 0],
  [0, 1], [1, 1],
];

let borderPixels;
let canvas;
let colorMap;
let hightlighted;
let labeledPixels;
let listeners = new Set();
let neighbors;
let threads;
let tileBounds;
let tiles;

function addBounds(target, other) {
  target[0] = Math.min(target[0], other[0]);
  target[1] = Math.max(target[1], other[1]);
  target[2] = Math.min(target[2], other[2]);
  target[3] = Math.max(target[3], other[3]);
}

export default class Voronoi {
  constructor(numThreads) {
    canvas = new Canvas();
    canvas.attachToDom();
    threads = new Array(numThreads).fill().map(() => new Worker('./js/thread.js'));

    console.log('thread count:', threads.length);
  }

  randomize(numTiles) {
    tiles = new Array(numTiles);
    colorMap = new Array(numTiles);
    const width = canvas.width;
    const height = canvas.height;
    for (let i = 0; i < numTiles; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      tiles[i] = [x, y];
      colorMap[i] = GREY_B;
    }
    return this;
  }

  partition(metric) {
    if (tiles.length === 0) {
      console.error(`Can't partition with empty tiles array.`);
      return this;
    }

    const width = canvas.width;
    const height = canvas.height;
    const rowsPerThread = Math.ceil(height / threads.length);

    labeledPixels = new Array(height);
    tileBounds = new Array(tiles.length);
    let startPixel = 0;
    const partitionPromises = new Array(threads.length);
    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      partitionPromises[i] = new Promise((resolve) => {
        const start = startPixel;
        const end = i < threads.length - 1 ? (startPixel += rowsPerThread) : height;
        thread.postMessage([start, end, width, tiles, metric]);
        thread.onmessage = ({data}) => {
          const [threadLabeledPixels, threadTileBounds] = data;
          thread.onmessage = null;
          for (let y = start; y < end; y++) {
            labeledPixels[y] = threadLabeledPixels[y - start];
          }
          for (let id in threadTileBounds) {
            if (tileBounds[id] === undefined) {
              tileBounds[id] = threadTileBounds[id];
            } else {
              const knownBounds = tileBounds[id];
              const threadBounds = threadTileBounds[id];
              addBounds(knownBounds, threadBounds);
            }
          }
          resolve();
        };
      });
    }

    return Promise.all(partitionPromises).then(() => {
      this.calculateAdjacency_();
      return this.render_();
    });
  }

  calculateAdjacency_() {
    const width = canvas.width;
    const height = canvas.height;
    borderPixels = new Array(height);
    neighbors = new Array(tiles.length).fill().map(() => new Set());
    for (let y = 0; y < height; y++) {
      borderPixels[y] = [];
      for (let x = 0; x < width; x++) {
        const thisTile = labeledPixels[y][x];
        let isBorder = false;
        NEIGHBOR_OFFSETS.forEach(([dx, dy]) => {
          const nbrX = x + dx;
          const nbrY = y + dy;
          let nbrTile;
          if ((nbrY < height) &&
              (nbrTile = labeledPixels[nbrY][nbrX]) !== undefined &&
              (thisTile !== nbrTile)) {
            isBorder = true;
            neighbors[thisTile].add(nbrTile);
            neighbors[nbrTile].add(thisTile);
          }
        });
        if (isBorder) {
          borderPixels[y].push(x);
        }
      }
    }
  }

  render_() {
    const width = canvas.width;
    const height = canvas.height;
    const fullCanvas = [0, width - 1, 0, height - 1];
    this.updateSection_(fullCanvas);
    this.drawBorders_(fullCanvas);
    canvas.repaint();
  }

  updateSection_([xMin, xMax, yMin, yMax]) {
    for (let y = yMin; y <= yMax; y++) {
      for (let x = xMin; x <= xMax; x++) {
        canvas.setPixel(x, y, colorMap[labeledPixels[y][x]]);
      }
    }
  }

  drawBorders_([xMin, xMax, yMin, yMax]) {
    for (let y = yMin; y <= yMax; y++) {
      for (let x of borderPixels[y]) {
        if (x > xMax) {
          break;
        }
        if (x >= xMin) {
          canvas.setPixel(x, y, BLACK);
        }
      }
    }
  }

  highlightTile(x, y) {
    if (labeledPixels[y] === undefined || !neighbors || !colorMap) {
      return;
    }
    const tileIndex = labeledPixels[y][x];
    if (tileIndex !== hightlighted) {
      // Un-highlight old area
      if (hightlighted !== undefined) {
        colorMap[hightlighted] = GREY_B;
        const bounds = tileBounds[hightlighted];
        neighbors[hightlighted].forEach(nbr => {
          colorMap[nbr] = GREY_B;
          addBounds(bounds, tileBounds[nbr]);
        });
        this.updateSection_(bounds);
        this.drawBorders_(bounds);
      }
      // Highlight new area
      hightlighted = tileIndex;
      colorMap[tileIndex] = GREY_A;
      neighbors[tileIndex].forEach(nbr => colorMap[nbr] = GREY_A);
      // Re-render
      const bounds = tileBounds[tileIndex];
      neighbors[tileIndex].forEach(nbr => addBounds(bounds, tileBounds[nbr]));
      this.updateSection_(bounds);
      this.drawBorders_(bounds);
      canvas.repaint();
    }
  }

  getTileIndex(x, y) {
    return labeledPixels[y][x];
  }

  resize(metric) {
    const wRatio = window.innerWidth / canvas.width;
    const hRatio = window.innerHeight / canvas.height;
    for (let tile of tiles) {
      tile[0] *= wRatio;
      tile[1] *= hRatio;
    }
    listeners.forEach(args => canvas.removeEventListener(...args));
    canvas = new Canvas();
    canvas.attachToDom();
    listeners.forEach(args => canvas.addEventListener(...args));
    return this.partition(metric);
  }

  addEventListener(...args) {
    listeners.add(args);
    canvas.addEventListener(...args);
  }

  removeEventListener(...args) {
    listeners.delete(args);
    canvas.removeEventListener(...args);
  }
}
