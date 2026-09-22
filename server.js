const http=require("http"),fs=require("fs"),path=require("path");
const PORT=process.env.PORT||10000, ROOT=path.join(__dirname,"public"), DB=path.join(__dirname,"data.json");
let db={}; try{db=JSON.parse(fs.readFileSync(DB,"utf8")||"{}")}catch(e){}
function send(res,code,data,type="application/json"){res.writeHead(code,{"Content-Type":type,"Access-Control-Allow-Origin":"*"});res.end(type.includes("json")?JSON.stringify(data):data)}
function save(){fs.writeFileSync(DB,JSON.stringify(db,null,2))}
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,`http://${req.headers.host}`);
  if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type"});return res.end()}
  if(u.pathname==="/api/health")return send(res,200,{ok:true,app:"Analytics Academy",version:"5.0.0"});
  if(u.pathname==="/api/state"&&req.method==="GET"){return send(res,200,db[u.searchParams.get("user")]||{})}
  if(u.pathname==="/api/state"&&req.method==="POST"){let body="";req.on("data",c=>body+=c);req.on("end",()=>{try{let x=JSON.parse(body);db[x.user]=x.state;save();send(res,200,{ok:true})}catch(e){send(res,400,{ok:false})}});return}
  let p=path.normalize(path.join(ROOT,u.pathname==="/"?"index.html":u.pathname));
  if(!p.startsWith(ROOT))return send(res,403,"Forbidden","text/plain");
  fs.readFile(p,(err,data)=>{if(err)return send(res,404,"Not found","text/plain");let ext=path.extname(p);let types={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".json":"application/json"};send(res,200,data,types[ext]||"application/octet-stream")});
});
server.listen(PORT,()=>console.log(`Analytics Academy v5 running on port ${PORT}`));
