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

export async function checkForgejoReachability(
  baseUrl: string,
): Promise<CheckResult> {
  try {
    const response = await fetchWithTimeout(baseUrl, { method: "GET" });
    if (response.ok || response.status === 200) {
      return createCheckResult("Forgejo reachability", true);
    }
    return createCheckResult(
      "Forgejo reachability",
      false,
      `HTTP ${response.status}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return createCheckResult("Forgejo reachability", false, message);
  }
}

export async function checkForgejoApiAuthentication(
  baseUrl: string,
  pat: string,
  colorize = false,
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
        "Invalid or expired token",
      );
    }

    if (!response.ok) {
      return createCheckResult(
        "Forgejo API token",
        false,
        `HTTP ${response.status}`,
      );
    }

    const user = (await response.json()) as { login: string };
    let login = user.login;
    if (colorize) {
      const { default: c } = await import("yoctocolors");
      login = c.green(user.login);
    }
    return createCheckResult(
      "Forgejo API token",
      true,
      `Authenticated as ${login}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return createCheckResult("Forgejo API token", false, message);
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

    if (!response.ok) {
      return createCheckResult("Repo access", false, `HTTP ${response.status}`);
    }

    const repos = (await response.json()) as { name: string }[];
    if (repos.length > 0) {
      return createCheckResult(
        "Repo access",
        true,
        `Found ${repos.length} repo(s)`,
      );
    }

    return createCheckResult(
      "Repo access",
      false,
      "No repos found (service account may not have repo access)",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return createCheckResult("Repo access", false, message);
  }
}
