// The run report and the chain's name, checked against what was actually driven:
//   - the tier ladder names chains at exactly its thresholds, and not below them
//   - a banked chain wears its name in the drift pop
//   - driftTotal accumulates sliding, not driving
//   - the report card on the over panel tells the run's real numbers — including a chain you DIED holding
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift;

  try{
    D.horde.wipe(); D.garage.wipe();

    // ---- the ladder, rung by rung
    const lad=[[999,''],[1000,'CLEAN'],[2499,'CLEAN'],[2500,'SLICK'],[5000,'SICK'],[9999,'SICK'],
               [10000,'OUTRAGEOUS'],[20000,'LEGENDARY'],[240,''] ];
    const bad=lad.filter(([v,n])=>D.tier(v)!==n);
    rec("the tier ladder names chains at its thresholds", bad.length===0,
        bad.length?bad.map(([v,n])=>v+"->"+D.tier(v)+" (want "+(n||"unnamed")+")").join(", "):"999 unnamed, 1000 CLEAN ... 20000 LEGENDARY");

    // ---- a banked chain wears its name
    seedRandom(31337); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
    for(let i=0;i<200;i++){ D.setInput(0,1,0); D.step(1); }     // rolling, not drifting
    D.game.chainScore=6000; D.game.grace=0.008;                 // a SICK chain, about to land
    D.step(3);
    const pop=document.getElementById('driftpop');
    rec("the drift pop announces the tier", pop.innerHTML.indexOf('SICK')>=0 && pop.textContent.indexOf('+6,000')>=0,
        "'"+pop.textContent+"'");
    rec("the bank went to the books too", D.game.bestChain>=6000 && D.game.chainScore===0,
        "bestChain="+Math.round(D.game.bestChain)+" chain reset");

    // ---- driftTotal counts sliding, not driving
    const dt0=D.game.driftTotal;
    for(let i=0;i<240;i++){ D.autopilot(); D.setInput(D.game.forceSteer,1,0); D.step(1); }   // 2s on the line
    const straight=D.game.driftTotal-dt0;
    for(let i=0;i<300;i++){ D.setInput(0.9,1,0); D.step(1); }                                 // 2.5s provoked slide
    const slid=D.game.driftTotal-dt0-straight;
    rec("driftTotal counts sliding, not driving", straight<0.4 && slid>0.5,
        "2s straight added "+straight.toFixed(2)+"s, 2.5s of provocation added "+slid.toFixed(2)+"s");

    // ---- the report card tells the run's real numbers — even a chain died-with
    seedRandom(777); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
    for(let i=0;i<300;i++){ D.autopilot(); D.setInput(D.game.forceSteer,1,0); D.step(1); }
    const g=D.game;
    g.buzzes=3; g.zCarKills=2; g.gunKills=1;
    // die HOLDING an outrageous chain: grace must outlast the death, or the chain BANKS first and its
    // claw-back recharges the pack — the game's own loop saving the car from the probe's execution
    g.chainScore=11000; g.grace=3.0;
    g.batt=0.002;
    for(let i=0;i<600 && D.state==='play';i++) D.step(1);
    D.clearInput();
    rec("the run still ends with the report aboard", D.state==='over', "state="+D.state);
    const html=document.getElementById('overStats').innerHTML, txt=document.getElementById('overStats').textContent;
    const wantSpeed=Math.round(g.vmax*0.36)+" km/h", wantDist=(g.dist/10000).toFixed(1)+" km";
    rec("TOP SPEED and DISTANCE are the real ones", txt.indexOf(wantSpeed)>=0 && txt.indexOf(wantDist)>=0,
        "card says "+wantSpeed+" and "+wantDist);
    rec("a chain you died holding still counts, name and all",
        g.bestChain>=11000 && txt.indexOf('OUTRAGEOUS')>=0 && txt.indexOf(Math.round(g.bestChain).toLocaleString())>=0,
        "bestChain="+Math.round(g.bestChain)+" tier on card: "+(html.indexOf('OUTRAGEOUS')>=0));
    rec("shaves and shamblers are on the card", txt.indexOf('CLOSE SHAVES')>=0 && txt.indexOf('SHAMBLERS')>=0
        && txt.indexOf('3')>=0,
        "buzzes=3 kills=2+1 -> "+txt.replace(/\s+/g,' ').trim().slice(0,120));
    rec("six stats, every run", (html.match(/class="stat"/g)||[]).length===6, (html.match(/class="stat"/g)||[]).length+" tiles");

    D.horde.wipe();
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" report problem(s)") : "PASS | the report tells it straight");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
