import {MONITOR_REPOSITORY, validateMonitorState} from './backup-monitor-core.mjs';

export const MAX_MONITOR_STATE_BYTES = 128 * 1024;
const format = 'riparim-backup-monitor-state';
function shape(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) throw Error('Invalid monitor transfer shape.');
}
function validate(state, now) {
  validateMonitorState(state, now);
  shape(state, ['version', 'jobs']);
  for (const job of Object.values(state.jobs)) {
    shape(job, ['lastSuccessAt', 'generation', 'incident', 'pending'], ['queueStartedAt']);
    if (job.incident) shape(job.incident, ['generation', 'openedAt', 'backupAt', 'kind', 'recoveredAt', 'lastNotificationAt']);
    if (job.pending) {
      shape(job.pending, ['key', 'message', 'generation', 'createdAt', 'id']);
      shape(job.pending.message, ['job', 'status', 'lastSuccessAt', 'url']);
    }
  }
}
function bounded(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > MAX_MONITOR_STATE_BYTES) throw Error('Monitor transfer exceeds its size limit.');
}
export function encodeMonitorState(state, {now = Date.now()} = {}) {
  validate(state, now);
  const text = JSON.stringify({format, version: 1, repository: MONITOR_REPOSITORY, state});
  bounded(text);
  return text;
}
export function decodeMonitorState(text, {now = Date.now()} = {}) {
  bounded(text);
  let value;
  try {value = JSON.parse(text);} catch {throw Error('Invalid monitor transfer JSON.');}
  shape(value, ['format', 'version', 'repository', 'state']);
  if (value.format !== format || value.version !== 1 || value.repository !== MONITOR_REPOSITORY) throw Error('Foreign or incompatible monitor transfer.');
  validate(value.state, now);
  return value.state;
}
