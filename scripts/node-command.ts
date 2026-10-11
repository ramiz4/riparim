import {migrateNode} from '../lib/runtime/node-migrations';
import {processNotifications} from '../lib/notifications/outbox';

const action=process.argv[2];
if(action==='migrate')migrateNode(process.env.RIPARIM_DATA_DIR??'.riparim');
else if(action==='notifications'){
 // Await the durable outbox drain; schedule this command every five minutes.
 console.log(JSON.stringify(await processNotifications()));
}else throw new Error('Use migrate or notifications');
