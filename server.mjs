import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { createHash, randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const cfg = JSON.parse(await readFile(path.join(root, 'config.json'), 'utf8'))
const upstream = path.resolve(cfg.upstreamRoot)
const widgetPath = path.join(upstream, 'mcp', 'generated', 'cowart-widget.html')
const token = (await readFile(path.join(root,'bridge-token.txt'),'utf8')).trim()
const {McpClient} = await import('./mcp-client.mjs')
const rawMcp = new McpClient(upstream)
await rawMcp.start()
const {storageMcp}=await import('./storage-mcp.mjs')
const mcp=await storageMcp(rawMcp,cfg)
const {createCreationService}=await import('./creation-service.mjs');
const creation=await createCreationService({root,cfg,mcp});
const {verifyBinding,digest}=await import('./sync-capabilities.mjs');
const loadedRegistry=JSON.parse(await readFile(path.join(root,'model-capabilities.json'),'utf8'));
async function capabilityPreflight(){const b=await verifyBinding(path.join(root,'model-capabilities.json'),path.join(root,'capability-binding.local.json'));if(digest(loadedRegistry)!==b.sha256)throw Error('能力表已更新，请重启桥接服务');return b;}
const bridgeJs = await readFile(path.join(root,'widget-bridge.js'),'utf8')
process.on('exit',()=>mcp.close())
const allowedOrigins = new Set([`http://127.0.0.1:${cfg.port}`, `http://localhost:${cfg.port}`])
const allowedTools = new Set(['get_cowart_canvas_state','save_cowart_canvas_state','save_cowart_selection_state','save_cowart_view_state','save_cowart_reference_image','read_cowart_page_asset','download_cowart_file','copy_cowart_image_to_clipboard','insert_cowart_html_draft','save_cowart_canvas_state'])

function auth(req) {
  const origin = req.headers.origin
  return (!origin || allowedOrigins.has(origin)) && req.headers['x-cowart-bridge-token'] === token
}
function json(res, code, value) { const body = JSON.stringify(value); res.writeHead(code, {'content-type':'application/json','cache-control':'no-store'}); res.end(body) }
function wrapWidget(html) {
  const bridge = `<script>window.__COWART_HERMES_BRIDGE__=${JSON.stringify({apiVersion:1,token,canvasDir:cfg.canvasDir})};${bridgeJs}</script>`
  return html.replace('</head>', `${bridge}<script type="module" src="/creation-ui.mjs"></script></head>`)
}
const server = createServer(async (req, res) => {
  try {
    if(req.headers.host!==`127.0.0.1:${cfg.port}`)return json(res,403,{error:'host_denied'});
    const url=new URL(req.url,`http://127.0.0.1:${cfg.port}`);
    if (req.url === '/health') return json(res, 200, {ok:true, apiVersion:1, instanceId:cfg.instanceId});
    if (url.pathname === '/v1/shutdown' && cfg.instanceId && req.method === 'POST') {
      if(!auth(req))return json(res,403,{error:'forbidden'});
      json(res,200,{ok:true}); mcp.close(); server.close(); setTimeout(()=>process.exit(0),200); return;
    }
    if(['/creation-ui.mjs','/creation-core.mjs','/model-capabilities.json'].includes(url.pathname)&&req.method==='GET'){res.writeHead(200,{'content-type':url.pathname.endsWith('.json')?'application/json':'text/javascript','cache-control':'no-store'});return res.end(await readFile(path.join(root,url.pathname.slice(1)),'utf8'))}
    if(url.pathname.startsWith('/v2/')){
      if(!auth(req))return json(res,403,{error:'forbidden'});
      if(req.method==='GET'&&url.pathname==='/v2/state')return json(res,200,creation.getState());
      if(req.method==='GET'&&url.pathname.startsWith('/v2/jobs/')){const j=creation.getJob(url.pathname.split('/').pop());return json(res,j?200:404,j||{error:'not_found'})}
      if(req.method==='POST'&&url.pathname.match(/^\/v2\/jobs\/[^/]+\/submit$/)){const id=url.pathname.split('/')[3];let body='';for await(const part of req)body+=part;const data=body?JSON.parse(body):{};return json(res,200,await creation.markSubmitted(id,data.sessionId))}
      if(req.method==='POST'&&url.pathname.match(/^\/v2\/jobs\/[^/]+\/claim$/)){const id=url.pathname.split('/')[3];let body='';for await(const part of req)body+=part;return json(res,200,await creation.claim(id,JSON.parse(body))) }
      if(req.method==='POST'&&url.pathname.match(/^\/v2\/jobs\/[^/]+\/complete$/)){const id=url.pathname.split('/')[3];let body='';for await(const part of req)body+=part;return json(res,200,await creation.complete(id,JSON.parse(body))) }
      if(req.method==='POST'&&url.pathname.match(/^\/v2\/jobs\/[^/]+\/fail$/)){const id=url.pathname.split('/')[3];let body='';for await(const part of req)body+=part;return json(res,200,await creation.fail(id,JSON.parse(body||'{}'))) }
      if(req.method==='POST'&&['/v2/jobs','/v2/anchor'].includes(url.pathname)){let body='';for await(const part of req){body+=part;if(body.length>30*1024*1024)return json(res,413,{error:'too_large'})}try{const data=JSON.parse(body);if(url.pathname==='/v2/jobs')await capabilityPreflight();return json(res,200,await (url.pathname==='/v2/jobs'?creation.submit(data,{userInitiated:data.userInitiated===true&&data.approvalMode==="user_confirmed"}):creation.anchor(data)))}catch(e){return json(res,400,{error:'invalid_request',message:e.message})}}
      return json(res,404,{error:'not_found'});
    }
    if(url.pathname==='/v1/tool' && req.method==='POST'){
      if(!auth(req))return json(res,403,{error:'forbidden'});
      let body='';for await(const part of req){body+=part;if(body.length>30*1024*1024)return json(res,413,{error:'too_large'})}
      const data=JSON.parse(body);if(!allowedTools.has(data.name))return json(res,403,{error:'tool_denied'});
      const args={...data.arguments};delete args.projectDir;args.canvasDir=cfg.canvasDir;
      return json(res,200,await mcp.request('tools/call',{name:data.name,arguments:args}));
    }
    if (url.pathname === '/widget' && url.searchParams.get('token')===token && req.method==='GET') { res.writeHead(200, {'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer'}); return res.end(wrapWidget(await readFile(widgetPath, 'utf8'))) }
    if (req.url === '/bridge-info' && auth(req)) return json(res, 200, {apiVersion:1, token, allowedTools:[...allowedTools], canvasDir:cfg.canvasDir})
    return json(res, 404, {error:'not_found'})
  } catch (e) { return json(res, 500, {error:'internal_error', message:e.message}) }
})
server.listen(cfg.port, '127.0.0.1', () => console.log(JSON.stringify({ok:true, url:`http://127.0.0.1:${cfg.port}`, tokenLength:token.length, apiVersion:1})))
