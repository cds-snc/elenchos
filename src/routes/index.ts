import express from "express";
import { close } from "../events/close";
import { getRelease } from "../db/queries";
import { dbConnect } from "../db/connect";
import { getRefId } from "../lib/util/getRefId";
import { getAction, isBeforePr } from "../lib/util/getAction";
import { returnStatus } from "../lib/util/returnStatus";
import { beforePr } from "../lib/cluster/checkCluster";
import { getVersion } from "../lib/util/getVersion";
import { handleEvent } from "../lib/util/handleEvent";
import { checkEnv } from "../lib/util/checkEnv";
import { Worker, isMainThread } from "worker_threads";
import { ClusterWorker } from "../interfaces/ClusterWorker";
import { Request } from "../interfaces/Request";
import { Release } from "../interfaces/Release";

let workers: ClusterWorker = {};

// terminate worker
const terminate = async (worker: Worker, refId: string): Promise<void> => {
  console.log(`terminate worker for refId: ${refId}`);
  worker.terminate((err: Error, code: number) => {
    console.log("index.ts => exit code", code);
    delete workers[refId];
  });
};
//  https://nodejs.org/api/worker_threads.html
export const setupWorker = (
  req: Request,
  refId: string,
  release: Release
): Worker => {
  // can init and send data
  console.log(`setup worker for refId ${refId}`);

  const w = new Worker("./worker.js", {
    workerData: { req, refId, release }
  });

  w.on("message", e => {
    terminate(w, refId);
  });

  return w;
};

const router = express.Router();

router.get("/favicon.ico", (req, res) => res.status(204));

router.post("/", async (req: Request, res) => {
  const body = req.body;

  // do we have a database connection?
  const db = await dbConnect();
  if (!db) {
    // @todo notify github
    let status = "database connection error 🛑";
    return returnStatus(body, res, { state: "error", description: status });
  }

  const action = getAction(req);
  const refId = getRefId(body);
  const eventInfo = handleEvent(req);
  const defaultMessage = "✅ event received";

  // do we have a refId?
  if (!refId) {
    let status = "no refId found 🛑";
    return returnStatus(body, res, { state: "error", description: status });
  }

  // check if we want to handle this type of event
  if (!eventInfo.handleEvent) {
    res.send(`✅ event ignored ${eventInfo.type}`);
    return;
  }

  console.log(`✅ version: ${getVersion()}`);
  console.log(`✅ event: ${eventInfo.type}  ✅ refId: ${refId} `);

  // ignore closing push
  if (body.after && body.after === "0000000000000000000000000000000000000000") {
    return returnStatus(body, res, {
      state: "success",
      description: "Closing push ignored"
    });
  }

  // handle closed event
  if (action === "closed") {
    await close(req);
    return returnStatus(body, res, {
      state: "success",
      description: "Branch review app removed"
    });
  }

  // handle events before a PR
  if (isBeforePr(req)) {
    await beforePr(req);
    res.send(defaultMessage);
    return;
  }

  // handle deploment
  let release = await getRelease({ refId });

  // hand off to Worker
  if (isMainThread && checkEnv()) {
    // stop existing worker + start a new worker
    if (refId && workers[refId]) {
      //@ts-ignore
      await terminate(workers[refId], refId);
    }

    //@ts-ignore
    workers[refId] = setupWorker({ body: req.body }, refId, release);
  }

  res.send(defaultMessage);
});

export default router;
