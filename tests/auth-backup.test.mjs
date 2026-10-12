import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=mkdtempSync(join(tmpdir(),'riparim-auth-backup-test-'));
try{
 const scripts=join(root,'scripts'),certs=join(scripts,'certs'),bin=join(root,'bin');
 mkdirSync(certs,{recursive:true});mkdirSync(bin);
 copyFileSync(new URL('../scripts/backup-supabase-auth.py',import.meta.url),join(scripts,'backup.py'));
 copyFileSync(new URL('../scripts/certs/supabase-prod-ca-2021.crt',import.meta.url),join(certs,'supabase-prod-ca-2021.crt'));
 const key=join(root,'private.pem'),cert=join(certs,'auth-backup-recipient.crt');
 assert.equal(spawnSync('openssl',['req','-x509','-newkey','rsa:3072','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=synthetic-backup']).status,0);
 writeFileSync(join(bin,'pg_dump'),`#!/usr/bin/env python3
import os,sys
if '--version' in sys.argv:
 print('pg_dump test');sys.exit(0)
assert os.environ['PGSSLMODE']=='verify-full'
assert 'default_transaction_read_only=on' in os.environ['PGOPTIONS']
assert os.environ['PGHOST']=='aws-0-eu-west-1.pooler.supabase.com'
if os.environ.get('FAIL_DUMP'):
 print('private-account-and-password',file=sys.stderr);sys.exit(1)
open(sys.argv[sys.argv.index('--file')+1],'wb').write(b'synthetic-auth-password-hash')
`,{mode:0o700});
 writeFileSync(join(bin,'pg_restore'),`#!/usr/bin/env python3
import os
if not os.environ.get('INCOMPLETE'):
 print('TABLE DATA auth users owner')
 print('TABLE DATA auth identities owner')
 print('TABLE DATA auth schema_migrations owner')
`,{mode:0o700});
 const opensslPath=existsSync('/opt/homebrew/opt/openssl@3/bin/openssl')?'/opt/homebrew/opt/openssl@3/bin:':'';
 const env={...process.env,PATH:`${bin}:${opensslPath}${process.env.PATH}`,PGPASSWORD:'synthetic-only'};
 const run=(name,extra={})=>spawnSync('python3',[join(scripts,'backup.py'),join(root,name)],{env:{...env,...extra},encoding:'utf8'});
 const success=run('success');assert.equal(success.status,0,success.stderr);
 const encrypted=join(root,'success/auth.dump.cms'),plain=join(root,'plain');
 assert.equal(spawnSync('openssl',['cms','-decrypt','-binary','-inform','DER','-in',encrypted,'-inkey',key,'-out',plain],{env}).status,0);
 assert.equal(readFileSync(plain,'utf8'),'synthetic-auth-password-hash');
 const bytes=readFileSync(encrypted);bytes[bytes.length-1]^=1;
 const corrupt=join(root,'corrupt');writeFileSync(corrupt,bytes);
 assert.notEqual(spawnSync('openssl',['cms','-decrypt','-binary','-inform','DER','-in',corrupt,'-inkey',key,'-out',plain],{env}).status,0);
 const failed=run('failed',{FAIL_DUMP:'1'});
 assert.notEqual(failed.status,0);assert(!failed.stderr.includes('private-account-and-password'));assert(!existsSync(join(root,'failed')));
 assert.notEqual(run('incomplete',{INCOMPLETE:'1'}).status,0);assert(!existsSync(join(root,'incomplete')));
 assert.notEqual(run('success').status,0);
 assert.notEqual(run('no-secret',{PGPASSWORD:''}).status,0);
 console.log('Auth backup: authenticated encryption, tamper rejection, complete archive, safe errors and no overwrite passed');
}finally{rmSync(root,{recursive:true,force:true});}
