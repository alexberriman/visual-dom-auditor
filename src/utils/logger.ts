import pino from "pino";
import { performance } from "node:perf_hooks";
import { prefixWithUrl } from "./colors";

/**
 * Logger configuration - create a pre-configured logger instance
 * based on project requirements.
 *
 * Logging is silent by default unless:
 * - LOG_LEVEL environment variable is set
 * - --verbose flag is passed (handled by CLI)
 * - Error level logs (always shown)
 */
const shouldEnableLogging = (): boolean => {
  return Boolean(process.env.LOG_LEVEL || process.env.VERBOSE_LOGGING);
};

const logger = pino({
  level: shouldEnableLogging() ? process.env.LOG_LEVEL || "info" : "silent",
  transport: shouldEnableLogging()
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});

/**
 * Error-only logger for critical errors that should always be shown
 */
const errorLogger = pino({
  level: "error",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  },
});

/**
 * Current URL context for logging
 */
let currentLoggerUrl: string | null = null;

/**
 * Set the current URL context for all subsequent log messages
 */
export const setLoggerUrlContext = (url: string | null): void => {
  currentLoggerUrl = url;
};

/**
 * Get the current URL context
 */
export const getLoggerUrlContext = (): string | null => {
  return currentLoggerUrl;
};

/**
 * Debug logger - use for detailed diagnostic information
 * Only visible when LOG_LEVEL is set to "debug" or lower
 */
export const debug = (message: string, ...args: unknown[]): void => {
  const displayMessage = currentLoggerUrl ? prefixWithUrl(currentLoggerUrl, message) : message;
  logger.debug({ data: args.length > 0 ? args : undefined }, displayMessage);
};

/**
 * Info logger - use for general operational information
 * Visible by default (info level)
 */
export const info = (message: string, ...args: unknown[]): void => {
  const displayMessage = currentLoggerUrl ? prefixWithUrl(currentLoggerUrl, message) : message;
  logger.info({ data: args.length > 0 ? args : undefined }, displayMessage);
};

/**
 * Warning logger - use for concerning but non-critical issues
 * Visible by default (info level)
 */
export const warn = (message: string, ...args: unknown[]): void => {
  const displayMessage = currentLoggerUrl ? prefixWithUrl(currentLoggerUrl, message) : message;
  logger.warn({ data: args.length > 0 ? args : undefined }, displayMessage);
};

/**
 * Error logger - use for application errors that require attention
 * Always visible regardless of log level
 */
export const error = (message: string, ...args: unknown[]): void => {
  const displayMessage = currentLoggerUrl ? prefixWithUrl(currentLoggerUrl, message) : message;
  errorLogger.error({ data: args.length > 0 ? args : undefined }, displayMessage);
};

/**
 * Timing utility for performance measurement
 * Takes a label and returns a function that, when called, logs the elapsed time
 */
export const timer = (label: string): (() => number) => {
  const startTime = performance.now();
  return () => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    debug(`${label} completed in ${duration.toFixed(2)}ms`);
    return duration;
  };
};

/**
 * Default export for convenient imports
 */
export default {
  debug,
  info,
  warn,
  error,
  timer,
  setLoggerUrlContext,
  getLoggerUrlContext,
};
