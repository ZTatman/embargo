export type VisibilityMode = "team" | "allowlist";

export interface RepoRef {
  owner: string;
  name: string;
}

export interface GrantSnapshot {
  repo: RepoRef;
  sourceBranch: string;
  commitSha: string;
}

