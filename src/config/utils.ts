const FALSEY = ['n', 'no', 'false', '0', 'off'];

export const bool = (
  param?: any,
  defaultValue?: boolean,
): boolean | undefined => {
  if (param === undefined || param === '') return defaultValue;
  if (param && typeof param === 'string')
    return !FALSEY.includes(param.toLowerCase().trim());
  return !!param;
};

export const num = (param?: string): number | undefined =>
  param === undefined || param === '' ? undefined : +param;
