import Voronoi from './js/Voronoi.js';
import {extractUrlParams, stopwatch} from './js/util.js';

const urlParams = extractUrlParams();
const numThreads = parseInt(urlParams['threads']) || 4;
const numTiles = () => {
  return parseInt(urlParams['n']) ||
      Math.round(window.innerWidth * window.innerHeight / 3000);
};
const metric = [1, 2, 3].includes(parseInt(urlParams['metric'])) ?
    parseInt(urlParams['metric']) :
    2;
const v = new Voronoi(numThreads);

stopwatch('initial render', () => v.randomize(numTiles()).partition(metric));

v.addEventListener('mousemove', ({layerX, layerY}) => {
  v.highlightTile(layerX, layerY);
});

v.addEventListener('mousedown', ({layerX, layerY}) => {
  const tileIndex = v.getTileIndex(layerX, layerY);
  console.log('tileIndex', tileIndex);
});

document.addEventListener('keydown', e => {
  if (e.keyCode === 86 /* 'v' */) {
    stopwatch('rerender', () => v.randomize(numTiles()).partition(metric));
  }
});

window.addEventListener('resize', () => {
  stopwatch('resize', () => v.resize(metric));
});
