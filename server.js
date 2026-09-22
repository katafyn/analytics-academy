const http=require('http');
const fs=require('fs');
const path=require('path');
const PORT=Number(process.env.PORT)||10000;
const ROOT=path.resolve(__dirname,'public');
const DB=path.resolve(__dirname,'data.json');
let db={};
try{db=JSON.parse(fs.readFileSync(DB,'utf8')||'{}')}catch{db={};}
function send(res,code,data,type='application/json'){
  res.writeHead(code,{'Content-Type':type,'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'});
  res.end(type.includes('json')?JSON.stringify(data):data);
}
function save(){fs.writeFileSync(DB,JSON.stringify(db,null,2));}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=http.createServer((req,res)=>{
  const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  if(req.method==='OPTIONS'){
    res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}); return res.end();
  }
  if(u.pathname==='/api/health') return send(res,200,{ok:true,app:'Analytics Academy',version:'6.0.0'});
  if(u.pathname==='/api/state'&&req.method==='GET') return send(res,200,db[u.searchParams.get('user')]||{});
  if(u.pathname==='/api/state'&&req.method==='POST'){
    let body=''; req.on('data',c=>body+=c); req.on('end',()=>{
      try{const x=JSON.parse(body); if(!x.user) return send(res,400,{ok:false}); db[x.user]=x.state||{}; save(); send(res,200,{ok:true});}
      catch{send(res,400,{ok:false});}
    }); return;
  }
  const rel=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.replace(/^\/+/,''));
  const file=path.resolve(ROOT,rel);
  if(file!==ROOT && !file.startsWith(ROOT+path.sep)) return send(res,403,'Forbidden','text/plain; charset=utf-8');
  fs.readFile(file,(err,data)=>{if(err)return send(res,404,'Not found','text/plain; charset=utf-8'); send(res,200,data,types[path.extname(file).toLowerCase()]||'application/octet-stream');});
});
server.listen(PORT,()=>console.log(`Analytics Academy v6 running on port ${PORT}`));
