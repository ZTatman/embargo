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
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/v1/user/repos`, {
      method: "GET",
      headers: {
        Authorization: `token ${pat}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      const result = (await response.json()) as { message: string };
      return createCheckResult("Forgejo", false, result.message);
    }

    if (!response.ok) {
      const result = (await response.json()) as {
        message: string;
        url: string;
      };
      return createCheckResult("Forgejo", false, result.message);
    }

    const repos = (await response.json()) as {
      name: string;
      owner: { login: string };
    }[];
    if (repos.length > 0) {
      const username = repos[0].owner.login;
      return createCheckResult(
        "Forgejo",
        true,
        `User ${username} has ${repos.length} ${repos.length === 1 ? "repository" : "repositories"}`,
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
