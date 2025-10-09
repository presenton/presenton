import { sum } from '../src/utils/math';

test('sum adds two numbers', () => {
  expect(sum(2, 3)).toBe(5);
});
