export type PricePoint = {date: string; market: number};
export type PriceSeries = {finish: string; points: PricePoint[]};
export type PriceForecast = {model: 'Last price' | 'Recent trend'; estimate: number; bandLow: number; bandHigh: number; backtestCount: number; backtestError: number; reliable: boolean; asOf: string; horizon: 30 | 90};
export type PriceSummary = {finish: string; chart: PricePoint[]; latest: PricePoint; observations: number; forecasts: {30: PriceForecast | null; 90: PriceForecast | null}};
export type PriceMover = {product_id: number; name: string; set_name: string; finish: string; before: number; after: number; changePercent: number; image_url: string | null};
export type MoverBoard = {gainers: PriceMover[]; fallers: PriceMover[]};

export function rankMovers(raw: unknown): MoverBoard {
  if (!Array.isArray(raw)) return {gainers: [], fallers: []};
  const seen = new Set<string>();
  const rows: PriceMover[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || item.thin || item.recovery || !Number.isInteger(item.product_id) ||
        item.product_id <= 0 || typeof item.name !== 'string' || !item.name.trim() ||
        typeof item.set_name !== 'string' || typeof item.sub_type_name !== 'string') continue;
    const identity = `${item.product_id}:${item.sub_type_name}`;
    if (seen.has(identity)) continue;
    const before = Number(item.base_market);
    const after = Number(item.market);
    if (!Number.isFinite(before) || !Number.isFinite(after) || before < 5 || after <= 0) continue;
    const changePercent = Math.round((after / before - 1) * 1000) / 10;
    if (!changePercent) continue;
    const url = typeof item.image_url === 'string' ? item.image_url : '';
    let image_url: string | null = null;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' && ['assets.tcgdex.net', 'tcgplayer-cdn.tcgplayer.com'].includes(parsed.hostname)) image_url = parsed.toString();
    } catch { /* No image for this market product. */ }
    rows.push({product_id: item.product_id, name: item.name, set_name: item.set_name,
      finish: item.sub_type_name, before, after, changePercent, image_url});
    seen.add(identity);
  }
  return {
    gainers: rows.filter(row => row.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, 10),
    fallers: rows.filter(row => row.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 10),
  };
}

export function normalizePriceHistory(raw: unknown): PriceSeries[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return Object.entries(raw).flatMap(([finish, rows]) => {
    if (!Array.isArray(rows)) return [];
    const byDate = new Map<string, PricePoint>();
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const {snapshot_date: date, market} = row as Record<string, unknown>;
      const value = typeof market === 'number' || typeof market === 'string' ? Number(market) : NaN;
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date ||
          !Number.isFinite(value) || value <= 0) continue;
      byDate.set(date, {date, market: value});
    }
    const points = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    return points.length ? [{finish, points}] : [];
  });
}

// shortcut: price-only trend omits reprints and tournament events; add dated event features when that history is available.
function trendPrice(history: PricePoint[], horizon: number): number {
  const rows = history.slice(-90);
  const first = Date.parse(rows[0].date);
  const x = rows.map(row => (Date.parse(row.date) - first) / 86400000);
  const y = rows.map(row => Math.log(row.market));
  const xMean = x.reduce((a, b) => a + b, 0) / x.length;
  const yMean = y.reduce((a, b) => a + b, 0) / y.length;
  const numerator = x.reduce((sum, value, i) => sum + (value - xMean) * (y[i] - yMean), 0);
  const denominator = x.reduce((sum, value) => sum + (value - xMean) ** 2, 0);
  const slope = denominator ? Math.max(-0.003, Math.min(0.003, numerator / denominator)) : 0;
  return rows.at(-1)!.market * Math.exp(slope * horizon * 0.5);
}

export function forecastPrice(points: PricePoint[], horizon: 30 | 90): PriceForecast | null {
  if (points.length < 90 + horizon + 5) return null;
  const trials: {originDate: string; targetDate: string; last: number; trend: number; actual: number}[] = [];
  const start = Math.max(89, points.length - horizon - 360);
  for (let origin = start; origin + horizon < points.length; origin += 30) {
    const target = points[origin + horizon];
    const elapsed = (Date.parse(target.date) - Date.parse(points[origin].date)) / 86400000;
    if (Math.abs(elapsed - horizon) > 3) continue;
    trials.push({originDate: points[origin].date, targetDate: target.date, last: points[origin].market, trend: trendPrice(points.slice(0, origin + 1), horizon), actual: target.market});
  }
  if (trials.length < 8) return null;
  const training = trials.slice(0, Math.max(5, Math.floor(trials.length * 0.6)));
  // Holdout origins must follow every training outcome, including the 90-day target.
  const holdout = trials.filter(t => t.originDate >= training.at(-1)!.targetDate);
  if (holdout.length < 3) return null;
  const error = (rows: typeof trials, model: 'last' | 'trend') => rows.map(t => Math.abs(Math.log(t[model] / t.actual)));
  const lastErrors = error(training, 'last');
  const trendErrors = error(training, 'trend');
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const useTrend = mean(trendErrors) < mean(lastErrors) * 0.95;
  const errors = error(holdout, useTrend ? 'trend' : 'last');
  const estimate = useTrend ? trendPrice(points, horizon) : points.at(-1)!.market;
  const sorted = [...errors].sort((a, b) => a - b);
  const band = Math.max(Math.log(1.05), sorted[Math.ceil(sorted.length * 0.8) - 1]);
  const backtestError = mean(errors.map(value => Math.expm1(value))) * 100;
  return {
    model: useTrend ? 'Recent trend' : 'Last price', estimate,
    bandLow: estimate * Math.exp(-band), bandHigh: estimate * Math.exp(band),
    backtestCount: holdout.length, backtestError, reliable: backtestError <= 40,
    asOf: points.at(-1)!.date, horizon,
  };
}

export function summarizePriceHistory(raw: unknown): PriceSummary[] {
  return normalizePriceHistory(raw).map(({finish, points}) => {
    const recent = points.slice(-365);
    const byMonth = new Map<string, PricePoint[]>();
    for (const point of recent) {
      const month = point.date.slice(0, 7);
      byMonth.set(month, [...(byMonth.get(month) ?? []), point]);
    }
    const chart = [...byMonth.values()].map(rows => ({
      date: rows.at(-1)!.date,
      market: Math.round(rows.reduce((sum, row) => sum + row.market, 0) / rows.length * 100) / 100,
    }));
    const latest = points.at(-1)!;
    const stale = Date.now() - Date.parse(`${latest.date}T00:00:00Z`) > 7 * 86400000;
    return {finish, chart, latest, observations: points.length,
      forecasts: {30: stale ? null : forecastPrice(points, 30), 90: stale ? null : forecastPrice(points, 90)}};
  });
}
