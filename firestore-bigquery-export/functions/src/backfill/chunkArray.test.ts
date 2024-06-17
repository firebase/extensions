import { chunkArray } from "./chunkArray";

describe("chunkArray", () => {
  test("should chunk an array into smaller arrays of specified size", () => {
    const input = [1, 2, 3, 4, 5];
    const size = 2;
    const expected = [[1, 2], [3, 4], [5]];
    expect(chunkArray(input, size)).toEqual(expected);
  });

  test("should handle cases where the array length is an exact multiple of the size", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const size = 3;
    const expected = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    expect(chunkArray(input, size)).toEqual(expected);
  });
});
