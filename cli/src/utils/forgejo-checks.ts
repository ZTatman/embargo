const TIMEOUT = 5000;

const LOCAL_HTTP_HOSTS = new Set([
  "forgejo",
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

export type CheckResult = {
  name: string;
  success: boolean;
  message?: string;
};

export function createCheckResult(
  name: string,
  success: boolean,
  message?: string,
): CheckResult {
  const result: CheckResult = { name, success };
  if (message !== undefined) {
    result.message = message;
  }
  return result;
}

export function validateForgejoBaseUrl(
  value: string | undefined,
  label = "Forgejo base URL",
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return `${label} is required`;

  const hasProtocol = /^[a-z]+:\/\//i.test(trimmed);
  const isHttp = /^https?:\/\//i.test(trimmed);

  if (hasProtocol && !isHttp) {
    return `${label} must use http:// or https://`;
  }

  if (!hasProtocol) {
    return `${label} must include a scheme — e.g. http://forgejo:3000 or https://git.example.com`;
  }

  try {
    const url = new URL(trimmed);
    if (!url.hostname) return `${label} must include a domain or hostname`;

    const isLocalHttp =
      url.protocol === "http:" &&
      (LOCAL_HTTP_HOSTS.has(url.hostname) ||
        url.hostname.endsWith(".localhost"));
    if (url.protocol === "http:" && !isLocalHttp) {
      return `${label} must use https:// unless it is a local Forgejo endpoint`;
    }
  } catch {
    return `${label} must be a valid URL`;
  }

  return undefined;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT) });
}

function getErrorMessage(error: unknown, context: string): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError") {
      return `${context}: connection timed out`;
    }
    if (error.message.includes("ECONNREFUSED")) {
      return `${context}: connection refused`;
    }
    if (
      error.message.includes("ENOTFOUND") ||
      error.message.includes("getaddrinfo")
    ) {
      return `${context}: host not found`;
    }
    return `${context}: ${error.message}`;
  }
  return `${context}: unknown error`;
}

export async function checkForgejoReachability(
  baseUrl: string,
): Promise<CheckResult> {
  const validationError = validateForgejoBaseUrl(baseUrl);
  if (validationError) {
    return createCheckResult("Forgejo", false, validationError);
  }

  try {
    const response = await fetchWithTimeout(baseUrl, { method: "GET" });
    if (response.ok) {
      return createCheckResult("Forgejo", true, "is reachable");
    }
    return createCheckResult(
      "Forgejo",
      false,
      `server returned ${response.status} ${response.statusText}`,
    );
  } catch (error) {
    return createCheckResult(
      "Forgejo",
      false,
      getErrorMessage(error, "cannot reach server"),
    );
  }
}

export async function checkRepoAccess(
  baseUrl: string,
  pat: string,
): Promise<CheckResult> {
  const validationError = validateForgejoBaseUrl(baseUrl);
  if (validationError) {
    return createCheckResult("Forgejo", false, validationError);
  }

  try {
    const responses = await Promise.all([
      fetchWithTimeout(`${baseUrl}/api/v1/user`, {
        method: "GET",
        headers: {
          Authorization: `token ${pat}`,
        },
      }),
      fetchWithTimeout(`${baseUrl}/api/v1/user/repos?limit=1`, {
        method: "GET",
        headers: {
          Authorization: `token ${pat}`,
        },
      }),
    ]);

    const errorResponse = responses.find((res) => !res.ok);
    if (errorResponse) {
      const error = (await errorResponse.json()) as {
        message: string;
        url: string;
      };
      return createCheckResult("Forgejo", false, error.message);
    }

    const [userResponse, reposResponse] = responses;
    const user = (await userResponse.json()) as { login: string };
    const totalRepos = parseInt(
      reposResponse.headers.get("x-total-count") ?? "0",
    );

    if (user && totalRepos > 0) {
      return createCheckResult(
        "Forgejo",
        true,
        `${user.login} has ${totalRepos} ${totalRepos === 1 ? "repository" : "repositories"}`,
      );
    }

    return createCheckResult(
      "Forgejo",
      false,
      "no repositories found for user",
    );
  } catch (error) {
    return createCheckResult(
      "Forgejo",
      false,
      getErrorMessage(error, "cannot list repositories"),
    );
  }
}
