import { API_URL } from './config/api';

test('api url config is defined', () => {
  expect(typeof API_URL).toBe('string');
  expect(API_URL.length).toBeGreaterThan(0);
});
