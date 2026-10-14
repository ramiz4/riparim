import { processNotifications } from "./outbox";
// Await the single attempt before returning; retries are only administrator actions.
export async function triggerNotifications(options: {
  id: string;
  manual?: boolean;
}) {
  return processNotifications(options);
}
