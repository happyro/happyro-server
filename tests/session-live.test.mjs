import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import net from 'node:net';
const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
if (!args.includes('--run')) {
 console.log(`\n${color('1;36', 'HappyRO session integration test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/session-live.test.mjs --run')} [--no-color]\n\n${color('1;33', 'Requirements')}\n  Local Gateway :3338, login :6900, web service and happyro-mariadb container with the session schema.\n  Creates and removes only a dedicated test account.\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/session-live.test.mjs --run --no-color')}\n`);
 process.exit(0);
}
if (args.some(arg => !['--run', '--no-color'].includes(arg))) throw new Error('Unknown argument');
const token=()=>randomBytes(32).toString('hex');
function sql(query){return execFileSync('docker',['exec','-i','happyro-mariadb','sh','-c','MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb --batch --skip-column-names --user=root "$MARIADB_DATABASE"'],{input:query,encoding:'utf8'}).trim();}
const name=`sessioncheck${Date.now().toString().slice(-8)}`, web=token().slice(0,16);
let aid;
async function call(op,body,cookie){const r=await fetch(`http://127.0.0.1:3338/api/game-session/${op}`,{method:'POST',headers:{Origin:'http://127.0.0.1:3338','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});return {status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0],data:r.status===200?await r.json():null};}
async function create(persistent=false){sql(`UPDATE login SET web_auth_token='${web}',web_auth_token_enabled=1 WHERE account_id=${aid}`);const r=await call('create',{accountId:aid,webToken:web,persistent});assert.equal(r.status,200);return r;}
async function ticketLogin(ticket, raw=false){return new Promise((resolve,reject)=>{const s=net.createConnection(6900,'127.0.0.1');s.setTimeout(3000,()=>{s.destroy();reject(new Error('login timeout'));});s.on('error',reject);s.on('connect',()=>{const p=Buffer.alloc(91);p.writeUInt16LE(0x0d05);p.write(name,2,24);p.write(ticket,26,64);p[90]=1;s.write(p);});s.once('data',d=>{s.destroy();resolve(raw ? d : d.readUInt16LE(0));});});}
try {
 aid=Number(sql(`INSERT INTO login(userid,user_pass,sex,email) VALUES('${name}','test-only-password','M','test@localhost');SELECT LAST_INSERT_ID();`));
 let s=await create(true);assert(s.cookie&&!s.data.token);const old=s.cookie;
 let r=await call('resume',{},old);assert.equal(r.status,200);assert(r.data.ticket);
 assert.equal((await call('resume',{},old)).status,401,'rotated token rejected');
 assert.equal(await ticketLogin(r.data.ticket),0xac4,'one-use ticket accepted');
 assert.notEqual(await ticketLogin(r.data.ticket),0xac4,'ticket replay rejected');
 const activeWebToken=sql(`SELECT web_auth_token FROM login WHERE account_id=${aid}`);
 r=await call('resume',{},r.cookie);assert.equal(r.status,200);
 const busy=await ticketLogin(r.data.ticket,true);
 assert.equal(busy.readUInt16LE(0),0x83e);assert.equal(busy.readUInt32LE(2),8,'pending login must be preserved');
 assert.equal(sql(`SELECT web_auth_token FROM login WHERE account_id=${aid}`),activeWebToken,'busy auto-login must not rotate active account WebToken');
 assert.equal((await call('revoke',{},r.cookie)).status,204);
 assert.equal((await call('resume',{},r.cookie)).status,401);
 s=await create();assert(s.data.token);
 sql(`UPDATE login SET user_pass='changed-password' WHERE account_id=${aid};UPDATE login SET user_pass='test-only-password' WHERE account_id=${aid}`);
 assert.equal((await call('resume',{token:s.data.token})).status,401,'password change and revert still revoked');
 s=await create();sql(`UPDATE login SET state=5 WHERE account_id=${aid};UPDATE login SET state=0 WHERE account_id=${aid}`);
 assert.equal((await call('resume',{token:s.data.token})).status,401,'ban and unban still revoked');
 s=await create();sql(`UPDATE happyro_sessions SET expires=UNIX_TIMESTAMP()-1 WHERE account_id=${aid}`);
 assert.equal((await call('resume',{token:s.data.token})).status,401,'expired session rejected');
 console.log('PASS actual gateway + web + login + MariaDB: HTTP persistence, rotation, one-use ticket, replay rejection, occupied-account preservation, logout, password change, ban and expiry');
} finally {if(aid)sql(`DELETE FROM happyro_sessions WHERE account_id=${aid};DELETE FROM login WHERE account_id=${aid};`);}
