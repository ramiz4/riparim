import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { assertReleaseContext } from "./release-policy.mjs";

function positiveInteger(value, label) {
  if (
    !/^[1-9]\d*$/.test(String(value ?? "")) ||
    !Number.isSafeInteger(Number(value))
  )
    throw Error(`Missing or invalid ${label}.`);
  return Number(value);
}

function assertArtifact(
  metadata,
  { id, group, runId, repositoryId, sha, attempt },
) {
  const prefix = `${group}-${sha}-`;
  if (typeof metadata?.name !== "string" || !metadata.name.startsWith(prefix))
    throw Error(
      `The exact ${group} artifact has an unexpected target or source SHA.`,
    );
  const producerAttempt = positiveInteger(
    metadata.name.slice(prefix.length),
    "producer attempt",
  );
  if (
    metadata.id !== id ||
    metadata.expired !== false ||
    !Number.isSafeInteger(metadata.size_in_bytes) ||
    metadata.size_in_bytes <= 0 ||
    metadata.workflow_run?.id !== runId ||
    metadata.workflow_run?.repository_id !== repositoryId ||
    metadata.workflow_run?.head_repository_id !== repositoryId ||
    metadata.workflow_run?.head_branch !== "main" ||
    metadata.workflow_run?.head_sha !== sha ||
    producerAttempt > attempt
  )
    throw Error(
      `The exact ${group} artifact must belong to this main run and source, with a producer attempt no later than the consumer.`,
    );
  return producerAttempt;
}

export async function verifyCIArtifacts({
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  assertReleaseContext(env, env.GITHUB_SHA);
  const runId = positiveInteger(env.GITHUB_RUN_ID, "workflow run ID");
  const repositoryId = positiveInteger(
    env.GITHUB_REPOSITORY_ID,
    "repository ID",
  );
  const attempt = positiveInteger(env.GITHUB_RUN_ATTEMPT, "consumer attempt");
  const nodeId = positiveInteger(env.NODE_ARTIFACT_ID, "Node artifact ID");
  const workersId = positiveInteger(
    env.WORKERS_ARTIFACT_ID,
    "Worker artifact ID",
  );
  if (nodeId === workersId)
    throw Error("Node and Worker producer artifact IDs must be distinct.");
  if (!env.GITHUB_TOKEN)
    throw Error("Artifact validation requires an Actions read token.");
  const request = async (path) => {
    const response = await fetchImpl(
      `https://api.github.com/repos/ramiz4/riparim${path}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "X-GitHub-Api-Version": "2026-03-10",
        },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw Error(
        `Cannot validate producer metadata (HTTP ${response.status}).`,
      );
    return response.json();
  };
  const run = await request(`/actions/runs/${runId}`);
  if (
    run?.id !== runId ||
    run.head_sha !== env.GITHUB_SHA ||
    run.head_branch !== "main" ||
    run.event !== "push" ||
    run.run_attempt !== attempt ||
    run.path !== ".github/workflows/release.yml" ||
    run.repository?.id !== repositoryId ||
    run.repository?.full_name !== "ramiz4/riparim" ||
    run.head_repository?.id !== repositoryId ||
    run.head_repository?.full_name !== "ramiz4/riparim"
  )
    throw Error(
      "Artifact consumption requires this exact trusted main Release run.",
    );
  const [node, workers] = await Promise.all([
    request(`/actions/artifacts/${nodeId}`),
    request(`/actions/artifacts/${workersId}`),
  ]);
  const context = { runId, repositoryId, sha: env.GITHUB_SHA, attempt };
  // Successful job outputs select the immutable IDs. Earlier producers remain
  // valid during partial/release-only retries; never look up an artifact by name.
  return {
    ids: `${nodeId},${workersId}`,
    nodeAttempt: assertArtifact(node, {
      ...context,
      id: nodeId,
      group: "node",
    }),
    workersAttempt: assertArtifact(workers, {
      ...context,
      id: workersId,
      group: "workers",
    }),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = await verifyCIArtifacts();
  if (!process.env.GITHUB_OUTPUT)
    throw Error(
      "GitHub output path is required before downloading producer artifacts.",
    );
  await appendFile(process.env.GITHUB_OUTPUT, `artifact-ids=${result.ids}\n`);
  console.log(
    `Validated exact artifacts ${result.ids} from Node attempt ${result.nodeAttempt} and Worker attempt ${result.workersAttempt}.`,
  );
}
