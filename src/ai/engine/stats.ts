export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

export function medianAbsoluteDeviation(
  values: number[],
  center: number,
): number {
  const deviations = values.map((value) => Math.abs(value - center));
  return median(deviations);
}

export interface Quartiles {
  q1: number;
  q3: number;
}

export function quartiles(values: number[]): Quartiles {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lowerHalf = sorted.slice(0, mid);
  const upperHalf =
    sorted.length % 2 === 0 ? sorted.slice(mid) : sorted.slice(mid + 1);

  return { q1: median(lowerHalf), q3: median(upperHalf) };
}
