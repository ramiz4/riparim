import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {localOpeningHoursSeedSql} from '../scripts/seed-local-opening-hours.mjs';

const db=new DatabaseSync(':memory:');
try{
 for(const file of (await readdir('drizzle')).filter(name=>name.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+file,'utf8'));
 const sql=await localOpeningHoursSeedSql();db.exec(sql);
 const source=JSON.parse(await readFile('data/opening-hours-import.json','utf8'));
 assert.equal(db.prepare('SELECT count(*) AS count FROM workshop_opening_hours_imports').get().count,source.records.length);
 const ahp=source.records.find(record=>record.id==='ahp-volkswagen-prizren');
 assert.deepEqual(JSON.parse(db.prepare('SELECT opening_hours FROM workshop_opening_hours_imports WHERE workshop_id=?').get(ahp.id).opening_hours),ahp.hours);
 const rows=source.records.slice(0,3),custom=JSON.stringify({week:Array.from({length:7},()=>({mode:'appointment'})),exceptions:[]});
 db.prepare("UPDATE workshops SET opening_hours=?,opening_hours_confirmed_at='2026-10-14',updated_at='2099-01-01T00:00:00Z' WHERE id=?").run(custom,rows[0].id);
 db.prepare('UPDATE workshop_opening_hours_imports SET suppressed=1 WHERE workshop_id=?').run(rows[1].id);
 db.prepare("UPDATE workshop_opening_hours_imports SET opening_hours=?,import_revision='local-edit' WHERE workshop_id=?").run(custom,rows[2].id);
 db.exec(sql);
 assert.equal(db.prepare('SELECT opening_hours FROM workshops WHERE id=?').get(rows[0].id).opening_hours,custom,'Restart preserves owner-confirmed hours');
 assert.equal(db.prepare('SELECT suppressed FROM workshop_opening_hours_imports WHERE workshop_id=?').get(rows[1].id).suppressed,1,'Restart preserves a suppressed default');
 assert.equal(db.prepare('SELECT opening_hours FROM workshop_opening_hours_imports WHERE workshop_id=?').get(rows[2].id).opening_hours,custom,'Restart preserves existing imported/local hours');
 assert.equal(db.prepare('SELECT count(*) AS count FROM visits').get().count,0,'Default seeding creates no customer or review data');
 console.log('Local hours seed: fresh catalogue/defaults, repeated startup, confirmed hours, suppressed/imported edits and no customer writes passed');
}finally{db.close();}
