// The shared analytics file, driven from a REAL http origin — which is the only place it does anything.
//
// drift/verify/run.sh analytics already pins the half of the contract that is about restraint: silent on
// file://, and impossible to make throw at a game loop. That suite cannot pin the other half, because on
// file:// there is deliberately nothing to look at. So this one serves the repo over http on localhost and
// asserts what the file is actually FOR:
//
//   - it goes live, and every hit carries which game it came from (game_id / game_name), derived from the
//     folder and the title rather than declared per game — that is what makes a GA4 report pivot by game
//   - a game's own params outrank the identity, so the hub's game_click still names the game CLICKED
//   - it keeps an honest play clock: it accrues only while the page is visible, stops while it is hidden,
//     stops after the visitor has been idle, and its reports SUM to the elapsed time rather than drifting
//
// googletagmanager.com is resolved into a closed port by the runner, so nothing here touches the network
// and no number below depends on Google being reachable: gtag queues into window.dataLayer regardless, and
// that queue is the transport this probe reads.
//
// Chrome runs it under a virtual clock, so the ~300 "seconds" below cost milliseconds of real time.
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  const A=window.bgAnalytics;
  const WANT_ID=document.documentElement.getAttribute('data-want-game');   // set by the runner, per URL
  const BEAT=30, IDLE=180;                                                 // must match analytics.js
  const at=(s,fn)=>setTimeout(()=>{ try{ fn(); }catch(e){ rows.push("THREW at t="+s+"s: "+(e&&e.stack||e)); fail.push("threw"); } }, s*1000);

  // what gtag was asked to send, as opposed to what the local log believes: dataLayer is the real queue
  const sent=(name)=>[].slice.call(window.dataLayer||[])
    .filter(a=>a && a[0]==='event' && a[1]===name).map(a=>a[2]||{});
  const configs=()=>[].slice.call(window.dataLayer||[]).filter(a=>a && (a[0]==='config'||a[0]==='set'));

  at(2, ()=>{
    // ---- on a real origin it is awake, unlike on file://
    rec("served over http it goes live", !!A && A.live()===true && location.protocol==='http:',
        "protocol="+location.protocol+" live="+(A&&A.live()));
    rec("...queueing through gtag and loading the tag",
        Array.isArray(window.dataLayer) && typeof window.gtag==='function' &&
        document.querySelectorAll('script[src*="googletagmanager"]').length===1,
        "dataLayer="+(window.dataLayer||[]).length+" entries, gtag="+(typeof window.gtag)+
        ", tags="+document.querySelectorAll('script[src*="googletagmanager"]').length);

    // ---- WHICH GAME, derived from the URL and the title rather than declared per game
    const g=A.game();
    rec("the game is identified by its folder, not by a per-game constant", g.id===WANT_ID,
        "url="+location.pathname+" -> game_id="+g.id+" (wanted "+WANT_ID+")");
    rec("...and named by the page's own title, suffix stripped", g.name===document.title.split(/\s+[—|]\s+/)[0].trim(),
        "title="+JSON.stringify(document.title)+" -> game_name="+JSON.stringify(g.name));
    rec("...and that identity is set on the property, so gtag's OWN hits carry it too",
        configs().some(a=>a[a.length-1] && a[a.length-1].game_id===g.id),
        configs().map(a=>a[0]).join("+")+" carrying game_id="+
        configs().map(a=>(a[a.length-1]||{}).game_id).join(","));

    // ---- every event a game sends is attributable
    A.clear(); window.bgTrack('probe_event', { score:7 });
    const ev=A.last('probe_event'), out=sent('probe_event').pop();
    rec("every event a game sends carries the game with it",
        !!ev && ev.params.game_id===g.id && ev.params.game_name===g.name && ev.params.score===7,
        ev? JSON.stringify(ev.params) : "nothing logged");
    rec("...and it reaches the transport that way, not just the local log",
        !!out && out.game_id===g.id && out.score===7, out? JSON.stringify(out) : "nothing queued to gtag");

    // ---- but the caller outranks it: the hub's game_click names the game CLICKED, from a page that isn't it
    window.bgTrack('game_click', { game_id:'carrom', category:'board' });
    const gc=A.last('game_click');
    rec("a game's own params win, so the hub's game_click still names the game clicked",
        !!gc && gc.params.game_id==='carrom' && gc.params.game_name===g.name,
        gc? JSON.stringify(gc.params) : "nothing logged");
    A.clear();
  });

  // ---- the play clock: ~30s of visible time should buy exactly one report
  let firstBeats=null;
  at(BEAT+4, ()=>{
    firstBeats=A.log().filter(e=>e.name==='game_time');
    const s=A.seconds();
    rec("time spent is measured while the page is visible",
        s>=BEAT && s<=BEAT+8, "bgAnalytics.seconds()="+s+" after "+(BEAT+4)+"s on the page");
    rec("...and reported once per "+BEAT+"s of it, as a game_time event",
        firstBeats.length===1 && firstBeats[0].params.reason==='tick' &&
        Math.abs(firstBeats[0].params.active_seconds-BEAT)<=1,
        firstBeats.length+" game_time event(s): "+JSON.stringify(firstBeats.map(e=>e.params)));
    rec("...carrying the game, so the number is attributable to it",
        firstBeats.length>0 && firstBeats[0].params.game_id===A.game().id,
        firstBeats.length? JSON.stringify(firstBeats[0].params) : "-");

    // ---- the player conversion: thirty seconds of real play is one played_30s to GA4 — the marketing
    //      system's definition of a player — and never from the hub, where time is browsing, not play
    const played=sent('played_30s'), isGame=A.game().playable;
    rec(isGame ? "thirty seconds of real play sends one played_30s to GA4, carrying the game"
               : "a page that is not a Game never sends played_30s: browsing is not play",
        isGame ? (played.length===1 && played[0].game_id===A.game().id && Math.abs(played[0].active_seconds-BEAT)<=1)
               : played.length===0,
        played.length+" played_30s event(s): "+JSON.stringify(played));
  });

  // ---- hiding the tab stops the clock, and flushes what was owed
  let hiddenAt=0, hiddenBeats=0;
  at(BEAT+40, ()=>{
    hiddenAt=A.seconds();
    Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});
    document.dispatchEvent(new Event('visibilitychange'));
    const last=A.last('game_time');
    hiddenBeats=A.log().filter(e=>e.name==='game_time').length;
    rec("hiding the tab flushes the seconds it owes, marked as such",
        !!last && last.params.reason==='hidden' && last.params.active_seconds>0,
        last? JSON.stringify(last.params) : "no game_time on hide");
  });
  at(BEAT+90, ()=>{
    const beatsNow=A.log().filter(e=>e.name==='game_time').length;
    rec("...and a hidden tab accrues nothing at all — background time is not play time",
        A.seconds()===hiddenAt && beatsNow===hiddenBeats && A.last('game_time').params.reason==='hidden',
        "seconds() was "+hiddenAt+" at hide, "+A.seconds()+" after 50s hidden; "+
        (beatsNow-hiddenBeats)+" further report(s) while hidden");
    Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});
    document.dispatchEvent(new Event('visibilitychange'));
  });

  // ---- coming back resumes it, and the reports still add up to the truth
  at(BEAT+140, ()=>{
    const shown=A.seconds();
    const beats=A.log().filter(e=>e.name==='game_time');
    const summed=beats.reduce((n,e)=>n+e.params.active_seconds,0);
    rec("coming back to the tab resumes the clock", shown>hiddenAt+40,
        "seconds() "+hiddenAt+" -> "+shown+" over 50s back in the foreground");
    rec("...and the reports SUM to the time on the page, so nothing is rounded away",
        Math.abs(summed - beats[beats.length-1].params.total_seconds)<=1 &&
        Math.abs(summed - shown)<=BEAT+1,
        "sum(active_seconds)="+summed+" total_seconds="+beats[beats.length-1].params.total_seconds+
        " seconds()="+shown+" over "+beats.length+" reports");
    if(A.game().playable){
      const again=sent('played_30s');
      rec("...and played_30s fires once per page, not once per beat", again.length===1,
          again.length+" played_30s event(s) after "+beats.length+" beats");
    }
  });

  // ---- and a tab nobody is touching stops counting: the idle cutoff is the whole honesty of the number.
  // the visitor's last input was the visibilitychange above, at t=BEAT+90.
  at(BEAT+90+IDLE+20, ()=>{
    const s=A.seconds();
    const idleStopped=Math.abs(s-(hiddenAt+IDLE))<=6;
    rec("a game left open but untouched stops counting after "+IDLE+"s idle",
        idleStopped, "seconds()="+s+", expected to have frozen near "+(hiddenAt+IDLE)+
        " ("+(BEAT+90+IDLE+20)+"s on the page, "+(IDLE+20)+"s of them untouched)");
    done();
  });

  function done(){
    rows.push("");
    rows.push(fail.length ? ("FAIL | "+fail.length+" analytics problem(s)")
                          : "PASS | it says which game, and how long they played it");
    const d=document.createElement("div");
    d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
    document.body.appendChild(d);
  }
})();
