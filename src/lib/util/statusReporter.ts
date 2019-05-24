import { getRefId } from "./getRefId";
import { updateStatus } from "../github/githubStatus";
import { Request } from "../../interfaces/Request";
import { StatusMessage } from "../../interfaces/Status";

export const statusReporter = async (
  req: Request,
  msg: string,
  status: StatusMessage["state"] = "pending"
) => {
  const body = req.body;
  const refId = getRefId(body);
  if (!refId) return;
  await updateStatus(body, { state: status, description: msg }, refId);
};