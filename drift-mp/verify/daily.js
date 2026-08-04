// Today's Road, held to its promises: one seeded road per calendar day, the same for every start of it;
// a TODAY'S BEST that resets at midnight and never touches the endless BEST; Again replays the mode you
// died in; and plain Drive stays random-seeded and out of the daily ledger.
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift;
  const roadMark=()=>{ const p=D.game.road.pts[60]; return p.x.toFixed(2)+","+p.y.toFixed(2); };
  const die=()=>{ D.game.batt=0.004; D.setInput(0,1,0);
    for(let i=0;i<900 && D.state==='play';i++) D.step(1); D.clearInput(); };

  try{
    D.horde.wipe(); D.garage.wipe();
    try{ localStorage.removeItem('drift.dbest'); localStorage.removeItem('drift.best'); }catch(e){}

    // ---- the seed is the date, and the road is the seed
    const k=D.daily.key();
    rec("the day key looks like a date", /^\d{4}-\d{2}-\d{2}$/.test(k), "key="+k);
    rec("the seed is a pure function of the day", D.daily.seed(k)===D.daily.seed(k) && D.daily.seed("2026-01-01")!==D.daily.seed("2026-01-02"),
        k+" -> "+D.daily.seed(k)+"; adjacent days differ");
    D.startDaily();
    const s1=D.game.seed, r1=roadMark(), c1=D.game.contracts.map(c=>c.id).join();
    D.startDaily();
    rec("today's road is TODAY'S road, every time", D.game.seed===s1 && roadMark()===r1 && D.dailyMode===true,
        "seed="+s1+" road@60="+r1+" twice over");
    rec("same road, same contract board", D.game.contracts.map(c=>c.id).join()===c1, c1);
    rec("the daily seed comes from the date, not the dice", s1===D.daily.seed(k), s1+" === seed('"+k+"')");

    // ---- plain Drive stays random and out of the ledger
    seedRandom(999); D.start();
    rec("Drive is not the daily road", D.game.seed!==s1 && D.dailyMode===false,
        "endless seed="+D.game.seed+" dailyMode="+D.dailyMode);

    // ---- the two ledgers never touch (the car scores a trickle while it dies, so read the FINAL score)
    D.startDaily(); D.game.score=500; die();
    const final1=Math.round(D.game.score);
    rec("a daily run settles into today's best", D.daily.best()===final1 && final1>=500,
        "final="+final1+" today's best="+D.daily.best());
    let endless='0'; try{ endless=localStorage.getItem('drift.best')||'0'; }catch(e){}
    rec("...and never into the endless BEST", endless==='0' && D.best===0,
        "drift.best="+endless+" D.best="+D.best);
    const nb=document.getElementById('newBest');
    rec("the over panel calls it a DAILY best", nb.textContent==='NEW DAILY BEST!' && nb.style.display!=='none',
        "'"+nb.textContent+"' shown="+(nb.style.display!=='none'));
    rec("the over panel dates the run", document.getElementById('overReason').textContent.indexOf('TODAY')===0,
        "'"+document.getElementById('overReason').textContent+"'");

    // ---- a worse run doesn't overwrite it
    D.startDaily(); D.game.score=300; die();
    rec("a worse daily run leaves the best alone", D.daily.best()===final1 && nb.style.display==='none',
        "ran "+Math.round(D.game.score)+", today's best still "+D.daily.best()+", no NEW DAILY BEST flag");

    // ---- Again replays the mode you died in
    document.getElementById('againBtn').click();
    rec("Again after a daily death replays today's road", D.dailyMode===true && D.game.seed===s1,
        "dailyMode="+D.dailyMode+" seed="+D.game.seed);
    die(); seedRandom(777); D.start(); die();
    document.getElementById('againBtn').click();
    rec("Again after an endless death stays endless", D.dailyMode===false && D.game.seed!==s1,
        "dailyMode="+D.dailyMode);

    // ---- yesterday's ledger is void at midnight
    try{ localStorage.setItem('drift.dbest','2000-01-01|9999'); }catch(e){}
    rec("a stale day's best reads as zero", D.daily.best()===0, "2000-01-01|9999 -> "+D.daily.best());
    D.startDaily(); D.game.score=100; die();
    rec("...and the first run of the new day claims it", D.daily.best()===Math.round(D.game.score) && D.daily.best()>=100,
        "today's best="+D.daily.best());

    try{ localStorage.removeItem('drift.dbest'); localStorage.removeItem('drift.best'); }catch(e){}
    D.horde.wipe();
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" daily-road problem(s)") : "PASS | today's road keeps its word");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
