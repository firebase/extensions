import {parseLimit, parseQuerySchema} from '../../src/queries/util';
import {z} from 'zod';

describe('parseLimit', () => {
  test('should return the input as is for integer numbers greater than 0', () => {
    expect(parseLimit(5)).toBe(5);
    expect(parseLimit(100)).toBe(100);
  });

  test('should return the input as is for strings representing integer numbers greater than 0', () => {
    expect(parseLimit('5')).toBe(5);
    expect(parseLimit('100')).toBe(100);
  });

  test('should throw an error for floats or strings representing floats', () => {
    expect(() => parseLimit(5.5)).toThrow(
      'limit must be an integer greater than 0'
    );
    expect(() => parseLimit('5.5')).toThrow(
      'limit must be an integer greater than 0'
    );
  });

  test('should throw an error for values less than 1', () => {
    expect(() => parseLimit(0)).toThrow(
      'limit must be an integer greater than 0'
    );
    expect(() => parseLimit(-5)).toThrow(
      'limit must be an integer greater than 0'
    );
    expect(() => parseLimit('0')).toThrow(
      'limit must be an integer greater than 0'
    );
    expect(() => parseLimit('-5')).toThrow(
      'limit must be an integer greater than 0'
    );
  });

  test('should throw an error for inputs that are not numbers or strings', () => {
    expect(() => parseLimit(null)).toThrow(
      'limit must be a string or a number'
    );
    expect(() => parseLimit(undefined)).toThrow(
      'limit must be a string or a number'
    );
    expect(() => parseLimit({})).toThrow('limit must be a string or a number');
    expect(() => parseLimit([])).toThrow('limit must be a string or a number');
  });

  test('should throw an error for strings that are not valid numbers', () => {
    expect(() => parseLimit('abc')).toThrow(
      'limit must be an integer greater than 0'
    );
    expect(() => parseLimit('4.5x')).toThrow(
      'limit must be an integer greater than 0'
    );
  });
});

describe('parseQuerySchema', () => {
  test('should parse valid data with query and limit as a string', () => {
    const data = {query: 'example query', limit: '10'};
    expect(parseQuerySchema(data)).toEqual({
      query: 'example query',
      limit: '10',
    });
  });

  test('should parse valid data with query and limit as a number', () => {
    const data = {query: 'example query', limit: 10};
    expect(parseQuerySchema(data)).toEqual({
      query: 'example query',
      limit: 10,
    });
  });

  test('should parse valid data with query and prefilters', () => {
    const data = {
      query: 'example query',
      prefilters: [
        {
          field: 'test',
          operator: '==',
          value: 'value',
        },
      ],
    };
    expect(parseQuerySchema(data)).toEqual(data);
  });

  test('should parse valid data with only query', () => {
    const data = {query: 'example query'};
    expect(parseQuerySchema(data)).toEqual(data);
  });

  test('should throw an error if query field is missing or undefined', () => {
    const data = {limit: '10'};
    expect(() => parseQuerySchema(data)).toThrow(z.ZodError);
    expect(() => parseQuerySchema({})).toThrow(z.ZodError);
  });

  test('should throw an error if limit is neither a string nor a number', () => {
    const data = {query: 'example query', limit: false};
    expect(() => parseQuerySchema(data)).toThrow(z.ZodError);
  });
});
