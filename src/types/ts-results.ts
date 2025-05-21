/**
 * Type definitions for ts-results
 */
import tsResults from "ts-results";

// Re-export the types from ts-results
export type Result<T, E> = tsResults.Result<T, E>;
export type OkType<T> = tsResults.Ok<T>;
export type ErrType<E> = tsResults.Err<E>;

// Export the values from ts-results directly
export const { Ok, Err } = tsResults;
