const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const PORT=Number(process.env.PORT)||10000;
const ROOT=path.resolve(__dirname,'public');
const DB=path.resolve(__dirname,'data.json');
const SUPABASE_URL=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const SUPABASE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const USE_SUPABASE=Boolean(SUPABASE_URL&&SUPABASE_KEY);
const RATE=new Map();
function limited(req,key,limit=12,windowMs=600000){const now=Date.now(),ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim(),k=ip+'|'+key,arr=(RATE.get(k)||[]).filter(t=>now-t<windowMs);arr.push(now);RATE.set(k,arr);return arr.length>limit}
setInterval(()=>{const now=Date.now();for(const [k,a] of RATE){const b=a.filter(t=>now-t<600000);if(b.length)RATE.set(k,b);else RATE.delete(k)}},600000).unref();
let db={users:{},sessions:{},states:{}};
try{const raw=JSON.parse(fs.readFileSync(DB,'utf8')||'{}');db={...db,...raw}}catch{}
function save(){fs.writeFileSync(DB,JSON.stringify(db,null,2));}
function send(res,code,data,type='application/json',headers={}){res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store',...headers});res.end(type.includes('json')?JSON.stringify(data):data)}
function json(res,code,data,headers={}){send(res,code,data,'application/json; charset=utf-8',headers)}
function readBody(req){return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>2e6){reject(Object.assign(new Error('BODY_TOO_LARGE'),{status:413}));req.destroy()}});req.on('end',()=>{try{resolve(b?JSON.parse(b):{})}catch(e){reject(Object.assign(new Error('INVALID_JSON'),{status:400}))}});req.on('error',reject)})}
function cookieMap(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),decodeURIComponent(x.slice(i+1))]}))}
function setCookie(token){return `aa_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax${process.env.NODE_ENV==='production'?'; Secure':''}; Max-Age=604800`}
function clearCookie(){return 'aa_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'}
function hash(v){return crypto.createHash('sha256').update(v).digest('hex')}
function passwordHash(password){const salt=crypto.randomBytes(16).toString('hex');const key=crypto.scryptSync(password,salt,64).toString('hex');return `${salt}:${key}`}
function passwordCheck(password,stored){const [salt,key]=String(stored).split(':');if(!salt||!key)return false;const a=Buffer.from(key,'hex');const b=crypto.scryptSync(password,salt,64);return a.length===b.length&&crypto.timingSafeEqual(a,b)}
function token(){return crypto.randomBytes(32).toString('hex')}
function safeUser(u){return u?{id:u.id,email:u.email,name:u.name,created_at:u.created_at}:null}
async function sb(pathname,options={}){const r=await fetch(`${SUPABASE_URL}${pathname}`,{...options,headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json',...(options.headers||{})}});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{}if(!r.ok){const e=new Error(data?.message||data?.error||text||`Supabase ${r.status}`);e.status=r.status;throw e}return data}
async function createSession(userId){const raw=token(),record={id:crypto.randomUUID(),user_id:userId,token_hash:hash(raw),expires_at:new Date(Date.now()+7*864e5).toISOString()};if(USE_SUPABASE){await sb('/rest/v1/sessions',{method:'POST',body:JSON.stringify(record)});}else{db.sessions[record.token_hash]=record;save()}return raw}
async function currentUser(req){const raw=cookieMap(req).aa_session;if(!raw)return null;const th=hash(raw);if(USE_SUPABASE){const rows=await sb(`/rest/v1/sessions?token_hash=eq.${encodeURIComponent(th)}&select=user_id,expires_at&limit=1`);const s=rows?.[0];if(!s||new Date(s.expires_at)<=new Date())return null;const users=await sb(`/rest/v1/users?id=eq.${encodeURIComponent(s.user_id)}&select=id,email,name,created_at&limit=1`);return users?.[0]||null}const s=db.sessions[th];if(!s||new Date(s.expires_at)<=new Date())return null;return db.users[s.user_id]||null}
async function requireUser(req,res){try{const u=await currentUser(req);if(!u){json(res,401,{ok:false,error:'AUTH_REQUIRED'});return null}return u}catch(e){json(res,500,{ok:false,error:'AUTH_ERROR'});return null}}
async function getState(userId){if(USE_SUPABASE){const rows=await sb(`/rest/v1/progress?user_id=eq.${encodeURIComponent(userId)}&select=state&limit=1`);return rows?.[0]?.state||null}return db.states[userId]||null}
async function putState(userId,state){if(USE_SUPABASE){await sb('/rest/v1/progress',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({user_id:userId,state,updated_at:new Date().toISOString()})});return}db.states[userId]=state;save()}
async function createUser(email,name,password){const id=crypto.randomUUID(),u={id,email,name,password_hash:passwordHash(password),created_at:new Date().toISOString()};if(USE_SUPABASE){const existing=await sb(`/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id&limit=1`);if(existing?.length)throw Object.assign(new Error('EMAIL_EXISTS'),{status:409});await sb('/rest/v1/users',{method:'POST',body:JSON.stringify(u)});return u}if(Object.values(db.users).some(x=>x.email===email))throw Object.assign(new Error('EMAIL_EXISTS'),{status:409});db.users[id]=u;save();return u}
async function findUser(email){if(USE_SUPABASE){const rows=await sb(`/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,email,name,password_hash,created_at&limit=1`);return rows?.[0]||null}return Object.values(db.users).find(x=>x.email===email)||null}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end()}
  if(u.pathname==='/api/health')return json(res,200,{ok:true,app:'Analytics Academy',version:'10.0.0',accounts:true,storage:USE_SUPABASE?'supabase':'local-demo'});
  if(u.pathname==='/api/auth/register'&&req.method==='POST'){
   if(limited(req,'register',6))return json(res,429,{ok:false,error:'RATE_LIMITED'});
   const x=await readBody(req),email=String(x.email||'').trim().toLowerCase(),name=String(x.name||'').trim(),password=String(x.password||'');
   if(!/^\S+@\S+\.\S+$/.test(email))return json(res,400,{ok:false,error:'INVALID_EMAIL'});
   if(name.length<2||name.length>60)return json(res,400,{ok:false,error:'INVALID_NAME'});
   if(password.length<8)return json(res,400,{ok:false,error:'WEAK_PASSWORD'});
   const user=await createUser(email,name,password),session=await createSession(user.id);return json(res,201,{ok:true,user:safeUser(user)},{'Set-Cookie':setCookie(session)});
  }
  if(u.pathname==='/api/auth/login'&&req.method==='POST'){
   if(limited(req,'login',12))return json(res,429,{ok:false,error:'RATE_LIMITED'});
   const x=await readBody(req),email=String(x.email||'').trim().toLowerCase(),password=String(x.password||'');const user=await findUser(email);
   if(!user||!passwordCheck(password,user.password_hash))return json(res,401,{ok:false,error:'INVALID_CREDENTIALS'});
   const session=await createSession(user.id);return json(res,200,{ok:true,user:safeUser(user)},{'Set-Cookie':setCookie(session)});
  }
  if(u.pathname==='/api/auth/me'&&req.method==='GET'){const user=await currentUser(req);return json(res,200,{ok:true,user:safeUser(user)})}
  if(u.pathname==='/api/auth/logout'&&req.method==='POST'){const raw=cookieMap(req).aa_session;if(raw){const th=hash(raw);if(USE_SUPABASE){await sb(`/rest/v1/sessions?token_hash=eq.${encodeURIComponent(th)}`,{method:'DELETE'})}else{delete db.sessions[th];save()}}return json(res,200,{ok:true},{'Set-Cookie':clearCookie()})}
  if(u.pathname==='/api/state'&&req.method==='GET'){const user=await requireUser(req,res);if(!user)return;return json(res,200,{ok:true,state:await getState(user.id)})}
  if(u.pathname==='/api/state'&&req.method==='POST'){const user=await requireUser(req,res);if(!user)return;const x=await readBody(req);if(!x.state||typeof x.state!=='object'||JSON.stringify(x.state).length>1.5e6)return json(res,400,{ok:false,error:'INVALID_STATE'});await putState(user.id,x.state);return json(res,200,{ok:true})}
  const rel=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.replace(/^\/+/,''));const file=path.resolve(ROOT,rel);if(file!==ROOT&&!file.startsWith(ROOT+path.sep))return send(res,403,'Forbidden','text/plain; charset=utf-8');fs.readFile(file,(err,data)=>{if(err)return send(res,404,'Not found','text/plain; charset=utf-8');send(res,200,data,types[path.extname(file).toLowerCase()]||'application/octet-stream')});
 }catch(e){console.error(e);json(res,e.status||500,{ok:false,error:e.message||'SERVER_ERROR'})}
});
server.listen(PORT,()=>console.log(`Analytics Academy v10 running on port ${PORT}; accounts=${USE_SUPABASE?'supabase':'local-demo'}`));
