// The trophy shelf, earned the hard way: every badge here is claimed through the game's own paths —
// real banked chains, a real brute under the bumper, real purchases, real daily starts — never by
// poking the storage. What must hold: feats award once (and only once), the shelf renders the count,
// the toast announces, streaks count consecutive days and break properly, and it all persists.
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift;
  const has=id=>D.shelf.owned().indexOf(id)>=0;
  const die=()=>{ D.game.batt=0.002; D.game.grace=3;
    for(let i=0;i<600 && D.state==='play';i++) D.step(1); D.clearInput(); };
  const key=(d)=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

  try{
    D.horde.wipe(); D.garage.wipe(); D.shelf.wipe();
    try{ localStorage.removeItem('drift.dbest'); localStorage.removeItem('drift.dghost'); }catch(e){}

    // ---- clean slate renders a bare shelf
    rec("a bare shelf shows 0 of the lot", document.querySelector('.shelfBox').textContent.indexOf('0/16')>=0,
        "'TROPHY SHELF 0/16' on the card");

    // ---- bank a CLEAN chain: two badges, one toast each, never twice
    seedRandom(31337); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
    for(let i=0;i<200;i++){ D.setInput(0,1,0); D.step(1); }
    D.game.chainScore=1400; D.game.grace=0.008; D.step(3);
    rec("the first banked chain lands SIDEWAYS and CLEAN COLLAR", has('sideways') && has('clean') && !has('sick'),
        D.shelf.owned().join(","));
    rec("the toast called it", document.getElementById('badgePop').textContent.indexOf('🏆')===0,
        "'"+document.getElementById('badgePop').textContent+"'");
    const n1=D.shelf.owned().length;
    D.game.chainScore=1400; D.game.grace=0.008; D.step(3);
    rec("a feat pays once", D.shelf.owned().length===n1, "still "+n1+" after banking another CLEAN");

    // ---- the run-stat badges come off the report, died-holding included
    D.game.vmax=630; D.game.buzzes=5; D.game.zCarKills=6; D.game.gunKills=4;
    D.game.chainScore=5200; die();
    rec("225 CLUB, BARBER, PEST CONTROL, CERTIFIED SICK off one report",
        has('tonup') && has('barber') && has('pest') && has('sick'),
        D.shelf.owned().join(","));

    // ---- BIG GAME under the bumper, through the real strike path
    seedRandom(31337); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
    for(let i=0;i<300;i++){ D.autopilot(); D.setInput(D.game.forceSteer,1,0); D.step(1); }
    for(let i=0;i<400;i++){ D.horde.spawn(D.game.car.idx+9,0);
      const z=D.game.zombies[D.game.zombies.length-1];
      if(z.kind==='brute'){ z.sp=0; break; } D.game.zombies.pop(); }
    const until=D.game.car.idx+14;
    for(let i=0;i<340 && D.game.car.idx<until;i++){ D.autopilot(); D.setInput(D.game.forceSteer,1,0); D.step(1); }
    rec("BIG GAME needs a brute under the bumper", has('biggame'), "owned: "+has('biggame'));

    // ---- the shop badges: all guns, all mods
    D.horde.give(9000);
    D.horde.buy('p9'); D.horde.buy('sm2');
    rec("two guns is not FULLY ARMED", !has('armed'), "armed="+has('armed'));
    D.horde.buy('lr7');
    D.garage.buy('pack'); D.garage.buy('regen'); D.garage.buy('tyres');
    rec("the full armory and the full garage hit the shelf", has('armed') && has('geared'),
        "armed + geared after the last purchases");

    // ---- the streak: yesterday's habit continues, an old habit breaks
    D.shelf.wipe();
    const today=new Date(), yest=new Date(today.getTime()-864e5);
    try{ localStorage.setItem('drift.streak', key(yest)+'|2'); }catch(e){}
    D.startDaily();
    rec("day 3 of the habit is REGULAR", has('reg3') && D.shelf.streak().indexOf('|3')>0,
        "streak -> "+D.shelf.streak());
    die();
    D.shelf.wipe();
    try{ localStorage.setItem('drift.streak','2000-01-01|6'); }catch(e){}
    D.startDaily();
    rec("a lapsed streak starts over", !has('reg3') && D.shelf.streak().indexOf('|1')>0,
        "streak -> "+D.shelf.streak());
    die();
    D.shelf.wipe();
    try{ localStorage.setItem('drift.streak', key(yest)+'|6'); }catch(e){}
    D.startDaily();
    rec("day 7 makes you a LOCAL FIXTURE", has('reg7') && has('reg3'), "streak -> "+D.shelf.streak());
    die();

    // ---- it all persists, and the shelf shows the gold
    let stored=''; try{ stored=localStorage.getItem('drift.badges')||''; }catch(e){}
    rec("the shelf is written down", stored.indexOf('reg7')>=0, "drift.badges="+stored);
    rec("the card wears the gold", document.querySelector('.shelfBox .bdg.got')!==null,
        document.querySelectorAll('.shelfBox .bdg.got').length+" gilded chips");

    D.horde.wipe(); D.garage.wipe(); D.shelf.wipe();
    try{ localStorage.removeItem('drift.dbest'); localStorage.removeItem('drift.dghost'); }catch(e){}
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" shelf problem(s)") : "PASS | the shelf keeps what you earn");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
