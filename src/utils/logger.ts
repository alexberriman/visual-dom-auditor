import pino from "pino";
import { performance } from "node:perf_hooks";

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
 * Debug logger - use for detailed diagnostic information
 * Only visible when LOG_LEVEL is set to "debug" or lower
 */
export const debug = (message: string, ...args: unknown[]): void => {
  logger.debug({ data: args.length > 0 ? args : undefined }, message);
};

/**
 * Info logger - use for general operational information
 * Visible by default (info level)
 */
export const info = (message: string, ...args: unknown[]): void => {
  logger.info({ data: args.length > 0 ? args : undefined }, message);
};

/**
 * Warning logger - use for concerning but non-critical issues
 * Visible by default (info level)
 */
export const warn = (message: string, ...args: unknown[]): void => {
  logger.warn({ data: args.length > 0 ? args : undefined }, message);
};

/**
 * Error logger - use for application errors that require attention
 * Always visible regardless of log level
 */
export const error = (message: string, ...args: unknown[]): void => {
  errorLogger.error({ data: args.length > 0 ? args : undefined }, message);
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
};
