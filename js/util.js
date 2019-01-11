export function extractUrlParams() {
  return location.search.split(/[?&]/).filter(e => e).reduce((map, e) => {
    const [k, v] = e.split('=');
    map[k] = v;
    return map;
  }, {});
}

export function rand(n) {
  return Math.floor(Math.random() * n);
}

export function stopwatch(label, fn) {
  const start = performance.now();
  Promise.resolve(fn()).then(() => {
    const duration = performance.now() - start;
    console.log(label, `${duration.toFixed(1)} ms`);
  });
}
