export const assertBoolean = (bool: boolean, msg: string) => {
  if (!bool) {
    throw new Error(msg);
  }
};
