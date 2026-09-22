const http=require("http"),fs=require("fs"),path=require("path"),url=require("url");
const root=path.join(__dirname,"public"), db=path.join(__dirname,"data.json");
if(!fs.existsSync(db)) fs.writeFileSync(db,JSON.stringify({users:{}}));
function send(res,status,data,type="application/json"){res.writeHead(status,{"Content-Type":type,"Access-Control-Allow-Origin":"*"});res.end(type==="application/json"?JSON.stringify(data):data)}
const server=http.createServer((req,res)=>{
 const u=url.parse(req.url,true);
 if(req.method==="GET"&&u.pathname==="/api/health") return send(res,200,{ok:true,app:"Analytics Academy"});
 if(req.method==="GET"&&u.pathname==="/api/state"){let d=JSON.parse(fs.readFileSync(db));let id=u.query.user||"demo";return send(res,200,d.users[id]||{name:"Apalon",xp:70,done:[]})}
 if(req.method==="POST"&&u.pathname==="/api/state"){let body="";req.on("data",c=>body+=c);req.on("end",()=>{try{let x=JSON.parse(body),d=JSON.parse(fs.readFileSync(db));d.users[x.user||"demo"]=x.state;fs.writeFileSync(db,JSON.stringify(d,null,2));send(res,200,{ok:true})}catch(e){send(res,400,{ok:false,error:"Invalid JSON"})}});return}
 let file=u.pathname==="/"?"/index.html":u.pathname;let fp=path.normalize(path.join(root,file));if(!fp.startsWith(root))return send(res,403,"Forbidden","text/plain");
 fs.readFile(fp,(e,b)=>{if(e)return send(res,404,"Not found","text/plain");let ext=path.extname(fp);let types={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".json":"application/json"};send(res,200,b,types[ext]||"application/octet-stream")});
});
server.listen(process.env.PORT||3000,()=>console.log("Analytics Academy running on http://localhost:"+(process.env.PORT||3000)));
