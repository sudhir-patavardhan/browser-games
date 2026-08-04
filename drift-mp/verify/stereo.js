// The stereo rides with the wheels: music plays while the car is moving and stops when it isn't, without
// ever forgetting whether the driver actually wants it on. What has to hold:
//   - the driver's intent is the master switch. Gate off, and nothing here ever starts anything
//   - rolling above 10 km/h plays; stopped is silent, in every state — parked, crashed, on the card
//   - stopping does NOT cancel the intent, and does not lose your place in the track
//   - the crawl across a services (held at REST_LIMIT, 10.08 km/h) does not chatter the stereo on and off
//   - and the play/pause button still turns it OFF while the car is standing still
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  const D=window.__drift;
  const dump=()=>{ const d=document.createElement("div"); d.id="RESULTS";
    rows.push(""); rows.push(fail.length?("FAIL | "+fail.length+" stereo problem(s)"):"PASS | the stereo rides with the wheels");
    d.textContent=rows.join(String.fromCharCode(10)); document.body.appendChild(d); };

  try{
    if(!MUSIC.length){ rec("a playlist to gate at all", false, "no tracks — cannot test the gate"); dump(); return; }
    // a stand-in for the real <audio>: the gate only ever asks .paused/.src and calls .play()/.pause(),
    // and driving a real element headless makes this a test of autoplay policy instead of of the gate
    musicEl();
    const el={ paused:true, src:'stub', currentTime:0, plays:0, pauses:0,
               play(){ this.paused=false; this.plays++; return Promise.resolve(); },
               pause(){ this.paused=true; this.pauses++; } };
    audioEl=el;
    const roll=kmh=>{ if(D.game) D.game.speed=kmh/0.36; musicGate(); };

    // ---- the driver's intent is the master switch
    D.start(); mPlaying=false; el.paused=true; el.plays=0;
    for(const v of [0,40,120]) roll(v);
    rec("with the stereo off, driving never starts it", el.paused===true && el.plays===0,
        "plays="+el.plays+" after 0/40/120 km/h with mPlaying=false");

    // ---- rolling plays, stopping stops
    mPlaying=true;
    roll(120);
    rec("rolling plays", el.paused===false, "at 120 km/h: paused="+el.paused);
    el.currentTime=37.5;                                  // somewhere into the track
    roll(0);
    rec("...and coming to a stop silences it", el.paused===true, "at 0 km/h: paused="+el.paused);
    rec("...without cancelling the driver's intent", mPlaying===true, "mPlaying="+mPlaying);
    roll(120);
    rec("...and moving off picks up where it left off", el.paused===false && el.currentTime===37.5,
        "resumed at "+el.currentTime+"s, not 0");

    // ---- the threshold is 10 km/h, and it has hysteresis so the services crawl doesn't chatter
    roll(0); roll(6);
    rec("walking pace is not enough to start it", el.paused===true, "at 6 km/h from rest: paused="+el.paused);
    roll(11);
    rec("...but over 10 km/h is", el.paused===false, "at 11 km/h: paused="+el.paused);
    const p0=el.plays+el.pauses;
    for(let i=0;i<200;i++) roll(REST_LIMIT*0.36 + (i%2?0.05:-0.05));   // sitting on the facility limiter
    rec("the services crawl does not chatter it on and off", el.plays+el.pauses===p0,
        (el.plays+el.pauses-p0)+" state changes over 200 frames held at the "+
        (REST_LIMIT*0.36).toFixed(2)+" km/h limiter");

    // ---- every state where the car isn't driving is silent
    roll(120);
    const wasPlaying=!el.paused;
    D.game.speed=800; state='paused'; musicGate();        // sat at a charger: the car is stopped
    rec("parked at a charger is silent, whatever the last speed was", wasPlaying && el.paused===true,
        "was playing="+wasPlaying+", parked paused="+el.paused);
    state='play'; roll(120);
    D.game.speed=800; state='over'; musicGate();
    rec("...and so is the end of a run", el.paused===true, "state=over: paused="+el.paused);

    // ---- the button still works while standing still
    state='play'; D.game.speed=0; musicGate();
    rec("the gate has it paused with the car stopped", el.paused===true && mPlaying===true,
        "paused="+el.paused+" intent="+mPlaying);
    musicToggle();
    rec("...and the play/pause button can still turn it OFF from there", mPlaying===false,
        "mPlaying="+mPlaying+" after one press at a standstill");
    roll(120);
    rec("...and once off, it stays off however hard you drive", el.paused===true,
        "at 120 km/h with the stereo off: paused="+el.paused);
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }
  dump();
})();
