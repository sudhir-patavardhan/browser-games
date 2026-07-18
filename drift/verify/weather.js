// The weather, held to the physics it claims: rain days come purely from the day's seed, they make the
// SAME corner break away sooner and the SAME braking stint stop shorter of the mark, endless mode never
// sees a drop, and the HUD says so when the road is wet. The A/Bs flip g.wet mid-choreography on pinned
// seeds with identical forced inputs — the only variable is the sky.
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift;

  try{
    D.horde.wipe(); D.garage.wipe();

    // ---- the sky is a pure function of the seed, and it rains a sane amount
    let wetDays=0; for(let s=1;s<=300;s++) if(D.daily.wet(s)) wetDays++;
    rec("it rains on some days, not most", wetDays>=75 && wetDays<=135, wetDays+"/300 seeds are wet");
    const w1=D.daily.wet(12345), w2=D.daily.wet(12345);
    rec("the forecast never flip-flops", w1===w2, "wet(12345)="+w1+" twice");

    // ---- endless mode is always dry
    let anyWet=false;
    for(let s=1;s<=20;s++){ seedRandom(s); D.start(); if(D.game.wet) anyWet=true; }
    rec("endless mode never sees a drop", !anyWet, "20 endless starts, all dry");

    // ---- today's road wears today's sky
    D.startDaily();
    rec("the daily road wears the day's sky", D.game.wet===D.daily.wet(D.daily.seed(D.daily.key())),
        D.daily.key()+" -> wet="+D.game.wet);

    // ---- the same corner asks for more respect in the rain
    const corner=(wet)=>{ seedRandom(31337); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
      for(let i=0;i<350;i++){ D.autopilot(); D.setInput(D.game.forceSteer,1,0); D.step(1); }
      D.game.wet=wet;
      let ms=0; for(let i=0;i<200;i++){ D.setInput(0.55,1,0); D.step(1); ms=Math.max(ms,Math.abs(D.game.slip)); }
      D.clearInput(); return ms; };
    const dry=corner(false), wet=corner(true);
    rec("the same corner breaks away sooner in the rain", wet>dry+0.02,
        "max slip dry="+dry.toFixed(3)+" vs wet="+wet.toFixed(3));

    // ---- and the same braking stint stops shorter of the mark
    const braking=(w)=>{ seedRandom(4242); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
      for(let i=0;i<150;i++){ D.autopilot(); D.setInput(D.game.forceSteer,1,0); D.step(1); }
      D.game.wet=w;
      for(let i=0;i<180;i++){ D.autopilot(); D.setInput(D.game.forceSteer,0,1); D.step(1); }
      const v=D.game.speed; D.clearInput(); return v; };
    const dryEnd=braking(false), wetEnd=braking(true);
    rec("wet brakes bite later", wetEnd>dryEnd+8,
        "after the same 1.5s stop: dry="+Math.round(dryEnd*0.36)+" km/h vs wet="+Math.round(wetEnd*0.36)+" km/h remaining");

    // ---- the HUD owns up to it
    D.game.wet=true; D.hud();
    const we=document.getElementById('wetEl');
    rec("the HUD flies the wet flag", we.style.display!=='none' && we.textContent.indexOf('WET ROAD')>=0,
        "'"+we.textContent+"'");
    D.game.wet=false; D.hud();
    rec("...and strikes it on a dry road", we.style.display==='none', "hidden again");

    D.horde.wipe();
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" weather problem(s)") : "PASS | the rain does what rain does");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
