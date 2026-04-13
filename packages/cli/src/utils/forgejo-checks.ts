const TIMEOUT = 5000;

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
    if (error.message.includes("ENOTFOUND") || error.message.includes("getaddrinfo")) {
      return `${context}: host not found`;
    }
    return `${context}: ${error.message}`;
  }
  return `${context}: unknown error`;
}

export async function checkForgejoReachability(
  baseUrl: string,
): Promise<CheckResult> {
  try {
    const response = await fetchWithTimeout(baseUrl, { method: "GET" });
    if (response.ok) {
      return createCheckResult("Forgejo reachability", true, "connected");
    }
    return createCheckResult(
      "Forgejo reachability",
      false,
      `server returned ${response.status} ${response.statusText}`,
    );
  } catch (error) {
    return createCheckResult(
      "Forgejo reachability",
      false,
      getErrorMessage(error, "cannot reach server"),
    );
  }
}

export async function checkForgejoApiAuthentication(
  baseUrl: string,
  pat: string,
): Promise<CheckResult> {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/v1/user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${pat}`,
      },
    });

    if (response.status === 401) {
      return createCheckResult(
        "Forgejo API token",
        false,
        "token is invalid or expired",
      );
    }

    if (response.status === 403) {
      return createCheckResult(
        "Forgejo API token",
        false,
        "token lacks sufficient permissions",
      );
    }

    if (!response.ok) {
      return createCheckResult(
        "Forgejo API token",
        false,
        `server returned ${response.status}`,
      );
    }

    const user = (await response.json()) as { login: string };
    return createCheckResult(
      "Forgejo API token",
      true,
      `authenticated as ${user.login}`,
    );
  } catch (error) {
    return createCheckResult(
      "Forgejo API token",
      false,
      getErrorMessage(error, "cannot connect to API"),
    );
  }
}

export async function checkRepoAccess(
  baseUrl: string,
  pat: string,
  username: string,
): Promise<CheckResult> {
  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/api/v1/users/${username}/repos?limit=1`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${pat}`,
        },
      },
    );

    if (response.status === 401 || response.status === 403) {
      return createCheckResult(
        "Repo access",
        false,
        "token lacks permission to list repositories",
      );
    }

    if (!response.ok) {
      return createCheckResult(
        "Repo access",
        false,
        `server returned ${response.status}`,
      );
    }

    const repos = (await response.json()) as { name: string }[];
    if (repos.length > 0) {
      return createCheckResult(
        "Repo access",
        true,
        `found ${repos.length} repository`,
      );
    }

    return createCheckResult(
      "Repo access",
      false,
      "no repositories found for user",
    );
  } catch (error) {
    return createCheckResult(
      "Repo access",
      false,
      getErrorMessage(error, "cannot list repositories"),
    );
  }
}
