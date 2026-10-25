const http=require('http'),fs=require('fs'),path=require('path');
const root=process.argv[2], port=+process.argv[3];
const T={'.html':'text/html; charset=utf-8','.mp3':'audio/mpeg','.xml':'application/xml','.js':'text/javascript'};
http.createServer((q,s)=>{
  let p=decodeURIComponent(q.url.split('?')[0]); if(p==='/')p='/index.html';
  const f=path.join(root,p); if(!f.startsWith(root)||!fs.existsSync(f)){s.writeHead(404);return s.end()}
  const st=fs.statSync(f), ty=T[path.extname(f)]||'application/octet-stream', r=q.headers.range;
  if(r){const m=/bytes=(\d*)-(\d*)/.exec(r);const a=m[1]?+m[1]:0,b=m[2]?+m[2]:st.size-1;
    s.writeHead(206,{'Content-Type':ty,'Content-Range':`bytes ${a}-${b}/${st.size}`,'Accept-Ranges':'bytes','Content-Length':b-a+1});
    if(q.method==='HEAD')return s.end(); return fs.createReadStream(f,{start:a,end:b}).pipe(s)}
  s.writeHead(200,{'Content-Type':ty,'Content-Length':st.size,'Accept-Ranges':'bytes'}); if(q.method==='HEAD')return s.end(); fs.createReadStream(f).pipe(s)
}).listen(port);
