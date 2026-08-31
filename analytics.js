/* ============================ Browser Games — analytics ============================
   One file, one measurement ID, loaded relatively by every game, so the ID lives in exactly one place
   instead of being copy-pasted into a dozen self-contained HTML files and drifting apart.

   Three rules, in this order of importance:

   1. IT MUST NEVER BREAK A GAME. Analytics is the least important code in this repository and it is the
      only code that depends on a third party being reachable. So every entry point is wrapped, every
      failure is swallowed, and every call site in a game is guarded — a blocked script, an ad blocker, a
      missing file, a browser that has never heard of gtag: none of it reaches the game loop.

   2. IT DOES NOTHING ON file://. GA4 identifies a visitor by a cookie, and browsers do not grant cookies
      to file: origins — so a hit from a locally-opened file has no stable client_id, reports a
      `file:///Users/somebody/...` page path, and lands as junk if it lands at all. Since the whole point
      of this repo is that you can open a game straight off the disk, guarding on the protocol is simply
      being honest about where the numbers can come from. It has a second, load-bearing benefit: the games'
      verify harnesses drive the real page from file:// under Chrome's virtual clock, and a pending network
      request — or a heartbeat timer — can stall or skew that clock. No network and no timers on file://
      means the probes cannot be perturbed by this file existing.

   3. EVERY EVENT IS RECORDED LOCALLY AS IT IS SENT, whether the transport works or not. What the game
      BELIEVES it reported is then a thing you can assert on, and debug in a console, without a network.

   Two things it measures on every page with no per-game code at all:

   WHICH GAME. GA4 will happily tell you about `/drift/` and `/last-16/` as page paths, but a path is not a
   dimension you can pivot a funnel on, and it changes the day a folder is renamed. So every hit — the
   pageview and every event a game sends — carries `game_id` (the folder: `drift`, `carrom`, `home` for the
   hub) and `game_name` (the page's own title). Register those two as event-scoped custom dimensions in GA4
   and every report can be broken down BY GAME; see the README for the four clicks.

   HOW LONG THEY PLAYED. GA4's own "average engagement time" is a session-scoped number computed from a
   heartbeat it sends when it feels like it, and it counts a tab that merely sits there in the foreground.
   That is not "time spent playing this game". So this file keeps its own clock: it accrues time only while
   the page is VISIBLE and the visitor has touched something in the last few minutes, and it reports the
   accrued seconds as `game_time` events (`active_seconds` = since the last report, `total_seconds` = on
   this page so far). Sum `active_seconds` by `game_id` and you have time spent per game, honestly: a game
   left open on a second monitor overnight contributes its idle timeout, not eight hours.
*/
(function(){
  var ID='G-9XV3GF4FT0';
  var XPIXEL='reso2';         // X (Twitter) Ads conversion-tracking pixel id — attributes site visits to ad clicks
  /* X conversion EVENTS. Each is an id minted in Ads Manager > Events manager (they look like
     tw-reso2-abcde); an empty string means "not created yet", and nothing is sent for it. Fill these in
     and the pixel starts reporting the conversions the ad campaigns are optimised on:
       played_30s  — the visitor actually played: 30 s of active, visible input on a game page. Fired once
                     per page, from the same clock that produces game_time, so it cannot be gamed by an
                     open tab.
       game_start  — a game explicitly started a session (games opt in via bgAnalytics.conversion). */
  var XEVENTS={ played_30s:'tw-reso2-respb', game_start:'' };
  var PLAYED_AFTER=30000;     // ms of active play that counts as a real play for X attribution
  var playedSent=false;
  var LOG=[];                 // what the page believes it reported, oldest first, capped
  var CAP=200;
  var live=false;

  /* The clock. Every report is a multiple of a second, and the remainder is carried forward rather than
     rounded away, so the SUM of `active_seconds` across a page's reports is the real elapsed time. */
  var BEAT=30000;             // ms of ACTIVE time between game_time reports
  var IDLE=180000;            // no input for this long and we stop counting: an open tab isn't play
  var STEP=60000;             // no single accrual may exceed this — guards a clock jump / laptop sleep
  var TICK=1000;              // how often we look at the clock while the page is visible

  function localFile(){
    try{ return location.protocol==='file:'; }catch(e){ return true; }   // can't tell => assume the quiet path
  }

  /* WHICH GAME is this? The folder, which is exactly what the URL already says and what the hub links to:
       https://kreeda.games/drift/            -> drift
       https://kreeda.games/drift/index.html  -> drift
       https://kreeda.games/                  -> home
     Deliberately derived rather than declared: a per-game constant is a per-game thing to forget, and the
     folder is already the game's identity everywhere else in this repo (sitemap, hub cards, itch zips). */
  function gameId(){
    try{
      var parts=String(location.pathname).split('/').filter(function(p){ return p.length; });
      if(parts.length && parts[parts.length-1].indexOf('.')>=0) parts.pop();   // drop index.html
      var id=parts.length ? parts[parts.length-1] : 'home';
      return id.slice(0,100);
    }catch(e){ return 'unknown'; }
  }

  /* The human name, from the page's own <title> — "Drift — Kreeda" is a report label, "drift" is a key.
     Taking the title means a renamed game renames itself in GA4 with no second place to edit. */
  function gameName(){
    try{
      var t=String(document.title||'').split(/\s+[—|]\s+/)[0].trim();
      return (t||gameId()).slice(0,100);
    }catch(e){ return gameId(); }
  }

  var GAME={ game_id:gameId(), game_name:gameName() };

  function boot(){
    if(localFile()) return;                                  // rule 2: not a word from a file:// page
    try{
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      // set() before config() so the identity rides on EVERY hit, including ones gtag sends itself
      // (page_view, session_start, user_engagement) — that is what makes a GA4 report breakable down by
      // game rather than by page path.
      window.gtag('set', { game_id:GAME.game_id, game_name:GAME.game_name });
      // send_page_view is GA4's default and is what makes "which game did they open" work with no
      // per-game code at all: each game is its own path under the same property.
      window.gtag('config', ID, {
        send_page_view:true,
        game_id:GAME.game_id, game_name:GAME.game_name
      });
      var s=document.createElement('script');
      s.async=true;                                          // never block a game's first paint on this
      s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(ID);
      (document.head||document.documentElement).appendChild(s);
      live=true;
    }catch(e){ live=false; }
    bootXPixel();
  }

  /* X Ads conversion tracking. This is X's "website tag" base code, restated in this file's terms: the
     same queue-then-load shape as gtag above (calls made before uwt.js arrives are buffered in twq.queue
     and replayed), the same async script injection, the same file:// guard via boot(), and its own
     try/catch so a blocked ad domain can never reach the game. Its page view is what lets Ads Manager
     attribute a visit to the ad that was clicked; conversion events, if ever wanted, are twq('event', ...). */
  function bootXPixel(){
    try{
      if(!window.twq){
        var q=window.twq=function(){ q.exe ? q.exe.apply(q, arguments) : q.queue.push(arguments); };
        q.version='1.1'; q.queue=[];
        var x=document.createElement('script');
        x.async=true;
        x.src='https://static.ads-twitter.com/uwt.js';
        (document.head||document.documentElement).appendChild(x);
      }
      window.twq('config', XPIXEL);
    }catch(e){}
  }

  /* Report a conversion to X by its event NAME (a key of XEVENTS). Silent when the event has no id yet,
     when the pixel isn't up, or on file:// — and it never throws. Also recorded in LOG, so a test can see
     what the page tried to convert without any network. */
  function xConvert(name, params){
    try{
      var id=XEVENTS[name];
      var ev={ name:'x_conversion', params:{ event:String(name), event_id:id||'', game_id:GAME.game_id }, t:Date.now() };
      LOG.push(ev); if(LOG.length>CAP) LOG.shift();
      if(!id || localFile() || typeof window.twq!=='function') return;
      var p={ content_type:'game', content_id:GAME.game_id, content_name:GAME.game_name };
      if(params) for(var k in params){ try{ if(Object.prototype.hasOwnProperty.call(params,k)) p[k]=params[k]; }catch(e){} }
      window.twq('event', id, p);
    }catch(e){}
  }

  /* The only thing a game ever calls. Name and params follow GA4's rules (snake_case, <=40 char names),
     and it returns nothing — a game must never branch on whether analytics worked.
     The game's own params WIN over the identity: the hub's game_click already says which game was clicked,
     and that meaning must survive being sent from a page whose own game_id is `home`. */
  window.bgTrack=function(name,params){
    try{
      var p={}, k;
      for(k in GAME) if(Object.prototype.hasOwnProperty.call(GAME,k)) p[k]=GAME[k];
      if(params) for(k in params){
        try{ if(Object.prototype.hasOwnProperty.call(params,k)) p[k]=params[k]; }catch(e){}
      }
      var ev={ name:String(name), params:p, t:Date.now() };
      LOG.push(ev); if(LOG.length>CAP) LOG.shift();
      if(live && typeof window.gtag==='function') window.gtag('event', ev.name, ev.params);
    }catch(e){}
  };

  /* ---------------------------------------------------------------- time spent, measured honestly ---- */
  var active=0;               // ms accrued on this page, total
  var pending=0;              // ms accrued since the last game_time report (carries the sub-second remainder)
  var mark=0;                 // when the current accrual window started
  var lastInput=0;            // last time the visitor did something
  var running=false;
  var timer=null;

  function now(){ try{ return Date.now(); }catch(e){ return 0; } }
  function visible(){ try{ return document.visibilityState!=='hidden'; }catch(e){ return true; } }

  /* Move the clock forward to now, counting only the part of the interval that was real play: capped
     against a clock jump, and cut off at the moment the visitor went idle. */
  function accrue(){
    if(!running) return;
    var n=now(), from=mark;
    mark=n;
    var d=n-from;
    if(!(d>0)) return;
    if(d>STEP) d=STEP;
    var cutoff=lastInput+IDLE;
    if(n>cutoff) d=Math.min(d, Math.max(0, cutoff-(n-d)));   // count up to the moment idleness set in
    if(d<=0) return;
    active+=d; pending+=d;
  }

  /* Report whole seconds and keep the remainder, so a page's reports sum to its real elapsed time. */
  function report(reason){
    accrue();
    var whole=Math.floor(pending/1000);
    if(whole<1) return;                                      // nothing worth a hit
    pending-=whole*1000;
    window.bgTrack('game_time', {
      active_seconds:whole,
      total_seconds:Math.round(active/1000),
      reason:String(reason)
    });
    // The first time real play crosses the threshold, tell X this visit converted. Once per page.
    if(!playedSent && active>=PLAYED_AFTER && GAME.game_id!=='home'){
      playedSent=true;
      xConvert('played_30s', { value:Math.round(active/1000) });
    }
  }

  function start(){ if(running) return; mark=now(); running=true;
    if(!timer) timer=setInterval(function(){ try{ accrue(); if(pending>=BEAT) report('tick'); }catch(e){} }, TICK); }
  function stop(reason){ if(!running) return; report(reason); running=false;
    if(timer){ clearInterval(timer); timer=null; } }

  function watchClock(){
    if(localFile()) return;   // rule 2: no timers, no listeners, nothing for a virtual clock to trip over
    try{
      lastInput=now();
      ['pointerdown','keydown','touchstart','wheel','mousemove'].forEach(function(t){
        addEventListener(t, function(){ lastInput=now(); }, {passive:true, capture:true});
      });
      document.addEventListener('visibilitychange', function(){
        try{ if(visible()){ lastInput=now(); start(); } else stop('hidden'); }catch(e){}
      });
      // `hidden` is the flush that matters and the only one worth trusting: it fires on a tab switch, on
      // app-switching a phone, and on the way to being closed, while the page is still alive enough to send.
      // pagehide is a backstop for the desktop close that skipped it — best effort, by then, and that is
      // fine: everything before the last partial minute has already been reported.
      addEventListener('pagehide', function(){ try{ stop('unload'); }catch(e){} });
      if(visible()) start();
    }catch(e){}
  }

  window.bgAnalytics={
    id:ID,
    xpixel:XPIXEL,
    xevents:function(){ var o={}; for(var k in XEVENTS) o[k]=XEVENTS[k]; return o; },
    conversion:xConvert,                                     // e.g. bgAnalytics.conversion('game_start')
    game:function(){ return { id:GAME.game_id, name:GAME.game_name }; },
    live:function(){ return live; },
    seconds:function(){ accrue(); return Math.round(active/1000); },   // active time on this page so far
    log:function(){ return LOG.slice(); },
    last:function(name){ for(var i=LOG.length-1;i>=0;i--) if(!name||LOG[i].name===name) return LOG[i]; return null; },
    clear:function(){ LOG.length=0; }
  };

  boot();
  watchClock();
})();
