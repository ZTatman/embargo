import { EMBARGO_DEFAULT_FORGEJO_PORT, EMBARGO_DEFAULT_SERVICE_PORT } from "@embargo/shared";

function main(): void {
  process.stdout.write(
    [
      "Embargo CLI bootstrap",
      `Forgejo default port: ${EMBARGO_DEFAULT_FORGEJO_PORT}`,
      `Service default port: ${EMBARGO_DEFAULT_SERVICE_PORT}`
    ].join("\n") + "\n"
  );
}

main();

