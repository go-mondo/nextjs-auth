// export type DeepPartial<T> = {
//   [P in keyof T]?: T[P] extends Array<infer I> ? Array<DeepPartial<I>> : DeepPartial<T[P]>;
// };

/**
 * TODO - MOVE THESE TO A UTILS FILE
 */
const FALSEY = ['n', 'no', 'false', '0', 'off'];

export const bool = (
  param?: any,
  defaultValue?: boolean
): boolean | undefined => {
  if (param === undefined || param === '') return defaultValue;
  if (param && typeof param === 'string')
    return !FALSEY.includes(param.toLowerCase().trim());
  return !!param;
};

export const num = (param?: string): number | undefined =>
  param === undefined || param === '' ? undefined : +param;

// export const array = (param?: string): string[] | undefined =>
//   param === undefined || param === '' ? undefined : param.replace(/\s/g, '').split(',');
