import { useState, useRef, useEffect } from 'react'

const getApiUrl = () =>
  localStorage.getItem('apiforge_backend_url') ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000'

// ── Design tokens ───────────────────────────────────────────────────────────
const C = {
  bg:'#ffffff', panel:'#f8f8fc', card:'#f0f0f8',
  border:'rgba(0,0,0,0.08)', pu:'#7c6af7', pu2:'#6055e0',
  green:'#16a34a', red:'#dc2626', amber:'#d97706', blue:'#2563eb',
  mono:"'JetBrains Mono',monospace", text:'#1a1a2e', muted:'#64748b',
}
const MC = {
  GET:    { bg:'rgba(22,163,74,0.1)',   border:'rgba(22,163,74,0.3)',   text:'#15803d' },
  POST:   { bg:'rgba(124,58,237,0.1)',  border:'rgba(124,58,237,0.3)',  text:'#7c3aed' },
  PUT:    { bg:'rgba(217,119,6,0.1)',   border:'rgba(217,119,6,0.3)',   text:'#b45309' },
  PATCH:  { bg:'rgba(37,99,235,0.1)',   border:'rgba(37,99,235,0.3)',   text:'#1d4ed8' },
  DELETE: { bg:'rgba(220,38,38,0.1)',   border:'rgba(220,38,38,0.3)',   text:'#b91c1c' },
  HEAD:   { bg:'rgba(100,116,139,0.1)', border:'rgba(100,116,139,0.3)', text:'#475569' },
  OPTIONS:{ bg:'rgba(236,72,153,0.1)',  border:'rgba(236,72,153,0.3)',  text:'#be185d' },
}
const METHODS = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']
const SC = (s) => !s?'#94a3b8':s<300?C.green:s<400?C.blue:s<500?C.amber:C.red
function uid() { return Math.random().toString(36).slice(2,10) }

// ── parseCurl ───────────────────────────────────────────────────────────────
function parseCurl(str) {
  str = str.replace(/\\\n/g,' ').replace(/\s+/g,' ').trim()
  const result = { method:'GET', url:'', headers:[], body:'' }
  const mx = str.match(/-X\s+([A-Z]+)/); if(mx) result.method=mx[1]
  const ux = str.match(/--url\s+['"]?([^\s'"]+)['"]?/) || str.match(/curl\s+(?:-[^\s]+\s+[^\s]+\s+)*['"]?([^\s'"]+)['"]?/)
  if(ux) result.url=ux[1].replace(/['"]/g,'')
  const hr = /-H\s+['"]([^'"]+)['"]/g; let m
  while((m=hr.exec(str))!==null){const[k,...v]=m[1].split(':');if(k)result.headers.push({id:uid(),key:k.trim(),value:v.join(':').trim(),enabled:true})}
  const bx = str.match(/(?:--data(?:-raw|-binary)?|-d)\s+['"]([^'"]+)['"]/)
  if(bx){result.body=bx[1];if(!mx)result.method='POST'}
  if(!result.headers.length) result.headers.push({id:uid(),key:'',value:'',enabled:true})
  return result
}

// ── importPostmanCollection ─────────────────────────────────────────────────
function importPostmanCollection(json) {
  const data = typeof json==='string'?JSON.parse(json):json
  const colName = data.info?.name||'Imported'
  const requests=[]
  const parseItem=(item)=>{
    if(item.item){item.item.forEach(parseItem);return}
    const req=item.request||{}
    const url=typeof req.url==='string'?req.url:req.url?.raw||''
    const headers=(req.header||[]).map(h=>({id:uid(),key:h.key||'',value:h.value||'',enabled:!h.disabled}))
    if(!headers.length) headers.push({id:uid(),key:'',value:'',enabled:true})
    const params=(req.url?.query||[]).map(q=>({id:uid(),key:q.key||'',value:q.value||'',enabled:!q.disabled}))
    if(!params.length) params.push({id:uid(),key:'',value:'',enabled:true})
    let body='',bodyType='none'
    if(req.body){bodyType=req.body.mode==='raw'?'json':req.body.mode||'none';body=req.body.raw||''}
    requests.push({id:uid(),name:item.name||'Request',method:req.method||'GET',url,headers,params,body,bodyType,auth:{type:'none',token:'',username:'',password:'',key:'',value:'',in:'header'}})
  }
  ;(data.item||[]).forEach(parseItem)
  const vars={}
  ;(data.variable||[]).forEach(v=>{if(v.key)vars[v.key]=v.value||''})
  return {name:colName,requests,vars}
}

function newReq(){return{id:uid(),name:'New Request',method:'GET',url:'',headers:[{id:uid(),key:'',value:'',enabled:true}],params:[{id:uid(),key:'',value:'',enabled:true}],body:'',bodyType:'json',auth:{type:'none',token:'',username:'',password:'',key:'',value:'',in:'header'}}}
function newCol(name='New Collection'){return{id:uid(),name,requests:[],vars:{}}}

// ── SmartUrlBar ─────────────────────────────────────────────────────────────
function SmartUrlBar({value,onChange,onSend,envVars,collectionVars,onUpdateCollectionVar}){
  const [popover,setPopover]=useState(null)
  const [popVal,setPopVal]=useState('')
  const inputRef=useRef(null)
  const varNames=[...new Set([...value.matchAll(/\{\{(\w+)\}\}/g)].map(m=>m[1]))]
  const resolve=(name)=>collectionVars?.[name]??envVars?.[name]??''
  const openPop=(name)=>{setPopover(name);setPopVal(collectionVars?.[name]??envVars?.[name]??'')}
  const savePop=()=>{if(popover)onUpdateCollectionVar(popover,popVal);setPopover(null)}

  const parts=[]
  let last=0
  for(const m of value.matchAll(/\{\{(\w+)\}\}/g)){
    if(m.index>last)parts.push({t:'txt',v:value.slice(last,m.index)})
    parts.push({t:'var',name:m[1],start:m.index})
    last=m.index+m[0].length
  }
  if(last<value.length)parts.push({t:'txt',v:value.slice(last)})

  return(
    <div style={{flex:1,position:'relative'}}>
      <input ref={inputRef} value={value}
        onChange={e=>onChange(e.target.value)}
        onKeyDown={e=>{if(e.key==='Enter')onSend()}}
        onPaste={e=>{const p=e.clipboardData.getData('text');if(p.trimStart().startsWith('curl')){e.preventDefault();try{const c=parseCurl(p);onChange(c.url)}catch(x){}}}}
        placeholder="https://api.example.com/...  or paste cURL"
        style={{width:'100%',background:'#fff',border:`1.5px solid ${C.border}`,borderRadius:8,padding:'10px 14px',fontSize:13,color:varNames.length?'transparent':'#1a1a2e',outline:'none',fontFamily:C.mono,boxSizing:'border-box',caretColor:'#1a1a2e'}}/>
      {varNames.length>0&&(
        <div style={{position:'absolute',inset:0,padding:'10px 14px',fontSize:13,fontFamily:C.mono,display:'flex',alignItems:'center',overflow:'hidden',pointerEvents:'none'}}>
          {parts.map((p,i)=>p.t==='txt'
            ?<span key={i} style={{color:'#1a1a2e',whiteSpace:'pre'}}>{p.v}</span>
            :<span key={i} onClick={e=>{e.stopPropagation();inputRef.current?.focus();openPop(p.name)}}
              style={{pointerEvents:'all',cursor:'pointer',borderRadius:4,padding:'1px 5px',
                background:resolve(p.name)?'rgba(22,163,74,0.12)':'rgba(220,38,38,0.1)',
                border:`1px solid ${resolve(p.name)?'rgba(22,163,74,0.35)':'rgba(220,38,38,0.3)'}`,
                color:resolve(p.name)?C.green:C.red,fontSize:12,fontWeight:600}}
              title={resolve(p.name)?`= ${resolve(p.name)}`:'Click to set value'}>
              {`{{${p.name}}}`}
            </span>
          )}
        </div>
      )}
      {popover&&(
        <div style={{position:'absolute',top:'calc(100% + 8px)',left:0,zIndex:300,background:'#fff',border:`1.5px solid ${C.border}`,borderRadius:10,padding:14,width:280,boxShadow:'0 8px 32px rgba(0,0,0,0.15)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontSize:12,fontWeight:700,color:C.pu2,fontFamily:C.mono}}>{`{{${popover}}}`}</span>
            <button onClick={()=>setPopover(null)} style={{background:'none',border:'none',color:'#94a3b8',cursor:'pointer',fontSize:14}}>✕</button>
          </div>
          <input autoFocus value={popVal} onChange={e=>setPopVal(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter')savePop();if(e.key==='Escape')setPopover(null)}}
            placeholder={`Value for ${popover}`}
            style={{width:'100%',background:'#f8f8fc',border:`1.5px solid ${C.border}`,borderRadius:7,padding:'8px 10px',fontSize:13,color:'#1a1a2e',outline:'none',fontFamily:C.mono,boxSizing:'border-box',marginBottom:8}}/>
          <div style={{display:'flex',gap:6}}>
            <button onClick={savePop} style={{flex:1,padding:'7px',borderRadius:7,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',border:'none',background:C.pu,color:'#fff'}}>Save</button>
            <button onClick={()=>setPopover(null)} style={{padding:'7px 12px',borderRadius:7,fontSize:12,cursor:'pointer',fontFamily:'inherit',border:`1px solid ${C.border}`,background:'none',color:'#64748b'}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── KeyValueEditor ──────────────────────────────────────────────────────────
function KeyValueEditor({rows,onChange,placeholder=['Key','Value']}){
  const upd=(id,f,v)=>onChange(rows.map(r=>r.id===id?{...r,[f]:v}:r))
  const add=()=>onChange([...rows,{id:uid(),key:'',value:'',enabled:true}])
  const rm=(id)=>onChange(rows.filter(r=>r.id!==id))
  const inp={background:'#fff',border:`1.5px solid ${C.border}`,borderRadius:7,padding:'7px 10px',fontSize:12,color:'#1a1a2e',outline:'none',fontFamily:C.mono}
  return(<div>
    {rows.map(r=>(
      <div key={r.id} style={{display:'flex',gap:6,marginBottom:5,alignItems:'center'}}>
        <input type="checkbox" checked={r.enabled} onChange={e=>upd(r.id,'enabled',e.target.checked)} style={{accentColor:C.pu,flexShrink:0}}/>
        <input value={r.key} onChange={e=>upd(r.id,'key',e.target.value)} placeholder={placeholder[0]} style={{...inp,flex:1}}/>
        <input value={r.value} onChange={e=>upd(r.id,'value',e.target.value)} placeholder={placeholder[1]} style={{...inp,flex:2}}/>
        <button onClick={()=>rm(r.id)} style={{width:24,height:24,border:'none',background:'rgba(220,38,38,0.08)',borderRadius:5,color:C.red,cursor:'pointer',fontSize:12}}>✕</button>
      </div>
    ))}
    <button onClick={add} style={{fontSize:11,color:'#94a3b8',background:'none',border:'none',cursor:'pointer',padding:'4px 0'}}>+ Add row</button>
  </div>)
}

// ── AuthEditor ──────────────────────────────────────────────────────────────
function AuthEditor({auth,onChange}){
  const set=(k,v)=>onChange({...auth,[k]:v})
  const btn=(t,label)=>({padding:'5px 12px',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',border:auth.type===t?`1.5px solid ${C.pu}`:`1px solid ${C.border}`,background:auth.type===t?'rgba(124,106,247,0.08)':'#fff',color:auth.type===t?C.pu:'#64748b'})
  const inp={background:'#fff',border:`1.5px solid ${C.border}`,borderRadius:8,padding:'9px 12px',fontSize:13,color:'#1a1a2e',outline:'none',fontFamily:C.mono,width:'100%',boxSizing:'border-box'}
  return(<div>
    <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
      {[['none','None'],['bearer','Bearer Token'],['basic','Basic Auth'],['apikey','API Key']].map(([t,label])=>(
        <button key={t} onClick={()=>set('type',t)} style={btn(t,label)}>{label}</button>
      ))}
    </div>
    {auth.type==='bearer'&&<input value={auth.token} onChange={e=>set('token',e.target.value)} placeholder="Bearer token" style={inp}/>}
    {auth.type==='basic'&&<div style={{display:'flex',gap:8}}><input value={auth.username} onChange={e=>set('username',e.target.value)} placeholder="Username" style={{...inp,flex:1}}/><input type="password" value={auth.password} onChange={e=>set('password',e.target.value)} placeholder="Password" style={{...inp,flex:1}}/></div>}
    {auth.type==='apikey'&&<div style={{display:'flex',gap:8,alignItems:'center'}}>
      <input value={auth.key} onChange={e=>set('key',e.target.value)} placeholder="Key" style={{...inp,flex:1}}/>
      <input value={auth.value} onChange={e=>set('value',e.target.value)} placeholder="Value" style={{...inp,flex:2}}/>
      <select value={auth.in} onChange={e=>set('in',e.target.value)} style={{background:'#fff',border:`1.5px solid ${C.border}`,borderRadius:8,padding:'9px 10px',fontSize:12,color:'#1a1a2e',outline:'none'}}>
        <option value="header">Header</option><option value="query">Query</option>
      </select>
    </div>}
  </div>)
}

// ── ResponseViewer ──────────────────────────────────────────────────────────
function CodeGen({req}){
  const[lang,setLang]=useState('fetch')
  const[code,setCode]=useState('')
  const[copied,setCopied]=useState(false)
  useEffect(()=>{
    if(!req)return
    fetch(`${getApiUrl()}/codegen`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...req,language:lang})})
      .then(r=>r.json()).then(d=>setCode(d.code)).catch(()=>setCode('// Backend not reachable'))
  },[lang,req])
  const copy=()=>{navigator.clipboard.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),2000)}
  const tab=(t)=>({padding:'4px 11px',borderRadius:5,fontSize:11,cursor:'pointer',fontFamily:'inherit',border:lang===t?`1.5px solid ${C.pu}`:`1px solid ${C.border}`,background:lang===t?'rgba(124,106,247,0.08)':'#fff',color:lang===t?C.pu:'#64748b'})
  return(<div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
    <div style={{display:'flex',gap:6,padding:'8px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0,alignItems:'center'}}>
      {['fetch','axios','curl','python'].map(l=><button key={l} onClick={()=>setLang(l)} style={tab(l)}>{l}</button>)}
      <button onClick={copy} style={{marginLeft:'auto',padding:'4px 11px',borderRadius:5,fontSize:11,cursor:'pointer',fontFamily:'inherit',border:`1px solid ${C.border}`,background:'#fff',color:copied?C.green:'#64748b'}}>{copied?'✓ Copied':'📋 Copy'}</button>
    </div>
    <pre style={{flex:1,margin:0,padding:16,overflowY:'auto',fontSize:12,fontFamily:C.mono,color:'#1a1a2e',lineHeight:1.7,whiteSpace:'pre-wrap',background:'#f8f8fc'}}>{code||'// Select a language'}</pre>
  </div>)
}

function ResponseViewer({response,loading,elapsed}){
  const[tab,setTab]=useState('body')
  const[view,setView]=useState('pretty')
  if(loading)return(<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
    <div style={{width:36,height:36,border:`3px solid rgba(124,106,247,0.2)`,borderTop:`3px solid ${C.pu}`,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
    <span style={{fontSize:12,color:'#94a3b8'}}>Sending…</span>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>)
  if(!response)return(<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8,color:'#cbd5e1'}}>
    <div style={{fontSize:44}}>⚡</div><p style={{fontSize:13,margin:0}}>Send a request to see the response</p>
  </div>)
  const sc=SC(response.status)
  let pretty=response.body;let isJson=false
  try{pretty=JSON.stringify(JSON.parse(response.body),null,2);isJson=true}catch{}
  const hdrs=Object.entries(response.headers||{})
  const tabBtn=(t,label)=>({padding:'5px 13px',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',border:tab===t?`1.5px solid ${C.pu}`:`1px solid ${C.border}`,background:tab===t?'rgba(124,106,247,0.08)':'#fff',color:tab===t?C.pu:'#64748b'})
  const viewBtn=(v)=>({padding:'3px 9px',borderRadius:5,fontSize:11,cursor:'pointer',fontFamily:'inherit',border:view===v?`1.5px solid ${C.pu}`:`1px solid ${C.border}`,background:view===v?'rgba(124,106,247,0.06)':'#fff',color:view===v?C.pu:'#64748b'})
  return(<div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
    <div style={{display:'flex',gap:14,alignItems:'center',padding:'9px 16px',borderBottom:`1px solid ${C.border}`,background:'#f8f8fc',flexShrink:0}}>
      <span style={{fontSize:13,fontWeight:700,color:sc,background:`${sc}15`,border:`1px solid ${sc}55`,borderRadius:6,padding:'3px 10px',fontFamily:C.mono}}>{response.status} {response.statusText}</span>
      <span style={{fontSize:12,color:'#94a3b8'}}>{elapsed}ms</span>
      <span style={{fontSize:12,color:'#94a3b8'}}>{response.size}</span>
      <div style={{marginLeft:'auto',display:'flex',gap:6}}>
        {[['body','Body'],['headers',`Headers (${hdrs.length})`],['cookies','Cookies'],['code','Code']].map(([t,label])=>(
          <button key={t} onClick={()=>setTab(t)} style={tabBtn(t,label)}>{label}</button>
        ))}
      </div>
    </div>
    {tab==='body'&&(<div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{display:'flex',gap:6,padding:'7px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0,alignItems:'center'}}>
        {['pretty','raw','preview'].map(v=><button key={v} onClick={()=>setView(v)} style={viewBtn(v)}>{v}</button>)}
        <button onClick={()=>navigator.clipboard.writeText(response.body)} style={{marginLeft:'auto',padding:'3px 9px',borderRadius:5,fontSize:11,cursor:'pointer',fontFamily:'inherit',border:`1px solid ${C.border}`,background:'#fff',color:'#64748b'}}>📋 Copy</button>
      </div>
      {view==='preview'?<iframe srcDoc={response.body} style={{flex:1,border:'none',background:'#fff'}}/>
        :<pre style={{flex:1,margin:0,padding:16,overflowY:'auto',fontSize:12,fontFamily:C.mono,color:'#1a1a2e',lineHeight:1.6,whiteSpace:'pre-wrap',background:'#f8f8fc'}}>{view==='pretty'?pretty:response.body}</pre>}
    </div>)}
    {tab==='headers'&&(<div style={{flex:1,overflowY:'auto',padding:16}}>
      {hdrs.map(([k,v])=>(<div key={k} style={{display:'flex',gap:12,padding:'6px 0',borderBottom:`1px solid ${C.border}`}}>
        <span style={{flex:1,fontSize:12,color:C.pu2,fontFamily:C.mono,fontWeight:600}}>{k}</span>
        <span style={{flex:2,fontSize:12,color:'#475569',fontFamily:C.mono,wordBreak:'break-all'}}>{v}</span>
      </div>))}
    </div>)}
    {tab==='cookies'&&(<div style={{flex:1,padding:16,fontSize:12,color:'#94a3b8'}}>
      {(response.cookies||[]).length===0?'No cookies':(response.cookies||[]).map((c,i)=><div key={i} style={{padding:'6px 0',borderBottom:`1px solid ${C.border}`,fontFamily:C.mono,color:'#475569'}}>{c}</div>)}
    </div>)}
    {tab==='code'&&<CodeGen req={response._req}/>}
  </div>)
}

// ── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({collections,activeId,onSelect,onNew,onNewCollection,onDeleteRequest,onRenameCollection,onDeleteCollection,onImport,onRun}){
  const[exp,setExp]=useState({})
  const[editCol,setEditCol]=useState(null)
  const[colName,setColName]=useState('')
  const tog=(id)=>setExp(e=>({...e,[id]:!e[id]}))
  return(<div style={{width:240,flexShrink:0,background:'#f8f8fc',borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
    <div style={{padding:'12px 14px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <span style={{fontSize:11,fontWeight:700,color:'#64748b',letterSpacing:'.5px',textTransform:'uppercase'}}>Collections</span>
      <div style={{display:'flex',gap:4}}>
        <button onClick={onImport} title="Import" style={{width:24,height:24,borderRadius:6,border:`1px solid ${C.border}`,background:'#fff',color:'#94a3b8',fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>↑</button>
        <button onClick={onNewCollection} title="New" style={{width:24,height:24,borderRadius:6,border:`1px solid ${C.border}`,background:'#fff',color:'#94a3b8',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
      </div>
    </div>
    <div style={{flex:1,overflowY:'auto'}}>
      {collections.length===0&&<div style={{padding:20,fontSize:12,color:'#cbd5e1',textAlign:'center'}}><div style={{fontSize:28,marginBottom:8}}>📁</div>No collections yet</div>}
      {collections.map(col=>(
        <div key={col.id}>
          <div style={{display:'flex',alignItems:'center',padding:'7px 10px 7px 14px',cursor:'pointer',borderBottom:`1px solid ${C.border}`}} onDoubleClick={()=>{setEditCol(col.id);setColName(col.name)}}>
            <span onClick={()=>tog(col.id)} style={{fontSize:10,color:'#94a3b8',marginRight:6,transform:exp[col.id]?'rotate(90deg)':'',display:'inline-block',transition:'transform .15s'}}>▶</span>
            {editCol===col.id
              ?<input autoFocus value={colName} onChange={e=>setColName(e.target.value)} onBlur={()=>{onRenameCollection(col.id,colName);setEditCol(null)}} onKeyDown={e=>{if(e.key==='Enter'){onRenameCollection(col.id,colName);setEditCol(null)}if(e.key==='Escape')setEditCol(null)}} style={{flex:1,background:'rgba(124,106,247,0.08)',border:`1.5px solid ${C.pu}`,borderRadius:4,padding:'2px 6px',fontSize:12,color:'#1a1a2e',outline:'none',fontFamily:'inherit'}}/>
              :<span onClick={()=>tog(col.id)} style={{flex:1,fontSize:12,fontWeight:600,color:'#1a1a2e',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{col.name}</span>
            }
            <div style={{display:'flex',gap:3}}>
              <button onClick={()=>onRun(col.id)} title="Run" style={{width:20,height:20,border:'none',background:'none',color:C.green,fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>▶</button>
              <button onClick={()=>onNew(col.id)} title="Add" style={{width:20,height:20,border:'none',background:'none',color:'#94a3b8',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
              <button onClick={()=>onDeleteCollection(col.id)} title="Delete" style={{width:20,height:20,border:'none',background:'none',color:'#94a3b8',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>🗑</button>
            </div>
          </div>
          {exp[col.id]&&col.requests.map(req=>{
            const mc=MC[req.method]||MC.GET
            const active=activeId===req.id
            return(<div key={req.id} onClick={()=>onSelect(req.id)} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px 6px 28px',cursor:'pointer',background:active?'rgba(124,106,247,0.08)':'transparent',borderLeft:active?`2.5px solid ${C.pu}`:'2.5px solid transparent'}}>
              <span style={{fontSize:9,fontWeight:700,color:mc.text,background:mc.bg,border:`1px solid ${mc.border}`,borderRadius:3,padding:'1px 4px',flexShrink:0,fontFamily:C.mono}}>{req.method}</span>
              <span style={{flex:1,fontSize:11,color:active?'#1a1a2e':'#64748b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{req.name}</span>
              <button onClick={e=>{e.stopPropagation();onDeleteRequest(col.id,req.id)}} style={{width:16,height:16,border:'none',background:'none',color:'#cbd5e1',fontSize:10,cursor:'pointer',borderRadius:3,flexShrink:0}} onMouseEnter={e=>e.currentTarget.style.color=C.red} onMouseLeave={e=>e.currentTarget.style.color='#cbd5e1'}>✕</button>
            </div>)
          })}
        </div>
      ))}
    </div>
    <div style={{padding:10,borderTop:`1px solid ${C.border}`}}>
      <button onClick={()=>onNew(collections[0]?.id)} style={{width:'100%',padding:'8px',borderRadius:8,border:`1.5px dashed ${C.border}`,background:'none',color:'#94a3b8',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>+ New Request</button>
    </div>
  </div>)
}

// ── RequestEditor ───────────────────────────────────────────────────────────
function RequestEditor({request,onUpdate,onSend,loading,envVars,collectionVars,onUpdateCollectionVar,onOpenCsvRunner}){
  const[tab,setTab]=useState('params')
  const mc=MC[request.method]||MC.GET
  const resolve=(s)=>s.replace(/\{\{(\w+)\}\}/g,(_,k)=>collectionVars?.[k]??envVars[k]??`{{${k}}}`)
  const urlWithParams=()=>{
    const en=(request.params||[]).filter(p=>p.enabled&&p.key)
    if(!en.length)return resolve(request.url)
    const qs=en.map(p=>`${encodeURIComponent(p.key)}=${encodeURIComponent(resolve(p.value))}`).join('&')
    const base=resolve(request.url)
    return`${base}${base.includes('?')?'&':'?'}${qs}`
  }
  const tabBtn=(t,label)=>({padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',border:tab===t?`1.5px solid ${C.pu}`:`1px solid ${C.border}`,background:tab===t?'rgba(124,106,247,0.08)':'#fff',color:tab===t?C.pu:'#64748b'})
  return(<div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
    <div style={{padding:'8px 16px 0',flexShrink:0}}>
      <input value={request.name} onChange={e=>onUpdate({...request,name:e.target.value})} style={{background:'none',border:'none',outline:'none',fontSize:16,fontWeight:600,color:'#1a1a2e',fontFamily:'inherit',width:'100%'}}/>
    </div>
    <div style={{display:'flex',gap:8,padding:'8px 16px',flexShrink:0}}>
      <select value={request.method} onChange={e=>onUpdate({...request,method:e.target.value})} style={{background:mc.bg,border:`1.5px solid ${mc.border}`,borderRadius:8,padding:'0 12px',fontSize:12,fontWeight:700,color:mc.text,cursor:'pointer',outline:'none',fontFamily:C.mono}}>
        {METHODS.map(m=><option key={m} value={m} style={{background:'#fff',color:'#1a1a2e'}}>{m}</option>)}
      </select>
      <SmartUrlBar value={request.url}
        onChange={url=>{
          if(url.trimStart?.().startsWith('curl')){try{const c=parseCurl(url);onUpdate({...request,method:c.method,url:c.url,headers:c.headers.length?c.headers:request.headers,body:c.body||request.body,bodyType:c.body?'json':request.bodyType});return}catch(x){}}
          onUpdate({...request,url})
        }}
        onSend={()=>onSend(urlWithParams())}
        envVars={envVars} collectionVars={collectionVars} onUpdateCollectionVar={onUpdateCollectionVar}/>
      <button onClick={()=>onSend(urlWithParams())} disabled={loading||!request.url.trim()} style={{padding:'10px 28px',borderRadius:8,fontSize:13,fontWeight:700,cursor:loading||!request.url.trim()?'not-allowed':'pointer',fontFamily:'inherit',border:'none',background:loading||!request.url.trim()?'rgba(124,106,247,0.3)':C.pu,color:'#fff',flexShrink:0}}>
        {loading?'⏳':'Send'}
      </button>
      <button onClick={onOpenCsvRunner} title="Run with CSV data" style={{padding:'10px 14px',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',border:`1.5px solid ${C.border}`,background:'#f8f8fc',color:'#64748b',flexShrink:0}}>
        📊 CSV Run
      </button>
    </div>
    <div style={{display:'flex',gap:6,padding:'4px 16px 10px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
      {['params','headers','body','auth'].map(t=><button key={t} onClick={()=>setTab(t)} style={tabBtn(t,t.charAt(0).toUpperCase()+t.slice(1))}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}
    </div>
    <div style={{flex:1,overflow:'auto',padding:16}}>
      {tab==='params'&&<KeyValueEditor rows={request.params} onChange={p=>onUpdate({...request,params:p})}/>}
      {tab==='headers'&&<KeyValueEditor rows={request.headers} onChange={h=>onUpdate({...request,headers:h})}/>}
      {tab==='auth'&&<AuthEditor auth={request.auth} onChange={a=>onUpdate({...request,auth:a})}/>}
      {tab==='body'&&(<div>
        <div style={{display:'flex',gap:6,marginBottom:12}}>
          {['json','form','raw','none'].map(t=><button key={t} onClick={()=>onUpdate({...request,bodyType:t})} style={{padding:'4px 12px',borderRadius:5,fontSize:11,cursor:'pointer',fontFamily:'inherit',textTransform:'uppercase',border:request.bodyType===t?`1.5px solid ${C.pu}`:`1px solid ${C.border}`,background:request.bodyType===t?'rgba(124,106,247,0.08)':'#fff',color:request.bodyType===t?C.pu:'#64748b'}}>{t}</button>)}
        </div>
        {request.bodyType!=='none'&&request.bodyType!=='form'&&<textarea value={request.body} onChange={e=>onUpdate({...request,body:e.target.value})} placeholder={request.bodyType==='json'?'{\n  "key": "value"\n}':'Request body'} style={{width:'100%',minHeight:200,background:'#f8f8fc',border:`1.5px solid ${C.border}`,borderRadius:8,padding:12,fontSize:12,color:'#1a1a2e',outline:'none',fontFamily:C.mono,resize:'vertical',boxSizing:'border-box',lineHeight:1.6}}/>}
        {request.bodyType==='form'&&<KeyValueEditor rows={request.params} onChange={p=>onUpdate({...request,params:p})} placeholder={['Field','Value']}/>}
      </div>)}
    </div>
  </div>)
}

// ── EnvPanel ────────────────────────────────────────────────────────────────
function EnvPanel({envs,active,onSetActive,onUpdate,onAdd,onDelete}){
  const ae=envs.find(e=>e.id===active)
  return(<div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.3)',display:'flex',alignItems:'center',justifyContent:'center'}}>
    <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,width:700,maxHeight:'80vh',display:'flex',overflow:'hidden',boxShadow:'0 8px 40px rgba(0,0,0,0.15)'}}>
      <div style={{width:200,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column'}}>
        <div style={{padding:'12px 14px',borderBottom:`1px solid ${C.border}`,fontSize:12,fontWeight:700,color:'#1a1a2e'}}>Environments</div>
        <div style={{flex:1,overflowY:'auto'}}>
          {envs.map(e=>(<div key={e.id} onClick={()=>onSetActive(e.id)} style={{padding:'9px 14px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',background:active===e.id?'rgba(124,106,247,0.08)':'transparent',borderLeft:active===e.id?`2.5px solid ${C.pu}`:'2.5px solid transparent'}}>
            <span style={{fontSize:12,color:active===e.id?'#1a1a2e':'#64748b'}}>{e.name}</span>
            <button onClick={ev=>{ev.stopPropagation();onDelete(e.id)}} style={{background:'none',border:'none',color:'#cbd5e1',cursor:'pointer',fontSize:11}}>✕</button>
          </div>))}
        </div>
        <div style={{padding:10}}><button onClick={onAdd} style={{width:'100%',padding:'7px',borderRadius:7,border:`1.5px dashed ${C.border}`,background:'none',color:'#94a3b8',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>+ New Environment</button></div>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column'}}>
        <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,fontSize:12,fontWeight:700,color:'#1a1a2e'}}>{ae?ae.name:'Select an environment'}</div>
        {ae&&<div style={{flex:1,overflowY:'auto',padding:16}}><KeyValueEditor rows={ae.vars} onChange={v=>onUpdate(active,v)} placeholder={['Variable','Value']}/></div>}
      </div>
    </div>
  </div>)
}

// ── HistoryPanel ─────────────────────────────────────────────────────────────
function HistoryPanel({history,onSelect,onClear,onClose}){
  return(<div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.3)',display:'flex',alignItems:'flex-end',justifyContent:'flex-end'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div style={{width:380,height:'100vh',background:'#fff',borderLeft:`1px solid ${C.border}`,display:'flex',flexDirection:'column',boxShadow:'-4px 0 20px rgba(0,0,0,0.08)'}}>
      <div style={{padding:'14px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:13,fontWeight:700,color:'#1a1a2e'}}>History</span>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {history.length>0&&<button onClick={onClear} style={{fontSize:11,color:C.red,background:'rgba(220,38,38,0.06)',border:'1px solid rgba(220,38,38,0.2)',borderRadius:6,padding:'3px 10px',cursor:'pointer',fontFamily:'inherit'}}>Clear all</button>}
          <button onClick={onClose} style={{background:'none',border:'none',color:'#94a3b8',cursor:'pointer',fontSize:16}}>✕</button>
        </div>
      </div>
      {history.length===0
        ? <div style={{padding:40,fontSize:12,color:'#cbd5e1',textAlign:'center'}}><div style={{fontSize:32,marginBottom:8}}>🕐</div>No history yet</div>
        : <div style={{flex:1,overflowY:'auto'}}>
            {history.map((h,i)=>{
              const mc=MC[h.method]||MC.GET
              const sc=SC(h.status)
              return(
                <div key={i} onClick={()=>{onSelect(h);onClose()}} style={{padding:'10px 16px',borderBottom:`1px solid ${C.border}`,cursor:'pointer',transition:'background .1s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#f8f8fc'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:4}}>
                    <span style={{fontSize:9,fontWeight:700,color:mc.text,background:mc.bg,border:`1px solid ${mc.border}`,borderRadius:3,padding:'1px 4px',fontFamily:C.mono}}>{h.method}</span>
                    {h.status&&<span style={{fontSize:10,fontWeight:700,color:sc,fontFamily:C.mono}}>{h.status}</span>}
                    <span style={{fontSize:10,color:'#cbd5e1',marginLeft:'auto'}}>{h.time}</span>
                  </div>
                  <div style={{fontSize:11,color:'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:C.mono,marginBottom:3}}>{h.url}</div>
                  <div style={{fontSize:10,color:C.pu}}>Click to load →</div>
                </div>
              )
            })}
          </div>
      }
    </div>
  </div>)
}

// ── parseCSV — parse CSV string into array of {col:val} objects ──────────────
function parseCSV(text){
  const lines=text.trim().split(/\r?\n/).filter(Boolean)
  if(lines.length<2)return[]
  const headers=lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,''))
  return lines.slice(1).map(line=>{
    const vals=line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g)||[]
    const row={}
    headers.forEach((h,i)=>{row[h]=(vals[i]||'').trim().replace(/^"|"$/g,'')})
    return row
  })
}


// ── SingleRequestRunner ────────────────────────────────────────────────────
function SingleRequestRunner({request,envVars,collectionVars,onClose}){
  const[csvRows,setCsvRows]=useState([])
  const[csvHeaders,setCsvHeaders]=useState([])
  const[csvFile,setCsvFile]=useState(null)
  const[running,setRunning]=useState(false)
  const[results,setResults]=useState([])
  const[delay,setDelay]=useState(0)
  const abortRef=useRef(false)
  const csvRef=useRef(null)

  // Detect vars in this request
  const allText=[request.url,request.body||'',...(request.headers||[]).map(h=>h.key+' '+h.value),...(request.params||[]).map(p=>p.key+' '+p.value)].join(' ')
  const apiVars=[...new Set([...allText.matchAll(/\{\{(\w+)\}\}/g)].map(m=>m[1]))]

  const resolve=(s,rowVars)=>s.replace(/\{\{(\w+)\}\}/g,(_,k)=>rowVars[k]??collectionVars[k]??envVars[k]??`{{${k}}}`)

  const handleCSV=(e)=>{
    const file=e.target.files?.[0];if(!file)return
    setCsvFile(file.name)
    const reader=new FileReader()
    reader.onload=(ev)=>{const rows=parseCSV(ev.target.result);setCsvRows(rows);setCsvHeaders(rows.length?Object.keys(rows[0]):[]) }
    reader.readAsText(file);e.target.value=''
  }

  const runAll=async()=>{
    setRunning(true);setResults([]);abortRef.current=false
    const rows=csvRows.length>0?csvRows:[{}]
    const all=[]
    for(let i=0;i<rows.length;i++){
      if(abortRef.current)break
      const rowVars=rows[i]
      const t0=Date.now()
      let status=0,statusText='',passed=false,error=null,body=''
      try{
        let url=resolve(request.url,rowVars)
        const en=(request.params||[]).filter(p=>p.enabled&&p.key)
        if(en.length){const qs=en.map(p=>`${encodeURIComponent(p.key)}=${encodeURIComponent(resolve(p.value,rowVars))}`).join('&');url=url+(url.includes('?')?'&':'?')+qs}
        const hdrs={}
        ;(request.headers||[]).filter(h=>h.enabled&&h.key).forEach(h=>{hdrs[h.key]=resolve(h.value,rowVars)})
        const auth=request.auth||{}
        if(auth.type==='bearer'&&auth.token)hdrs['Authorization']='Bearer '+resolve(auth.token,rowVars)
        if(auth.type==='basic'&&auth.username)hdrs['Authorization']='Basic '+btoa(auth.username+':'+auth.password)
        if(auth.type==='apikey'&&auth.key&&auth.in==='header')hdrs[auth.key]=auth.value
        let reqBody=undefined
        if(!['GET','HEAD'].includes(request.method)&&request.bodyType!=='none'&&request.body){hdrs['Content-Type']='application/json';reqBody=resolve(request.body,rowVars)}
        const r=await fetch(getApiUrl()+'/proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,method:request.method,headers:hdrs,body:reqBody})})
        const d=await r.json()
        status=d.status;statusText=d.status_text;body=d.body
        passed=status>=200&&status<300
      }catch(e){error=e.message;passed=false}
      all.push({row:i+1,rowVars,status,statusText,passed,error,elapsed:Date.now()-t0,body})
      setResults([...all])
      if(delay>0&&i<rows.length-1)await new Promise(r=>setTimeout(r,delay))
    }
    setRunning(false)
  }

  const mc=MC[request.method]||MC.GET
  const passed=results.filter(r=>r.passed).length
  const failed=results.filter(r=>!r.passed).length

  return(<div style={{position:'fixed',inset:0,zIndex:250,background:'rgba(0,0,0,0.3)',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget&&!running)onClose()}}>
    <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,width:'min(860px,95vw)',maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 8px 40px rgba(0,0,0,0.12)'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:9,fontWeight:700,color:mc.text,background:mc.bg,border:`1px solid ${mc.border}`,borderRadius:4,padding:'2px 7px',fontFamily:C.mono}}>{request.method}</span>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:'#1a1a2e'}}>{request.name}</div>
            <div style={{fontSize:11,color:'#94a3b8',fontFamily:C.mono,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:400}}>{request.url}</div>
          </div>
        </div>
        {!running&&<button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:`1px solid ${C.border}`,background:'#f8f8fc',color:'#94a3b8',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>}
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* Left config */}
        <div style={{width:240,borderRight:`1px solid ${C.border}`,padding:16,display:'flex',flexDirection:'column',gap:14,flexShrink:0,overflowY:'auto'}}>

          {/* Vars found */}
          <div>
            <div style={{fontSize:11,color:'#94a3b8',fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>Vars in request</div>
            {apiVars.length===0
              ?<div style={{fontSize:11,color:'#cbd5e1'}}>No {'{{vars}}'} found</div>
              :apiVars.map(v=><span key={v} style={{display:'inline-block',fontFamily:C.mono,fontSize:11,color:C.pu,background:'rgba(124,106,247,0.08)',border:'1px solid rgba(124,106,247,0.2)',borderRadius:4,padding:'2px 7px',marginRight:4,marginBottom:4}}>{'{{'+v+'}}'}</span>)
            }
          </div>

          {/* CSV upload */}
          <div>
            <div style={{fontSize:11,color:'#94a3b8',fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>CSV Data File</div>
            <input ref={csvRef} type="file" accept=".csv" style={{display:'none'}} onChange={handleCSV}/>
            <button onClick={()=>csvRef.current?.click()} style={{width:'100%',padding:'8px 10px',borderRadius:7,border:'1.5px dashed '+C.border,background:csvFile?'rgba(124,106,247,0.04)':'#f8f8fc',color:csvFile?C.pu:'#94a3b8',fontSize:11,cursor:'pointer',fontFamily:'inherit',textAlign:'left',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {csvFile?'📄 '+csvFile:'↑ Upload CSV'}
            </button>
            {csvHeaders.length>0&&(
              <div style={{marginTop:8,padding:'7px 9px',background:'#f8f8fc',border:`1px solid ${C.border}`,borderRadius:7}}>
                <div style={{fontSize:10,fontWeight:700,color:'#64748b',marginBottom:5}}>Column mapping:</div>
                {apiVars.map(v=>{const ok=csvHeaders.includes(v);return(
                  <div key={v} style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                    <span style={{fontFamily:C.mono,fontSize:10,color:C.pu}}>{'{{'+v+'}}'}</span>
                    <span style={{fontSize:10,color:'#94a3b8'}}>→</span>
                    {ok?<span style={{fontSize:10,color:C.green,fontFamily:C.mono}}>✓ {v}</span>:<span style={{fontSize:10,color:C.red}}>⚠ missing</span>}
                  </div>
                )})}
                <div style={{fontSize:10,color:'#94a3b8',marginTop:4}}>{csvRows.length} rows loaded</div>
              </div>
            )}
            {csvFile&&<button onClick={()=>{setCsvFile(null);setCsvRows([]);setCsvHeaders([])}} style={{marginTop:4,fontSize:10,color:'#94a3b8',background:'none',border:'none',cursor:'pointer',padding:0}}>✕ Remove</button>}
          </div>

          {/* Delay */}
          <div>
            <label style={{fontSize:11,color:'#94a3b8',fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:6}}>Delay (ms)</label>
            <input type="number" min={0} max={10000} value={delay} onChange={e=>setDelay(Number(e.target.value))} style={{width:'100%',background:'#f8f8fc',border:'1.5px solid '+C.border,borderRadius:7,padding:'7px 10px',fontSize:13,color:'#1a1a2e',outline:'none',fontFamily:C.mono,boxSizing:'border-box'}}/>
          </div>

          <div style={{marginTop:'auto',display:'flex',flexDirection:'column',gap:6}}>
            <div style={{fontSize:11,color:'#94a3b8',textAlign:'center'}}>{csvRows.length>0?csvRows.length+' iterations from CSV':'Single run'}</div>
            {!running
              ?<button onClick={runAll} style={{width:'100%',padding:'10px',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',border:'none',background:C.green,color:'#fff'}}>▶ Run</button>
              :<button onClick={()=>abortRef.current=true} style={{width:'100%',padding:'10px',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',border:'none',background:C.red,color:'#fff'}}>⏹ Stop</button>
            }
          </div>
        </div>

        {/* Results */}
        <div style={{flex:1,overflowY:'auto',padding:16}}>
          {results.length>0&&(
            <div style={{display:'flex',gap:10,marginBottom:14,padding:'9px 14px',background:'#f8f8fc',border:`1px solid ${C.border}`,borderRadius:10,alignItems:'center'}}>
              {[['Total',results.length,'#1a1a2e'],['Passed',passed,C.green],['Failed',failed,C.red]].map(([l,v,c])=>(
                <div key={l} style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{fontSize:11,color:'#94a3b8',fontWeight:600}}>{l}</span>
                  <span style={{fontSize:13,fontWeight:700,color:c,background:`${c}18`,borderRadius:5,padding:'2px 8px',fontFamily:C.mono}}>{v}</span>
                </div>
              ))}
              {running&&<span style={{marginLeft:'auto',fontSize:11,color:'#94a3b8'}}>Running {results.length}/{csvRows.length||1}…</span>}
            </div>
          )}
          {results.length===0&&!running&&<div style={{textAlign:'center',padding:40,color:'#cbd5e1'}}><div style={{fontSize:40,marginBottom:12}}>▶</div><p style={{fontSize:13}}>{csvRows.length>0?'Click Run to send '+csvRows.length+' requests':'Click Run to send request'}</p></div>}
          <table style={{width:'100%',borderCollapse:'collapse',display:results.length?'table':'none'}}>
            <thead><tr style={{background:'#f8f8fc'}}>
              {['Row','Vars','Status','Result','Time'].map(h=><th key={h} style={{padding:'7px 12px',textAlign:'left',fontSize:11,color:'#94a3b8',fontWeight:600,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {results.map((r,i)=>{
                const sc=SC(r.status)
                return(
                  <tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:'8px 12px',fontSize:12,color:'#1a1a2e',fontFamily:C.mono}}>{r.row}</td>
                    <td style={{padding:'8px 12px'}}>
                      <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                        {Object.entries(r.rowVars||{}).map(([k,v])=>(
                          <span key={k} style={{fontSize:10,fontFamily:C.mono,background:'rgba(124,106,247,0.08)',border:'1px solid rgba(124,106,247,0.15)',borderRadius:3,padding:'1px 5px',color:C.pu}}>{k}=<b>{v}</b></span>
                        ))}
                        {Object.keys(r.rowVars||{}).length===0&&<span style={{fontSize:10,color:'#cbd5e1'}}>—</span>}
                      </div>
                    </td>
                    <td style={{padding:'8px 12px'}}>
                      {r.status>0
                        ? <span style={{fontSize:11,fontWeight:700,color:sc,background:`${sc}18`,border:`1px solid ${sc}55`,borderRadius:5,padding:'2px 8px',fontFamily:C.mono}}>{r.status} {r.statusText}</span>
                        : <span style={{color:C.red,fontSize:11}}>—</span>}
                    </td>
                    <td style={{padding:'8px 12px'}}>
                      {r.error
                        ? <span style={{fontSize:11,fontWeight:700,color:C.red,background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.25)',borderRadius:5,padding:'3px 9px'}}>✗ Error</span>
                        : r.passed
                          ? <span style={{fontSize:11,fontWeight:700,color:C.green,background:'rgba(22,163,74,0.1)',border:'1px solid rgba(22,163,74,0.25)',borderRadius:5,padding:'3px 9px'}}>✓ Passed</span>
                          : <span style={{fontSize:11,fontWeight:700,color:C.red,background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.25)',borderRadius:5,padding:'3px 9px'}}>✗ Failed</span>}
                    </td>
                    <td style={{padding:'8px 12px',fontSize:11,color:'#94a3b8',fontFamily:C.mono}}>{r.elapsed}ms</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>)
}

// ── CollectionRunner ─────────────────────────────────────────────────────────
function CollectionRunner({collection,envVars,onClose}){
  const[iterations,setIterations]=useState(1)
  const[delay,setDelay]=useState(0)
  const[running,setRunning]=useState(false)
  const[results,setResults]=useState([])
  const[current,setCurrent]=useState(null)
  const[csvRows,setCsvRows]=useState([])     // parsed CSV data rows
  const[csvHeaders,setCsvHeaders]=useState([]) // CSV column names
  const[csvFile,setCsvFile]=useState(null)
  const abortRef=useRef(false)
  const csvRef=useRef(null)
  const colVars=collection.vars||{}
  const[selectedReqs,setSelectedReqs]=useState(()=>new Set(collection.requests.map(r=>r.id)))

  // Auto-detect all {{vars}} used across all requests in this collection
  const apiVars=[...new Set(
    collection.requests.flatMap(req=>{
      const allText=[req.url,req.body||'',...(req.headers||[]).map(h=>h.key+' '+h.value),...(req.params||[]).map(p=>p.key+' '+p.value)].join(' ')
      return [...allText.matchAll(/\{\{(\w+)\}\}/g)].map(m=>m[1])
    })
  )]

  // Resolve vars — CSV row vars > collection vars > env vars
  const resolveWith=(s,rowVars={})=>s.replace(/\{\{(\w+)\}\}/g,(_,k)=>rowVars[k]??colVars[k]??envVars[k]??`{{${k}}}`)

  // When CSV loaded, set iterations to row count
  const handleCSV=(e)=>{
    const file=e.target.files?.[0];if(!file)return
    setCsvFile(file.name)
    const reader=new FileReader()
    reader.onload=(ev)=>{
      const rows=parseCSV(ev.target.result)
      setCsvRows(rows)
      setCsvHeaders(rows.length?Object.keys(rows[0]):[])
      setIterations(rows.length||1)
    }
    reader.readAsText(file)
    e.target.value=''
  }

  const runAll=async()=>{
    setRunning(true);setResults([]);abortRef.current=false
    const all=[]
    const totalIter=csvRows.length>0?csvRows.length:iterations
    for(let iter=1;iter<=totalIter;iter++){
      if(abortRef.current)break
      // Merge CSV row vars for this iteration
      const rowVars=csvRows.length>0?csvRows[iter-1]:{}
      const ir={iter,requests:[],rowVars}
      const reqsToRun=collection.requests.filter(r=>selectedReqs.has(r.id))
      for(let ri=0;ri<reqsToRun.length;ri++){
        if(abortRef.current)break
        const req=reqsToRun[ri]
        setCurrent({iter,reqIdx:ri})
        const t0=Date.now()
        let status=0,statusText='',passed=false,error=null
        try{
          let url=resolveWith(req.url,rowVars)
          const en=(req.params||[]).filter(p=>p.enabled&&p.key)
          if(en.length){const qs=en.map(p=>`${encodeURIComponent(p.key)}=${encodeURIComponent(resolveWith(p.value,rowVars))}`).join('&');url=`${url}${url.includes('?')?'&':'?'}${qs}`}
          const hdrs={}
          ;(req.headers||[]).filter(h=>h.enabled&&h.key).forEach(h=>{hdrs[h.key]=resolveWith(h.value,rowVars)})
          const auth=req.auth||{}
          if(auth.type==='bearer'&&auth.token)hdrs['Authorization']='Bearer '+resolveWith(auth.token,rowVars)
          if(auth.type==='basic'&&auth.username)hdrs['Authorization']='Basic '+btoa(auth.username+':'+auth.password)
          if(auth.type==='apikey'&&auth.key&&auth.in==='header')hdrs[auth.key]=auth.value
          let body=undefined
          if(!['GET','HEAD'].includes(req.method)&&req.bodyType!=='none'&&req.body){hdrs['Content-Type']='application/json';body=resolveWith(req.body,rowVars)}
          const r=await fetch(getApiUrl()+'/proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,method:req.method,headers:hdrs,body})})
          const d=await r.json()
          status=d.status;statusText=d.status_text
          passed=status>=200&&status<300
        }catch(e){error=e.message;passed=false}
        ir.requests.push({name:req.name,method:req.method,status,statusText,passed,error,elapsed:Date.now()-t0})
        if(delay>0)await new Promise(r=>setTimeout(r,delay))
      }
      all.push(ir);setResults([...all])
    }
    setCurrent(null);setRunning(false)
  }

  const totReqs=results.flatMap(r=>r.requests)
  const passed=totReqs.filter(r=>r.passed).length
  const failed=totReqs.filter(r=>!r.passed).length

  return(<div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.3)',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget&&!running)onClose()}}>
    <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,width:'min(900px,95vw)',maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 8px 40px rgba(0,0,0,0.12)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:18}}>▶</span>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:'#1a1a2e'}}>Collection Runner</div>
            <div style={{fontSize:11,color:'#94a3b8'}}>{collection.name} · {collection.requests.length} requests</div>
          </div>
        </div>
        {!running&&<button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:`1px solid ${C.border}`,background:'#f8f8fc',color:'#94a3b8',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>}
      </div>
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        <div style={{width:220,borderRight:`1px solid ${C.border}`,padding:16,display:'flex',flexDirection:'column',gap:14,flexShrink:0}}>
          {/* CSV Upload — auto-maps CSV columns to {{vars}} found in requests */}
          <div>
            <label style={{fontSize:11,color:'#94a3b8',fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:6}}>Data File (CSV)</label>
            <input ref={csvRef} type="file" accept=".csv" style={{display:'none'}} onChange={handleCSV}/>
            <button onClick={()=>csvRef.current?.click()} style={{width:'100%',padding:'8px 10px',borderRadius:7,border:'1.5px dashed '+C.border,background:csvFile?'rgba(124,106,247,0.05)':'#f8f8fc',color:csvFile?C.pu:'#94a3b8',fontSize:11,cursor:'pointer',fontFamily:'inherit',textAlign:'left',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {csvFile?'📄 '+csvFile:'↑ Upload CSV — columns auto-map to {{vars}}'}
            </button>

            {/* Show auto-mapping: API vars → CSV columns */}
            {csvHeaders.length>0&&(
              <div style={{marginTop:8,padding:'8px 10px',background:'#f8f8fc',border:'1px solid '+C.border,borderRadius:8}}>
                <div style={{fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>Auto-mapping</div>
                {apiVars.length===0&&<div style={{fontSize:11,color:'#94a3b8'}}>No {'{{vars}}'} found in requests</div>}
                {apiVars.map(v=>{
                  const matched=csvHeaders.includes(v)
                  return(
                    <div key={v} style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <span style={{fontFamily:C.mono,fontSize:11,color:C.pu,background:'rgba(124,106,247,0.08)',border:'1px solid rgba(124,106,247,0.2)',borderRadius:4,padding:'2px 7px',flexShrink:0}}>{'{{'+v+'}}'}</span>
                      <span style={{fontSize:11,color:'#94a3b8'}}>→</span>
                      {matched
                        ?<span style={{fontFamily:C.mono,fontSize:11,color:'#16a34a',background:'rgba(22,163,74,0.08)',border:'1px solid rgba(22,163,74,0.2)',borderRadius:4,padding:'2px 7px'}}>✓ {v}</span>
                        :<span style={{fontSize:11,color:'#ef4444'}}>⚠ no column "{v}" in CSV</span>
                      }
                    </div>
                  )
                })}
                {csvHeaders.filter(h=>!apiVars.includes(h)).length>0&&(
                  <div style={{marginTop:6,paddingTop:6,borderTop:'1px solid '+C.border,fontSize:10,color:'#94a3b8'}}>
                    Unused CSV columns: {csvHeaders.filter(h=>!apiVars.includes(h)).map(h=><span key={h} style={{fontFamily:C.mono,color:'#cbd5e1',marginRight:4}}>{h}</span>)}
                  </div>
                )}
              </div>
            )}

            {csvFile&&<button onClick={()=>{setCsvFile(null);setCsvRows([]);setCsvHeaders([]);setIterations(1)}} style={{marginTop:5,fontSize:10,color:'#94a3b8',background:'none',border:'none',cursor:'pointer',padding:0}}>✕ Remove CSV</button>}
          </div>

          <div><label style={{fontSize:11,color:'#94a3b8',fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:6}}>
            Iterations {csvRows.length>0&&<span style={{color:C.pu,fontWeight:400,textTransform:'none'}}>({csvRows.length} from CSV)</span>}
          </label>
            <input type="number" min={1} max={1000} value={iterations} onChange={e=>setIterations(Number(e.target.value))} disabled={csvRows.length>0} style={{width:'100%',background:'#f8f8fc',border:'1.5px solid '+C.border,borderRadius:7,padding:'7px 10px',fontSize:13,color:csvRows.length>0?'#94a3b8':'#1a1a2e',outline:'none',fontFamily:C.mono,boxSizing:'border-box',cursor:csvRows.length>0?'not-allowed':'text'}}/></div>
          <div><label style={{fontSize:11,color:'#94a3b8',fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:6}}>Delay (ms)</label>
            <input type="number" min={0} max={10000} value={delay} onChange={e=>setDelay(Number(e.target.value))} style={{width:'100%',background:'#f8f8fc',border:`1.5px solid ${C.border}`,borderRadius:7,padding:'7px 10px',fontSize:13,color:'#1a1a2e',outline:'none',fontFamily:C.mono,boxSizing:'border-box'}}/></div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:'#94a3b8',fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>Requests</div>
            <div style={{display:'flex',gap:6,marginBottom:4}}>
              <button onClick={()=>setSelectedReqs(new Set(collection.requests.map(r=>r.id)))} style={{fontSize:10,color:C.pu,background:'none',border:'none',cursor:'pointer',padding:0,fontFamily:'inherit'}}>All</button>
              <span style={{fontSize:10,color:'#cbd5e1'}}>|</span>
              <button onClick={()=>setSelectedReqs(new Set())} style={{fontSize:10,color:'#94a3b8',background:'none',border:'none',cursor:'pointer',padding:0,fontFamily:'inherit'}}>None</button>
            </div>
            {collection.requests.map((req,i)=>{const mc=MC[req.method]||MC.GET;const isAct=current&&current.reqIdx===i;const sel=selectedReqs.has(req.id);return(
              <div key={req.id} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 0',opacity:running&&!isAct?0.45:1,cursor:'pointer'}} onClick={()=>{if(!running){const s=new Set(selectedReqs);sel?s.delete(req.id):s.add(req.id);setSelectedReqs(s)}}}>
                <input type="checkbox" checked={sel} onChange={()=>{}} style={{accentColor:C.pu,flexShrink:0,cursor:'pointer'}}/>
                {isAct&&<div style={{width:6,height:6,borderRadius:'50%',background:C.amber,flexShrink:0,animation:'pulse 1s infinite'}}/>}
                <span style={{fontSize:9,fontWeight:700,color:mc.text,background:mc.bg,border:`1px solid ${mc.border}`,borderRadius:3,padding:'1px 4px',fontFamily:C.mono,flexShrink:0}}>{req.method}</span>
                <span style={{fontSize:11,color:sel?'#1a1a2e':'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{req.name}</span>
              </div>
            )})}
          </div>
          {!running?<button onClick={runAll} style={{width:'100%',padding:'10px',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',border:'none',background:C.green,color:'#fff'}}>▶ Run All</button>
            :<button onClick={()=>abortRef.current=true} style={{width:'100%',padding:'10px',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',border:'none',background:C.red,color:'#fff'}}>⏹ Stop</button>}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:16}}>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
          {totReqs.length>0&&(
            <div style={{display:'flex',gap:10,marginBottom:16,padding:'10px 14px',background:'#f8f8fc',border:`1px solid ${C.border}`,borderRadius:10,alignItems:'center'}}>
              {[['Total',totReqs.length,'#1a1a2e','rgba(0,0,0,0.06)'],['Passed',passed,C.green,'rgba(22,163,74,0.1)'],['Failed',failed,C.red,'rgba(220,38,38,0.1)']].map(([label,val,color,bg])=>(
                <div key={label} style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:11,color:'#94a3b8',fontWeight:600}}>{label}</span>
                  <span style={{fontSize:13,fontWeight:700,color,background:bg,borderRadius:5,padding:'2px 9px',fontFamily:C.mono}}>{val}</span>
                </div>
              ))}
              <span style={{marginLeft:'auto',fontSize:11,color:'#94a3b8'}}>{running?`Running ${results.length+1}/${iterations}…`:`${results.length}/${iterations} done`}</span>
            </div>
          )}
          {results.length===0&&!running&&<div style={{textAlign:'center',padding:40,color:'#cbd5e1'}}><div style={{fontSize:40,marginBottom:12}}>▶</div><p style={{fontSize:13}}>Click Run All to start</p></div>}
          {results.map(iter=>(
            <div key={iter.iter} style={{marginBottom:14,border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden'}}>
              <div style={{padding:'8px 14px',background:'#f8f8fc',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:12,fontWeight:600,color:'#64748b'}}>Iteration {iter.iter}</span>
                {iter.rowVars&&Object.keys(iter.rowVars).length>0&&(
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {Object.entries(iter.rowVars).map(([k,v])=>(
                      <span key={k} style={{fontSize:10,fontFamily:C.mono,background:'rgba(124,106,247,0.08)',border:'1px solid rgba(124,106,247,0.2)',borderRadius:4,padding:'1px 6px',color:C.pu}}>
                        {k}={v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr style={{background:'#fafafa'}}>
                  {['Request','Method','Status','Result','Time'].map(h=><th key={h} style={{padding:'7px 12px',textAlign:'left',fontSize:11,color:'#94a3b8',fontWeight:600,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {iter.requests.map((r,i)=>{
                    const mc=MC[r.method]||MC.GET
                    const sc=SC(r.status)
                    return(
                      <tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
                        <td style={{padding:'8px 12px',fontSize:12,color:'#1a1a2e',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.name}</td>
                        <td style={{padding:'8px 12px'}}><span style={{fontSize:9,fontWeight:700,color:mc.text,background:mc.bg,border:`1px solid ${mc.border}`,borderRadius:3,padding:'1px 5px',fontFamily:C.mono}}>{r.method}</span></td>
                        <td style={{padding:'8px 12px'}}>
                          {r.status>0
                            ? <span style={{fontSize:11,fontWeight:700,color:sc,background:`${sc}15`,border:`1px solid ${sc}55`,borderRadius:5,padding:'2px 8px',fontFamily:C.mono}}>{r.status} {r.statusText}</span>
                            : <span style={{color:C.red,fontSize:11}}>—</span>}
                        </td>
                        <td style={{padding:'8px 12px'}}>
                          {r.error
                            ? <span style={{fontSize:11,fontWeight:700,color:C.red,background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.25)',borderRadius:5,padding:'3px 10px'}}>✗ Error</span>
                            : r.passed
                              ? <span style={{fontSize:11,fontWeight:700,color:C.green,background:'rgba(22,163,74,0.1)',border:'1px solid rgba(22,163,74,0.25)',borderRadius:5,padding:'3px 10px'}}>✓ Passed</span>
                              : <span style={{fontSize:11,fontWeight:700,color:C.red,background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.25)',borderRadius:5,padding:'3px 10px'}}>✗ Failed</span>}
                        </td>
                        <td style={{padding:'8px 12px',fontSize:11,color:'#94a3b8',fontFamily:C.mono}}>{r.elapsed}ms</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>)
}

// ── BackendSettings ──────────────────────────────────────────────────────────
function BackendSettings({onClose}){
  const[url,setUrl]=useState(getApiUrl())
  const[status,setStatus]=useState(null)
  const[testing,setTesting]=useState(false)
  const test=async()=>{
    setTesting(true); setStatus(null)
    try {
      const r=await fetch(url+'/health',{signal:AbortSignal.timeout(5000)})
      const d=await r.json()
      setStatus({ok:true, msg:'Connected ✓  ('+(d.runtime||'ok')+')'})
    } catch(e) {
      setStatus({ok:false, msg:'Failed: '+e.message})
    } finally { setTesting(false) }
  }
  const save=()=>{const c=url.replace(/\/$/,'');localStorage.setItem('apiforge_backend_url',c);onClose()}
  return(<div style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.3)',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:28,width:500,boxShadow:'0 8px 40px rgba(0,0,0,0.12)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:34,height:34,borderRadius:9,background:'rgba(124,106,247,0.1)',border:`1px solid rgba(124,106,247,0.2)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17}}>🔗</div>
          <div><div style={{fontSize:14,fontWeight:700,color:'#1a1a2e'}}>Backend URL</div><div style={{fontSize:11,color:'#94a3b8'}}>Your APIforge backend on Vercel</div></div>
        </div>
        <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:`1px solid ${C.border}`,background:'#f8f8fc',color:'#94a3b8',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
      </div>
      <label style={{fontSize:11,color:'#94a3b8',fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:6}}>Backend URL</label>
      <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://your-backend.vercel.app"
        style={{width:'100%',background:'#f8f8fc',border:`1.5px solid ${C.border}`,borderRadius:9,padding:'10px 14px',fontSize:13,color:'#1a1a2e',outline:'none',fontFamily:C.mono,boxSizing:'border-box',marginBottom:10}}/>
      {status&&<div style={{marginBottom:10,padding:'8px 12px',borderRadius:8,fontSize:12,fontFamily:C.mono,background:status.ok?'rgba(22,163,74,0.08)':'rgba(220,38,38,0.08)',border:`1px solid ${status.ok?'rgba(22,163,74,0.25)':'rgba(220,38,38,0.25)'}`,color:status.ok?C.green:C.red}}>{status.msg}</div>}
      <div style={{fontSize:11,color:'#94a3b8',marginBottom:18,lineHeight:1.6}}>Deploy the backend to Vercel and paste its URL here.<br/>Example: <span style={{color:C.pu,fontFamily:C.mono}}>https://apiforge-backend-xxx.vercel.app</span></div>
      <div style={{display:'flex',gap:8}}>
        <button onClick={test} disabled={testing||!url.trim()} style={{flex:1,padding:'9px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',border:`1px solid ${C.border}`,background:'#f8f8fc',color:'#64748b'}}>{testing?'⏳ Testing…':'🔌 Test Connection'}</button>
        <button onClick={save} disabled={!url.trim()} style={{flex:1,padding:'9px',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',border:'none',background:C.pu,color:'#fff'}}>Save & Connect</button>
      </div>
    </div>
  </div>)
}

// ── App ──────────────────────────────────────────────────────────────────────
const SK='apiforge_collections', EK='apiforge_envs', HK='apiforge_history'

export default function App(){
  const[collections,setCollections]=useState(()=>{try{return JSON.parse(localStorage.getItem(SK))||[]}catch{return[]}})
  const[activeId,setActiveId]=useState(null)
  const[responses,setResponses]=useState({})
  const[loading,setLoading]=useState(false)
  const[elapsed,setElapsed]=useState(null)
  const[envs,setEnvs]=useState(()=>{try{return JSON.parse(localStorage.getItem(EK))||[]}catch{return[]}})
  const[activeEnv,setActiveEnv]=useState(null)
  const[history,setHistory]=useState(()=>{try{return JSON.parse(localStorage.getItem(HK))||[]}catch{return[]}})
  const[showEnv,setShowEnv]=useState(false)
  const[showHist,setShowHist]=useState(false)
  const[showBackend,setShowBackend]=useState(false)
  const[runnerCol,setRunnerCol]=useState(null)
  const[csvRunReq,setCsvRunReq]=useState(null)
  const[importError,setImportError]=useState(null)
  const importRef=useRef(null)

  useEffect(()=>{localStorage.setItem(SK,JSON.stringify(collections))},[collections])
  useEffect(()=>{localStorage.setItem(EK,JSON.stringify(envs))},[envs])
  useEffect(()=>{localStorage.setItem(HK,JSON.stringify(history))},[history])

  const envVars={}
  const ae=envs.find(e=>e.id===activeEnv)
  if(ae)ae.vars.forEach(v=>{if(v.enabled&&v.key)envVars[v.key]=v.value})

  const activeReq=collections.flatMap(c=>c.requests).find(r=>r.id===activeId)||null
  const activeCol=collections.find(c=>c.requests.some(r=>r.id===activeId))

  const updateReq=(updated)=>setCollections(cs=>cs.map(c=>({...c,requests:c.requests.map(r=>r.id===updated.id?updated:r)})))

  const newReq_=(colId)=>{
    const req=newReq()
    if(!colId&&collections.length===0){const col=newCol();col.requests.push(req);setCollections([col])}
    else{const tid=colId||collections[0].id;setCollections(cs=>cs.map(c=>c.id===tid?{...c,requests:[...c.requests,req]}:c))}
    setActiveId(req.id)
  }

  const deleteReq=(colId,reqId)=>{setCollections(cs=>cs.map(c=>c.id===colId?{...c,requests:c.requests.filter(r=>r.id!==reqId)}:c));if(activeId===reqId)setActiveId(null)}

  const loadFromHistory=(h)=>{
    const existing=collections.flatMap(c=>c.requests).find(r=>r.id===h.reqId)
    if(existing){setActiveId(h.reqId);return}
    const req={...newReq(),name:h.url.split('/').filter(Boolean).pop()||'Request',method:h.method,url:h.url}
    if(collections.length===0){
      const col=newCol();col.requests.push(req);setCollections([col])
    } else {
      setCollections(cs=>cs.map((c,i)=>i===0?{...c,requests:[...c.requests,req]}:c))
    }
    setActiveId(req.id)
  }

  const handleImport=(e)=>{
    const file=e.target.files?.[0];if(!file)return
    const reader=new FileReader()
    reader.onload=(ev)=>{try{const d=importPostmanCollection(ev.target.result);const col={id:uid(),name:d.name,requests:d.requests,vars:d.vars||{}};setCollections(cs=>[...cs,col]);if(d.requests.length)setActiveId(d.requests[0].id);setImportError(null)}catch(err){setImportError(err.message);setTimeout(()=>setImportError(null),4000)}}
    reader.readAsText(file);e.target.value=''
  }

  const sendReq=async(url)=>{
    if(!activeReq||!url.trim())return
    setLoading(true);const t0=Date.now()
    try{
      const hdrs={}
      activeReq.headers.filter(h=>h.enabled&&h.key).forEach(h=>{hdrs[h.key]=h.value})
      const auth=activeReq.auth
      if(auth.type==='bearer'&&auth.token)hdrs['Authorization']=`Bearer ${auth.token}`
      if(auth.type==='basic'&&auth.username)hdrs['Authorization']=`Basic ${btoa(`${auth.username}:${auth.password}`)}`
      if(auth.type==='apikey'&&auth.key&&auth.in==='header')hdrs[auth.key]=auth.value
      let body=undefined
      if(!['GET','HEAD'].includes(activeReq.method)&&activeReq.bodyType!=='none'&&activeReq.body){hdrs['Content-Type']='application/json';body=activeReq.body}
      const resp=await fetch(`${getApiUrl()}/proxy`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,method:activeReq.method,headers:hdrs,body})})
      const data=await resp.json()
      const ms=Date.now()-t0;setElapsed(ms)
      setResponses(r=>({...r,[activeId]:{status:data.status,statusText:data.status_text,headers:data.headers||{},body:data.body||'',size:data.size,cookies:data.cookies||[],_req:{url,method:activeReq.method,headers:hdrs,body}}}))
      setHistory(h=>[{method:activeReq.method,url,status:data.status,time:new Date().toLocaleTimeString(),reqId:activeId},...h.slice(0,99)])
    }catch(e){setResponses(r=>({...r,[activeId]:{status:0,statusText:'Error',headers:{},body:e.message,size:'—',cookies:[]}}));setElapsed(Date.now()-t0)}
    finally{setLoading(false)}
  }

  return(<div style={{height:'100vh',background:C.bg,fontFamily:"'Inter','Space Grotesk',sans-serif",color:C.text,display:'flex',flexDirection:'column',overflow:'hidden'}}>
    <style>{`*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.1);border-radius:3px}input,textarea,select{color-scheme:light}`}</style>

    {/* Topbar */}
    <div style={{height:46,background:'#fff',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',padding:'0 16px',gap:12,flexShrink:0,boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${C.pu},#ec4899)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'#fff'}}>⚡</div>
        <span style={{fontSize:14,fontWeight:700,color:'#1a1a2e',letterSpacing:'-.3px'}}>APIforge</span>
      </div>
      <div style={{height:20,width:1,background:C.border}}/>
      <button onClick={()=>newReq_(null)} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,padding:'5px 12px',borderRadius:7,border:`1px solid ${C.border}`,background:'#f8f8fc',color:'#64748b',cursor:'pointer',fontFamily:'inherit'}}>+ New Request</button>
      <div style={{flex:1}}/>
      <select value={activeEnv||''} onChange={e=>setActiveEnv(e.target.value||null)} style={{background:'#f8f8fc',border:`1px solid ${C.border}`,borderRadius:7,padding:'5px 10px',fontSize:11,color:activeEnv?C.pu:'#94a3b8',outline:'none',cursor:'pointer'}}>
        <option value="">No Environment</option>
        {envs.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      <button onClick={()=>setShowEnv(true)} style={{fontSize:11,padding:'5px 12px',borderRadius:7,border:`1px solid rgba(124,106,247,0.25)`,background:'rgba(124,106,247,0.06)',color:C.pu,cursor:'pointer',fontFamily:'inherit'}}>⚙ Environments</button>
      <button onClick={()=>setShowHist(true)} style={{fontSize:11,padding:'5px 12px',borderRadius:7,border:`1px solid ${C.border}`,background:'#f8f8fc',color:'#64748b',cursor:'pointer',fontFamily:'inherit'}}>🕐 History</button>
      <button onClick={()=>setShowBackend(true)} style={{fontSize:11,padding:'5px 12px',borderRadius:7,border:`1px solid rgba(124,106,247,0.25)`,background:'rgba(124,106,247,0.06)',color:C.pu,cursor:'pointer',fontFamily:'inherit'}}>🔗 Backend</button>
    </div>

    {/* Main */}
    <div style={{flex:1,display:'flex',overflow:'hidden'}}>
      <input ref={importRef} type="file" accept=".json" style={{display:'none'}} onChange={handleImport}/>
      {importError&&<div style={{position:'fixed',bottom:16,left:260,zIndex:300,background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.3)',borderRadius:8,padding:'8px 14px',fontSize:12,color:C.red}}>{importError}</div>}
      <Sidebar
        collections={collections} activeId={activeId}
        onSelect={setActiveId} onNew={newReq_}
        onNewCollection={()=>setCollections(cs=>[...cs,newCol()])}
        onDeleteRequest={deleteReq}
        onRenameCollection={(id,name)=>setCollections(cs=>cs.map(c=>c.id===id?{...c,name}:c))}
        onDeleteCollection={(id)=>setCollections(cs=>cs.filter(c=>c.id!==id))}
        onImport={()=>importRef.current?.click()}
        onRun={(id)=>setRunnerCol(collections.find(c=>c.id===id))}
      />
      {activeReq?(
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{flex:'0 0 50%',display:'flex',flexDirection:'column',borderBottom:`2px solid ${C.border}`,overflow:'hidden'}}>
            <RequestEditor request={activeReq} onUpdate={updateReq} onSend={sendReq} loading={loading} envVars={envVars}
              collectionVars={activeCol?.vars||{}}
              onUpdateCollectionVar={(key,val)=>setCollections(cs=>cs.map(c=>c.id===activeCol?.id?{...c,vars:{...c.vars,[key]:val}}:c))}
              onOpenCsvRunner={()=>setCsvRunReq(activeReq)}
            />
          </div>
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <ResponseViewer response={responses[activeId]} loading={loading} elapsed={elapsed}/>
          </div>
        </div>
      ):(
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,color:'#cbd5e1'}}>
          <div style={{fontSize:64}}>⚡</div>
          <h2 style={{fontSize:20,fontWeight:600,color:'#94a3b8'}}>APIforge</h2>
          <p style={{fontSize:13,color:'#cbd5e1'}}>Create or select a request to get started</p>
          <button onClick={()=>newReq_(null)} style={{padding:'10px 24px',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',border:'none',background:C.pu,color:'#fff'}}>+ New Request</button>
        </div>
      )}
    </div>

    {showEnv&&<EnvPanel envs={envs} active={activeEnv} onSetActive={setActiveEnv} onUpdate={(id,vars)=>setEnvs(es=>es.map(e=>e.id===id?{...e,vars}:e))} onAdd={()=>{const e={id:uid(),name:'New Environment',vars:[{id:uid(),key:'',value:'',enabled:true}]};setEnvs(es=>[...es,e]);setActiveEnv(e.id)}} onDelete={(id)=>{setEnvs(es=>es.filter(e=>e.id!==id));if(activeEnv===id)setActiveEnv(null)}}/>}
    {showEnv&&<div onClick={()=>setShowEnv(false)} style={{position:'fixed',inset:0,zIndex:199}}/>}
    {showHist&&<HistoryPanel history={history} onSelect={loadFromHistory} onClear={()=>setHistory([])} onClose={()=>setShowHist(false)}/>}
    {showBackend&&<BackendSettings onClose={()=>setShowBackend(false)}/>}
    {csvRunReq&&<SingleRequestRunner request={csvRunReq} envVars={envVars} collectionVars={activeCol?.vars||{}} onClose={()=>setCsvRunReq(null)}/> }
    {runnerCol&&<CollectionRunner collection={runnerCol} envVars={envVars} onClose={()=>setRunnerCol(null)}/>}
  </div>)
}
