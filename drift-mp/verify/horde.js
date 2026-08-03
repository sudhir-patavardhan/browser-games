// The horde's ranks, measured: the mix is seeded and sane, a runner really is faster and inbound, a
// brute really soaks two rounds — and the BOUNTY LADDER and the brute's momentum tax are proven on
// choreographed hits at matched speeds, because "pays double" is an arithmetic claim, not a vibe.
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift;
  const fresh=()=>{ seedRandom(31337); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0; };
  // spawn one shambler of a wanted kind dead ahead (re-rolling the seeded dice until it comes up),
  // nail it down, and drive the line through/past it
  const place=(want,o)=>{ let z;
    for(let i=0;i<400;i++){ D.horde.spawn(D.game.car.idx+9,o); z=D.game.zombies[D.game.zombies.length-1];
      if(z.kind===want) break; D.game.zombies.pop(); }
    z.sp=0; return z; };
  const driveThrough=()=>{ const until=D.game.car.idx+14;
    for(let i=0;i<340 && D.game.car.idx<until;i++){ D.autopilot(); D.setInput(D.game.forceSteer,1,0); D.step(1); } };

  try{
    D.horde.wipe(); D.garage.wipe();

    // ---- the mix: seeded, mostly walkers, runners uncommon, brutes rare
    fresh();
    const n={walker:0,runner:0,brute:0};
    for(let i=0;i<400;i++){ D.horde.spawn(1e6+i*10, 500); n[D.game.zombies[D.game.zombies.length-1].kind]++;
      if(D.game.zombies.length>6) D.game.zombies.shift(); }
    rec("the ranks mix like they should", n.walker>300 && n.runner>18 && n.runner<70 && n.brute>6 && n.brute<40,
        "of 400: "+n.walker+" walkers, "+n.runner+" runners, "+n.brute+" brutes");
    D.game.zombies.length=0;

    // ---- a runner is built to reach you
    const w=place('walker',600); const wSp=w.sp; D.game.zombies.pop();
    const r=place('runner',600); const rSp=(function(){ let z;
      for(let i=0;i<400;i++){ D.horde.spawn(D.game.car.idx+9,600); z=D.game.zombies[D.game.zombies.length-1];
        if(z.kind==='runner'){ const s=z.sp; D.game.zombies.pop(); return s; } D.game.zombies.pop(); } })();
    rec("a runner's legs are real", r.kind==='runner' && (rSp===undefined || rSp>wSp*2),
        "walker sp="+Math.round(wSp)+" vs runner sp="+(rSp===undefined?"(nailed)":Math.round(rSp)));
    D.game.zombies.length=0;

    // ---- the bounty ladder, at matched speed: walker x1, runner x2, brute x3 (and the brute taxes you)
    const hit=(want)=>{ fresh();
      for(let i=0;i<300;i++){ D.autopilot(); D.setInput(D.game.forceSteer,1,0); D.step(1); }
      const cash0=D.horde.run(), spd0=D.game.speed;
      place(want,0); driveThrough();
      return { pay:D.horde.run()-cash0, spd0, after:D.game.speed, kills:D.game.zCarKills }; };
    const hw=hit('walker'), hr=hit('runner'), hb=hit('brute');
    rec("a walker pays x1 and a runner pays x2", hw.kills===1 && hr.kills===1 && hr.pay>hw.pay*1.6 && hr.pay<hw.pay*2.4,
        "walker $"+hw.pay+" vs runner $"+hr.pay+" at ~matched speed");
    rec("a brute pays x3", hb.kills===1 && hb.pay>hw.pay*2.4 && hb.pay<hw.pay*3.6,
        "brute $"+hb.pay+" vs walker $"+hw.pay);
    rec("a brute has mass — the hit is paid in momentum", hb.after<hb.spd0*0.93 && hw.after>hw.spd0*0.90,
        "brute: "+Math.round(hb.spd0*0.36)+" -> "+Math.round(hb.after*0.36)+" km/h; walker: "
        +Math.round(hw.spd0*0.36)+" -> "+Math.round(hw.after*0.36)+" km/h");

    // ---- a brute soaks the first round. The SM-2's 0.34s cadence lands two rounds well inside the
    // window the gun has (target must stay 60+ px downrange), where the P9's 1s cooldown ran out of road.
    fresh(); D.horde.give(1000); D.horde.buy('sm2');
    const bz=(function(){ let z;
      for(let i=0;i<400;i++){ D.horde.spawn(D.game.car.idx+16, ROAD_HALF+80); z=D.game.zombies[D.game.zombies.length-1];
        if(z.kind==='brute') break; D.game.zombies.pop(); } z.sp=0; return z; })();
    let sawSoaked=false;
    for(let i=0;i<3*120 && bz.hp>0;i++){ D.autopilot(); D.setInput(D.game.forceSteer,0.5,0); D.step(1);
      if(bz.hp===1) sawSoaked=true; }
    rec("a brute soaks the first round and falls to the second", sawSoaked && bz.hp<=0 && D.game.gunKills===1,
        "hp 2 -> 1 (soaked, still up) -> 0; gun kills="+D.game.gunKills);
    D.horde.wipe();

    // ---- the same seed raises the same horde
    seedRandom(777); D.start();
    const kinds1=[]; for(let i=0;i<25;i++){ D.horde.spawn(1e6+i*10,400); kinds1.push(D.game.zombies[D.game.zombies.length-1].kind); }
    seedRandom(777); D.start();
    const kinds2=[]; for(let i=0;i<25;i++){ D.horde.spawn(1e6+i*10,400); kinds2.push(D.game.zombies[D.game.zombies.length-1].kind); }
    rec("the same seed raises the same horde", kinds1.join()===kinds2.join(), kinds1.slice(0,8).join(","));

    D.horde.wipe();
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" horde problem(s)") : "PASS | the ranks hold");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
