// The car's own voice: the drivetrain whine and the road/wind noise that run continuously underneath
// everything else. What it sounds like is a pure function of the car (`driveTone`), so the decision can be
// asked and checked here without an audio device in the room; the wiring that carries that decision into
// Web Audio is then checked separately, in a real browser, by driving and looking at the nodes.
//
// What has to hold:
//   - pitch IS speed. One reduction gear means one rising note, monotonic from a standstill to VTOP, with
//     no steps in it anywhere — a gearbox artefact in an EV would be a lie the dash doesn't tell
//   - loudness is POWER, not speed: coasting fast is nearly silent, dragging out of a hairpin is not
//   - regen bends the note down, proportionally — the one acoustic tell that charge is going back in
//   - the road voice rises with speed, is silent at a standstill, and — the one that earns its keep — goes
//     loud and DARK off the tarmac, so the mistake that actually ends runs finally makes a noise
//   - a bridge deck rings brighter than asphalt at the same speed
//   - nothing sounds when the game is not being played, and nothing is even built until it is
//   - it wires up and runs in a real browser without throwing
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift;
  const cruise=n=>{ for(let i=0;i<n;i++){ D.autopilot(); D.step(1); } D.clearInput(); };
  // pose the car in a given state and ask what it sounds like. kw is what the dash reads, so it is what the
  // motor is told; setting it directly is how a single variable gets isolated from all the others.
  const tone=(o)=>{ const g=D.game;
    g.speed=o.speed; g.kw=o.kw||0; g.onGrass=!!o.grass;
    if(o.idx!==undefined) g.car.idx=o.idx;
    return driveTone(g); };

  try{
    // ---- nothing is built, and nothing sounds, before you have started
    const before=driveTone(null);
    rec("a game that isn't being played makes no sound at all", before.gain===0 && before.windGain===0,
        "gain="+before.gain+" windGain="+before.windGain+" on the start card");
    rec("...and no voice has been built for it", !D.audio.voice().motor && !D.audio.voice().road,
        "motor="+D.audio.voice().motor+" road="+D.audio.voice().road);

    seedRandom(31337); D.start();
    D.game.zNextIdx=1e9; D.game.zombies.length=0; D.game.deer.length=0;
    cruise(200);
    const g=D.game;
    // park the car somewhere plainly on tarmac, well clear of any bridge, so the deck test has a real control
    let plain=g.car.idx; while(bridgeAt(plain,g.seed)) plain++;

    // ---- pitch is speed, monotonically, with no steps in it
    const sweep=[];
    for(let s=0;s<=790;s+=10) sweep.push(tone({speed:s, kw:60, idx:plain}).hz);
    let rising=true, worstStep=0;
    for(let i=1;i<sweep.length;i++){
      if(sweep[i]<=sweep[i-1]) rising=false;
      worstStep=Math.max(worstStep, sweep[i]-sweep[i-1]);
    }
    rec("the whine rises with road speed, all the way up", rising,
        "0 km/h -> "+sweep[0].toFixed(0)+"Hz, top -> "+sweep[sweep.length-1].toFixed(0)+"Hz across "+sweep.length+" samples");
    rec("...and it does it in one smooth pull — no gearbox in an EV", worstStep<12,
        "biggest jump between adjacent samples "+worstStep.toFixed(1)+"Hz (a shift would show as a cliff)");

    // ---- loudness is POWER, not speed
    const coastFast=tone({speed:560, kw:0,   idx:plain});
    const pullSlow =tone({speed:200, kw:330, idx:plain});
    const pullFast =tone({speed:560, kw:330, idx:plain});
    rec("coasting fast is quieter than pulling hard slowly", coastFast.gain < pullSlow.gain*0.4,
        "coasting at 202 km/h: gain "+coastFast.gain.toFixed(4)+" vs 72 km/h at full power: "+pullSlow.gain.toFixed(4));
    rec("...because loudness reads the kW the dash draws, not the speedometer",
        Math.abs(pullSlow.gain-pullFast.gain)<1e-6 && pullFast.hz>pullSlow.hz,
        "same 330kW at 72 and 202 km/h: identical gain "+pullFast.gain.toFixed(4)+", different pitch "+
        pullSlow.hz.toFixed(0)+"Hz vs "+pullFast.hz.toFixed(0)+"Hz");

    // ---- regen bends the note down, proportionally
    const off=tone({speed:560, kw:0, idx:plain});
    const half=tone({speed:560, kw:-27, idx:plain});
    const full=tone({speed:560, kw:-90, idx:plain});
    rec("braking at speed bends the note DOWN", full.hz < off.hz*0.85,
        "coasting "+off.hz.toFixed(0)+"Hz -> full regen "+full.hz.toFixed(0)+"Hz at the same road speed");
    rec("...proportionally, so the ear can read how hard it is clawing back",
        half.hz<off.hz && half.hz>full.hz && half.regen>0.2 && half.regen<0.8,
        "regen 0.00/"+half.regen.toFixed(2)+"/"+full.regen.toFixed(2)+" -> "+off.hz.toFixed(0)+"/"+
        half.hz.toFixed(0)+"/"+full.hz.toFixed(0)+"Hz");

    // ---- the road voice
    const still=tone({speed:0,   kw:0,  idx:plain});
    const slow =tone({speed:200, kw:60, idx:plain});
    const fast =tone({speed:640, kw:60, idx:plain});
    rec("a stationary car makes no road noise", still.windGain===0,
        "windGain="+still.windGain+" at 0 km/h");
    rec("road noise rises with speed, and brightens with it", fast.windGain>slow.windGain*2 && fast.windHz>slow.windHz,
        "72 km/h: "+slow.windGain.toFixed(4)+" @ "+slow.windHz.toFixed(0)+"Hz  ->  230 km/h: "+
        fast.windGain.toFixed(4)+" @ "+fast.windHz.toFixed(0)+"Hz");

    // ---- THE one that earns its keep: the verge sounds like the verge
    const tarmac=tone({speed:400, kw:120, grass:false, idx:plain});
    const grass =tone({speed:400, kw:120, grass:true,  idx:plain});
    rec("the grass is loud and dark — the mistake that ends runs now makes a noise",
        grass.windGain>tarmac.windGain*2 && grass.windHz<tarmac.windHz*0.5,
        "same 144 km/h: tarmac "+tarmac.windGain.toFixed(4)+" @ "+tarmac.windHz.toFixed(0)+"Hz  ->  grass "+
        grass.windGain.toFixed(4)+" @ "+grass.windHz.toFixed(0)+"Hz");
    rec("...and it doesn't touch the motor, which has no opinion about the surface",
        Math.abs(grass.hz-tarmac.hz)<1e-6 && Math.abs(grass.gain-tarmac.gain)<1e-6,
        "motor unchanged at "+grass.hz.toFixed(0)+"Hz / gain "+grass.gain.toFixed(4));

    // ---- a bridge deck rings brighter than asphalt
    let deckIdx=g.car.idx; for(let i=g.car.idx;i<g.car.idx+4000;i++){ if(bridgeAt(i,g.seed)){ deckIdx=i; break; } }
    const onDeck=tone({speed:400, kw:120, idx:deckIdx});
    const onRoad=tone({speed:400, kw:120, idx:plain});
    rec("concrete rings brighter than asphalt", bridgeAt(deckIdx,g.seed) && onDeck.windHz>onRoad.windHz*1.1,
        "asphalt "+onRoad.windHz.toFixed(0)+"Hz -> deck "+onDeck.windHz.toFixed(0)+"Hz at the same speed");

    // ---- it actually wires up and runs in a real browser
    g.car.idx=plain; g.onGrass=false;
    let err=null; const orig=window.onerror; window.onerror=m=>{ err=m; };
    D.audio.init();
    try{ for(let i=0;i<600 && D.state==='play';i++){ D.autopilot(); D.step(1); D.audio.drive(); } }
    catch(e){ err=e.message||String(e); }
    D.clearInput();
    rec("driving with audio live builds both voices and throws nothing",
        !err && D.audio.live() && D.audio.voice().motor && D.audio.voice().road,
        "ctx="+D.audio.live()+" motor="+D.audio.voice().motor+" road="+D.audio.voice().road+" err="+err);

    // ---- the voice CHASES the tone rather than snapping to it: a parameter assigned outright every frame
    // is a click track. Slam the target from one end of the range to the other and watch it take time.
    g.speed=780; g.kw=330; g.onGrass=false; g.car.idx=plain;
    for(let i=0;i<200;i++) D.audio.drive(1/60);                 // settle at the top
    const settled=D.audio.now().hz;
    g.speed=0; g.kw=0;
    D.audio.drive(1/60);
    const oneFrame=D.audio.now().hz;
    for(let i=0;i<200;i++) D.audio.drive(1/60);
    const arrived=D.audio.now().hz;
    const want=driveTone(g).hz;
    rec("the voice chases the tone instead of snapping to it",
        Math.abs(oneFrame-settled) < Math.abs(settled-want)*0.5 && Math.abs(arrived-want)<2,
        "target dropped "+settled.toFixed(0)+"Hz -> "+want.toFixed(0)+"Hz: one frame later it is at "+
        oneFrame.toFixed(0)+"Hz, and it arrives at "+arrived.toFixed(0)+"Hz");
    // and the same call on a game that isn't playing is a no-op that still doesn't throw
    try{ D.audio.drive(); D.audio.drive(); }catch(e){ err=e.message||String(e); }
    window.onerror=orig;
    rec("...and asking a stopped car for its voice is harmless", !err, "err="+err);
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" sound problem(s)") : "PASS | the car finally says something between events");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
