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
      request can stall that clock. No network on file:// means the probes cannot be perturbed by this file
      existing.

   3. EVERY EVENT IS RECORDED LOCALLY AS IT IS SENT, whether the transport works or not. What the game
      BELIEVES it reported is then a thing you can assert on, and debug in a console, without a network.

   Note for whoever hosts this: GA4 sets cookies, so serving it to visitors in the EU/UK generally needs a
   consent banner. There isn't one here — see the README.
*/
(function(){
  var ID='G-9XV3GF4FT0';
  var LOG=[];                 // what the page believes it reported, oldest first, capped
  var CAP=200;
  var live=false;

  function localFile(){
    try{ return location.protocol==='file:'; }catch(e){ return true; }   // can't tell => assume the quiet path
  }

  function boot(){
    if(localFile()) return;                                  // rule 2: not a word from a file:// page
    try{
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      // send_page_view is GA4's default and is what makes "which game did they open" work with no
      // per-game code at all: each game is its own path under the same property.
      window.gtag('config', ID, { send_page_view:true });
      var s=document.createElement('script');
      s.async=true;                                          // never block a game's first paint on this
      s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(ID);
      (document.head||document.documentElement).appendChild(s);
      live=true;
    }catch(e){ live=false; }
  }

  /* The only thing a game ever calls. Name and params follow GA4's rules (snake_case, <=40 char names),
     and it returns nothing — a game must never branch on whether analytics worked. */
  window.bgTrack=function(name,params){
    try{
      var ev={ name:String(name), params:params||{}, t:Date.now() };
      LOG.push(ev); if(LOG.length>CAP) LOG.shift();
      if(live && typeof window.gtag==='function') window.gtag('event', ev.name, ev.params);
    }catch(e){}
  };

  window.bgAnalytics={
    id:ID,
    live:function(){ return live; },
    log:function(){ return LOG.slice(); },
    last:function(name){ for(var i=LOG.length-1;i>=0;i--) if(!name||LOG[i].name===name) return LOG[i]; return null; },
    clear:function(){ LOG.length=0; }
  };

  boot();
})();
