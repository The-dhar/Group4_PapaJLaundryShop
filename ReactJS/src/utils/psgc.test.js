import {
  findPsgcByName,
  loadPsgcBarangaysByCityCode,
  loadPsgcCities,
} from './psgc';

describe('psgc utils', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test('loads and keeps only cities from PSGC payload', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { code: '0101', name: 'City of Manila', type: 'City', province: 'NCR' },
          { code: '0202', name: 'Zamboanguita', type: 'Municipality', province: 'Negros Oriental' },
          { code: '0303', name: 'Quezon City', type: 'city', province: 'NCR' },
        ],
      }),
    });

    const rows = await loadPsgcCities();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.code)).toEqual(['0101', '0303']);
    expect(rows.every((row) => row.locality_kind === 'city')).toBe(true);
    expect(rows[0].display_name).toBe('Manila City');
  });

  test('supports city aliases for strict PSGC matching', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [
        { code: '0101', name: 'City of Manila', type: 'City', province: 'NCR' },
      ],
    });

    const cities = await loadPsgcCities();
    expect(findPsgcByName(cities, 'Manila')).not.toBeNull();
    expect(findPsgcByName(cities, 'Manila City')?.code).toBe('0101');
    expect(findPsgcByName(cities, 'City of Manila')?.code).toBe('0101');
    expect(findPsgcByName(cities, 'Unknown Place')).toBeNull();
  });

  test('loads barangays by selected city code and uses cache', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { code: 'b2', name: 'Barangay 2' },
          { code: '', name: 'No Code' },
          { code: 'b1', name: 'Barangay 1' },
        ],
      }),
    });

    const firstLoad = await loadPsgcBarangaysByCityCode('0101');
    const secondLoad = await loadPsgcBarangaysByCityCode('0101');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://psgc.cloud/api/v2/cities-municipalities/0101/barangays',
      expect.any(Object)
    );
    expect(firstLoad).toEqual([
      { code: 'b1', name: 'Barangay 1' },
      { code: 'b2', name: 'Barangay 2' },
    ]);
    expect(secondLoad).toEqual(firstLoad);
  });

  test('throws on PSGC request failure so UI can fallback to manual input', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    await expect(loadPsgcCities()).rejects.toThrow('PSGC request failed (503)');
  });
});
