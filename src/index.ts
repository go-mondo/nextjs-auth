import { getInstance } from './init';
import {
  type GetSession,
  getSessionFactory,
  type TouchSession,
  touchSessionFactory,
  type UpdateSession,
  updateSessionFactory,
} from './session/factory';
import type { Claims } from './session/types';

export const getSession = <UserClaims extends Claims>(
  ...args: Parameters<GetSession<UserClaims>>
) => getSessionFactory(getInstance())(...args);

export const touchSession = <UserClaims extends Claims>(
  ...args: Parameters<TouchSession<UserClaims>>
) => touchSessionFactory(getInstance())(...args);

export const updateSession = <UserClaims extends Claims>(
  ...args: Parameters<UpdateSession<UserClaims>>
) => updateSessionFactory(getInstance())(...args);
