import { getInstance } from '../init';
import { type CallbackHandler, callbackHandlerFactory } from './callback';
import { type LoginHandler, loginHandlerFactory } from './login';
import { type LogoutHandler, logoutHandlerFactory } from './logout';
import { type SessionHandler, sessionHandlerFactory } from './session';

export const handleLogin = (...args: Parameters<LoginHandler>) =>
  loginHandlerFactory(getInstance())(...args);

export const handleCallback = (...args: Parameters<CallbackHandler>) =>
  callbackHandlerFactory(getInstance())(...args);

export const handleLogout = (...args: Parameters<LogoutHandler>) =>
  logoutHandlerFactory(getInstance())(...args);

export const handleGetSession = (...args: Parameters<SessionHandler>) =>
  sessionHandlerFactory(getInstance())(...args);
