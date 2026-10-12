import {migrateNode} from '../lib/runtime/node-migrations';
import {processNotifications} from '../lib/notifications/outbox';

const action=process.argv[2];
if(action==='migrate')migrateNode(process.env.RIPARIM_DATA_DIR??'.riparim');
else if(action==='notifications'){
 // Explicit operator retry; no periodic service or queue drain.
 const id=process.argv[3];if(!id||!/^riparim-review-[a-z0-9-]+$/.test(id))throw Error("Provide the notification event ID");
 console.log(JSON.stringify(process.env.MIGRATION_READ_ONLY==='true'?{paused:true}:await processNotifications({id,manual:true})));
}else throw new Error('Use migrate or notifications');
