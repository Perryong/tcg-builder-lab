import assert from 'node:assert/strict';
import test from 'node:test';
import {forecastPrice, normalizePriceHistory, summarizePriceHistory} from '../src/prices/model.ts';

function history(days: number, price: (day: number) => number) {
  const start = Date.UTC(2025, 0, 1);
  return {Normal: Array.from({length: days}, (_, day) => ({
    snapshot_date: new Date(start + day * 86400000).toISOString().slice(0, 10),
    market: price(day).toFixed(2),
    low: '1.00',
  }))};
}

test('normalizes dated market prices without zeroes, duplicates, or malformed rows', () => {
  const series = normalizePriceHistory({Normal: [
    {snapshot_date: '2026-01-02', market: '2.00'},
    {snapshot_date: '2026-01-01', market: '0'},
    {snapshot_date: '2026-01-02', market: '3.00'},
    {snapshot_date: 'invalid', market: '4.00'},
    {snapshot_date: '2026-01-03', market: 'NaN'},
  ]});
  assert.deepEqual(series, [{finish: 'Normal', points: [{date: '2026-01-02', market: 3}]}]);
});

test('refuses a 90-day prediction without enough observations to backtest', () => {
  const points = normalizePriceHistory(history(150, () => 10))[0].points;
  assert.equal(forecastPrice(points, 90), null);
});

test('flat prices keep the last market price and include backtest evidence', () => {
  const points = normalizePriceHistory(history(600, () => 10))[0].points;
  const forecast = forecastPrice(points, 90);
  assert.ok(forecast);
  assert.equal(forecast.model, 'Last price');
  assert.equal(forecast.estimate, 10);
  assert.equal(forecast.reliable, true);
  assert.ok(forecast.backtestCount >= 3);
  assert.equal(forecast.asOf, points.at(-1)?.date);
});

test('sustained rising prices can select the trained trend over the last-price baseline', () => {
  const points = normalizePriceHistory(history(420, day => 10 * Math.exp(day * 0.001)))[0].points;
  const forecast = forecastPrice(points, 30);
  assert.ok(forecast);
  assert.equal(forecast.model, 'Recent trend');
  assert.ok(forecast.estimate > points.at(-1)!.market);
  assert.ok(forecast.bandLow < forecast.estimate && forecast.bandHigh > forecast.estimate);
});

test('marks a repeatedly swinging card too uncertain to present as a forecast', () => {
  const points = normalizePriceHistory(history(420, day => Math.floor(day / 30) % 2 ? 30 : 10))[0].points;
  const forecast = forecastPrice(points, 30);
  assert.ok(forecast);
  assert.equal(forecast.reliable, false);
  assert.ok(forecast.backtestError > 40);
});

test('needs three later held-out windows after training outcomes are known', () => {
  const points = normalizePriceHistory(history(420, () => 10))[0].points;
  assert.equal(forecastPrice(points, 90), null);
});

test('monthly chart omits raw daily values and retains the latest price', () => {
  const summary = summarizePriceHistory(history(600, day => 10 + day / 100))[0];
  assert.ok(summary.chart.length <= 13);
  assert.equal(summary.observations, 600);
  assert.equal(summary.latest.market, 15.99);
});
