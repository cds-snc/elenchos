import { writeFile } from "../util/writeFile";
const { exec, spawnSync } = require("child_process");
const { promisify } = require("util");
export const execAsync = promisify(exec);
const DIR = process.env.CODE_DIR || "/tmp";

const writeKubeconfig = (sha: string, config: string): boolean => {
  const filePath = `${DIR}/${sha}/kubeconfig.yaml`;
  console.log(`✅ write kube config -> ${sha}`);
  return writeFile(filePath, config);
};

export const applyConfig = async (
  sha: string,
  overlayPath: string,
  config: string
): Promise<boolean> => {
  const result = writeKubeconfig(sha, config);

  if (!result) {
    console.warn("Could not edit kustomize file");
    return false;
  }

  console.log(`kustomize build > ${sha}.yaml`);

  await execAsync(`kustomize build > ${sha}.yaml`, {
    cwd: `${DIR}/${sha}/${overlayPath}`
  });

  console.log(`kustomize apply > ${sha}.yaml`);

  const kubectl = spawnSync("kubectl", [
    "apply",
    "--kubeconfig",
    `${DIR}/${sha}/kubeconfig.yaml`,
    "-f",
    `${DIR}/${sha}/${overlayPath}/${sha}.yaml`
  ]);

  if (kubectl.stderr && kubectl.stderr.toString()) {
    console.log("kubectl.stderr", kubectl.stderr.toString());
    return false;
  }

  return true;
};
