import Canvas from './Canvas.js';
import {rand} from './util.js';

const BLACK = new Uint8ClampedArray(3);

let canvas;
let colorMap;
let labeledPixels;
let listeners = new Set();
let neighbors;
let threads;
let tileBounds;
let tiles;

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
      colorMap[i] = new Uint8ClampedArray([rand(256), rand(256), rand(256)]);
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
    neighbors = new Array(tiles.length);
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
              knownBounds[0] = Math.min(knownBounds[0], threadBounds[0]);
              knownBounds[1] = Math.max(knownBounds[1], threadBounds[1]);
              knownBounds[2] = Math.min(knownBounds[2], threadBounds[2]);
              knownBounds[3] = Math.max(knownBounds[3], threadBounds[3]);
            }
          }
          resolve();
        };
      });
    }

    return Promise.all(partitionPromises).then(() => this.render_());
  }

  render_() {
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        canvas.setPixel(x, y, colorMap[labeledPixels[y][x]]);
      }
    }
    canvas.repaint();
  }

  updateSection_([minX, maxX, minY, maxY]) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        canvas.setPixel(x, y, colorMap[labeledPixels[y][x]]);
      }
    }
  }

  selectTile(x, y) {
    const tileIndex = labeledPixels[y][x];
    colorMap[tileIndex] = new Uint8ClampedArray([rand(256), rand(256), rand(256)]);
    this.updateSection_(tileBounds[tileIndex]);
    canvas.repaint();
  }

  recolor() {
    Object.values(colorMap).forEach(color => {
      color[0] = rand(256);
      color[1] = rand(256);
      color[2] = rand(256);      
    });
    return this.render_();
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
