// Can the game actually fetch and decode its playlist? A 200 from curl proves the file is reachable; it does
// NOT prove the browser will take it. This loads each track through a real <audio> element and waits for the
// metadata — if the host, the content-type or the bytes are wrong, that's where it shows up.
//
// What this CANNOT tell you: whether it sounds any good. Nobody here has ears.
(function(){
  const rows=[], fail=[];
  const rec=(n,pass,d)=>{ if(!pass) fail.push(n); rows.push((pass?"PASS":"FAIL")+" | "+n+" | "+d); };
  const done=()=>{
    rows.push("");
    rows.push(fail.length ? ("FAIL | "+fail.length+" track(s) unusable") : "PASS | every track loads in the browser");
    const d=document.createElement("div");
    d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
    document.body.appendChild(d);
  };

  if(!window.MUSIC && typeof MUSIC==='undefined'){ rec("playlist exists", false, "MUSIC is not defined"); return done(); }
  const list=(typeof MUSIC!=='undefined'?MUSIC:[]);
  rec("the manifest produced a playlist", list.length>0,
      list.length? (list.length+" track(s): "+list.map(t=>t.title).join(", ")) : "empty — tracks.js missing or listed nothing");
  if(!list.length) return done();

  let left=list.length;
  list.forEach((t,i)=>{
    const a=new Audio();
    a.preload='metadata';
    let settled=false;
    const finish=(ok,why)=>{
      if(settled) return; settled=true;
      rec("track "+(i+1)+": "+t.title, ok, why);
      if(--left===0) done();
    };
    a.addEventListener('loadedmetadata',()=>{
      const d=a.duration;
      finish(isFinite(d)&&d>1,
        "loaded "+(isFinite(d)?Math.floor(d/60)+"m"+String(Math.round(d%60)).padStart(2,'0')+"s":"?")+
        " of audio, decodable=" + (a.readyState>=1) + (t.remote?" (streamed)":" (local file)"));
    });
    a.addEventListener('error',()=>{
      const e=a.error, code=e?e.code:0;
      const why={1:'aborted',2:'network error',3:'decode failed',4:'source not supported / not reachable'}[code]||'unknown';
      finish(false, "could not load — "+why+" ("+String(t.src).replace(/^https?:\/\/([^/]+).*$/,'$1')+")");
    });
    a.src=t.src;
    setTimeout(()=>finish(false,"timed out waiting for metadata"), 12000);
  });
})();
