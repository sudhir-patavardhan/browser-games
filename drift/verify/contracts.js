// The county job board, driven for real: three contracts a run, seeded off the road, paying WALLET cash
// the moment a goal is crossed. The claims defended here:
//   - every run posts exactly three DISTINCT jobs, none pre-completed
//   - the draw is seeded: same road => same jobs, and different roads really do draw different boards
//   - progress is live, crossing a target pays the wallet ON THE SPOT (and only once), and the money
//     lands in cashRun like any bounty
//   - the marksman job is only ever posted when a gun is actually equipped
//   - the over panel settles the board with checks and crosses
// Zombies are stood down for the payment stints (spawner pushed past the horizon) so every dollar of
// cash delta is a contract dollar — otherwise a lucky bumper strike pollutes the arithmetic.
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift;
  const ids=()=>D.game.contracts.map(c=>c.id);
  const noZombies=()=>{ D.game.zNextIdx=1e9; D.game.zombies.length=0; };

  try{
    D.horde.wipe();

    // ---- three distinct jobs, posted fresh
    seedRandom(777); D.start();
    const a=ids();
    rec("a run posts exactly three contracts", D.game.contracts.length===3, "posted: "+a.join(", "));
    rec("the three are distinct", new Set(a).size===3, a.join(", "));
    rec("none are born completed", D.game.contracts.every(c=>!c.done), "done flags: "+D.game.contracts.map(c=>c.done).join(","));

    // ---- seeded: same road, same board; and the board really varies between roads
    seedRandom(777); D.start();
    rec("the draw is seeded (same road => same jobs)", ids().join()===a.join(), a.join()+" vs "+ids().join());
    const boards=new Set([a.join()]);
    for(let s=1;s<=12;s++){ seedRandom(s); D.start(); boards.add(ids().join()); }
    rec("different roads draw different boards", boards.size>=3, boards.size+" distinct boards over 13 roads");

    // ---- an unarmed driver is never posted the marksman job
    let sawMarks=false;
    for(let s=1;s<=40;s++){ seedRandom(s); D.start(); if(ids().indexOf('marks')>=0) sawMarks=true; }
    rec("no marksman contract without a gun equipped", !sawMarks, "40 roads scanned, marks posted: "+sawMarks);

    // ---- armed, the marksman job enters the pool
    D.horde.give(300); D.horde.buy('p9');
    sawMarks=false;
    for(let s=1;s<=60;s++){ seedRandom(s); D.start(); if(ids().indexOf('marks')>=0){ sawMarks=true; break; } }
    rec("equipping a gun puts the marksman job in the draw", sawMarks, "found within 60 roads: "+sawMarks);
    D.horde.wipe();

    // ---- crossing a target pays the wallet on the spot, once, into cashRun like any bounty
    // find a road whose board carries RANGE (deterministic to complete: just drive 2.5 km tidily)
    let seed=0;
    for(let s=1;s<=80;s++){ seedRandom(s); D.start(); if(ids().indexOf('range')>=0){ seed=s; break; } }
    rec("a road carrying the RANGE job exists in 80 seeds", seed>0, "seed="+seed);
    seedRandom(seed); D.start(); noZombies();
    const board=D.game.contracts;
    const cash0=D.horde.cash();
    let paidAt=-1, cashAtPay=0;
    for(let t=0;t<150*120 && D.state==='play';t+=30){
      D.autopilot(); D.step(30);
      const rc=board.filter(c=>c.id==='range')[0];
      if(rc.done && paidAt<0){ paidAt=t; cashAtPay=D.horde.cash(); }
      if(paidAt>=0 && t>paidAt+1200) break;                    // 10s past payment is plenty
    }
    const rc=board.filter(c=>c.id==='range')[0];
    rec("driving 2.5 km completes the RANGE contract", rc.done && D.game.dist>=25000,
        "done="+rc.done+" at dist="+(D.game.dist/10000).toFixed(2)+"km");
    const dueNow=board.filter(c=>c.done).reduce((s,c)=>s+c.rew,0);
    rec("crossing pays the wallet on the spot", paidAt>=0 && cashAtPay>cash0,
        "wallet "+cash0+" -> "+cashAtPay+" the moment RANGE crossed");
    rec("contract cash equals the sum of completed rewards (paid once, zombies stood down)",
        D.horde.cash()-cash0===dueNow && D.horde.run()===dueNow,
        "wallet delta="+(D.horde.cash()-cash0)+" cashRun="+D.horde.run()+" vs completed rewards="+dueNow);
    rec("progress is live while a job is open",
        board.every(c=>c.done || c.prog(D.game)>0 || c.id==='horde' || c.id==='marks' || c.id==='chain' || c.id==='slide'),
        board.map(c=>c.id+"="+(c.done?"done":c.fmt(c.prog(D.game)))).join(", "));

    // ---- the over panel settles the board
    D.game.batt=0.005; D.setInput(0,1,0);
    for(let i=0;i<1200 && D.state==='play';i++) D.step(1);
    D.clearInput();
    rec("the run still ends properly with contracts aboard", D.state==='over', "state="+D.state);
    const html=document.getElementById('overCtr').innerHTML;
    rec("the over panel settles every job with a check or a cross",
        (html.match(/✓|✗/g)||[]).length===3 && html.indexOf('✓')>=0,
        "3 rows, at least one paid: "+html.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim());
    D.horde.wipe();
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" contract problem(s)") : "PASS | the job board holds up");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
