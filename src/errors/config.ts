import { AuthError } from './auth';

/**
 * Standard Schema V1 path segment shape.
 */
export interface ConfigIssuePathSegment {
  readonly key: PropertyKey;
}

/**
 * Standard Schema V1 issue shape returned by configuration validation.
 */
export interface ConfigIssue {
  readonly message: string;
  readonly path?: readonly (PropertyKey | ConfigIssuePathSegment)[] | undefined;
}

/**
 * Error thrown when auth configuration validation fails.
 */
export class ConfigError extends AuthError {
  public static readonly code = 'ERR_CONFIG_VALIDATION';

  /**
   * Standard Schema validation issues for the invalid configuration.
   */
  public readonly issues: readonly ConfigIssue[];

  /**
   * @param issues - Standard Schema validation issues.
   */
  constructor(issues: readonly ConfigIssue[]) {
    super({
      code: ConfigError.code,
      message: `Invalid @go-mondo/nextjs-auth configuration:\n${formatIssues(
        issues,
      )}`,
      name: 'ConfigError',
    });

    this.issues = issues;

    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

function formatIssues(issues: readonly ConfigIssue[]): string {
  return issues
    .map((issue) => {
      const path = issue.path?.length
        ? issue.path.map(formatPathSegment).join('.')
        : 'config';
      return `- ${path}: ${issue.message}`;
    })
    .join('\n');
}

function formatPathSegment(
  segment: NonNullable<ConfigIssue['path']>[number],
): string {
  return typeof segment === 'object' && segment !== null && 'key' in segment
    ? String(segment.key)
    : String(segment);
}
