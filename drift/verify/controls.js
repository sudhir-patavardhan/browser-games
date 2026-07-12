// The control scheme, exercised for real: synthetic pointer + key events through the game's own handlers,
// then read back what the car was actually told to do. There are no on-screen buttons any more, so the
// only way to know touch still works is to touch it.
//
// The scheme: keys drive manually (arrows/WASD, throttle included). Fingers get an auto-throttle — you
// can't hold a pedal you don't have — where the FIRST finger steers and ANY SECOND finger is the brake.
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  const cv=document.getElementById('c');
  const pd=(id,x,y)=>cv.dispatchEvent(new PointerEvent('pointerdown',{pointerId:id,clientX:x,clientY:y,bubbles:true}));
  const pm=(id,x,y)=>cv.dispatchEvent(new PointerEvent('pointermove',{pointerId:id,clientX:x,clientY:y,bubbles:true}));
  const pu=(id)=>cv.dispatchEvent(new PointerEvent('pointerup',{pointerId:id,bubbles:true}));
  const kd=(k)=>dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true}));
  const ku=(k)=>dispatchEvent(new KeyboardEvent('keyup',{key:k,bubbles:true}));
  const S=()=>steerInput(), G=()=>throttleInput(), B=()=>brakeInput();

  try{
    // ---- the buttons are actually gone, not merely hidden
    const leftovers=["gas","brake"].filter(id=>document.getElementById(id));
    rec("no on-screen pedal buttons exist", leftovers.length===0,
        leftovers.length?("still in the DOM: #"+leftovers.join(", #")):"#gas and #brake are gone from the DOM");

    __drift.start();
    const g=__drift.game;
    if(g.view!=='top'){ document.getElementById('viewBtn').click(); }
    const W=innerWidth, H=innerHeight, midY=H*0.5;

    // ---- keyboard: full manual control, and NO auto-throttle behind your back
    rec("idle keyboard player gets no throttle", G()===0, "gas="+G()+" with no keys held (must stall, not cruise)");
    kd('ArrowUp');   rec("Up/W throttles",  G()===1, "gas="+G());
    ku('ArrowUp');
    kd('ArrowDown'); rec("Down/S brakes",   B()===1, "brake="+B());
    ku('ArrowDown');
    kd('ArrowLeft');  const sl=S();
    ku('ArrowLeft'); kd('ArrowRight'); const sr=S(); ku('ArrowRight');
    rec("arrows steer both ways", sl<0 && sr>0, "left="+sl+" right="+sr);

    // ---- touch, top view: hold a side to steer, and the car drives itself
    pd(1, W*0.15, midY);
    rec("touch: holding the left side steers left", S()<0, "steer="+S());
    rec("touch: the car auto-throttles (no pedal to hold)", G()===1 && B()===0, "gas="+G()+" brake="+B());
    pd(2, W*0.85, midY);          // a SECOND finger, on the far side, must brake — not steer right
    rec("touch: a second finger brakes", B()===1 && G()===0, "brake="+B()+" gas="+G());
    rec("touch: braking doesn't cancel your steering", S()<0, "steer still "+S()+" while braking");
    pu(2);
    rec("touch: lifting the second finger resumes throttle", B()===0 && G()===1, "brake="+B()+" gas="+G());
    pm(1, W*0.85, midY);          // slide the steering finger across to the other half
    rec("touch: sliding across swaps steering side", S()>0, "steer="+S());
    pu(1);
    rec("touch: letting go stops steering", S()===0, "steer="+S());

    // ---- touch, driver view: swipe to turn the wheel; second finger still brakes
    document.getElementById('viewBtn').click();
    rec("driver view engaged", __drift.game.view==='driver', "view="+__drift.game.view);
    pd(3, W*0.5, H*0.5);
    pm(3, W*0.5+W*0.25, H*0.5);   // swipe right
    const wr=S();
    rec("driver view: swiping right turns the wheel right", wr>0, "steer="+wr.toFixed(2)+" (analog)");
    pd(4, W*0.2, H*0.7);
    rec("driver view: a second finger brakes", B()===1 && G()===0, "brake="+B()+" gas="+G());
    rec("driver view: braking holds the wheel where it was", Math.abs(S()-wr)<0.01, "steer="+S().toFixed(2));
    pu(4); pu(3);

    // ---- a key press takes the right foot back off the auto-throttle
    kd('ArrowUp'); ku('ArrowUp');
    rec("touching a key hands manual throttle back", G()===0,
        "gas="+G()+" after a keypress with no keys held (auto-throttle must not linger)");

    // ---- CRUISE: it owns the right foot and nothing else
    const D2=window.__drift;
    D2.start();
    const gg=D2.game;
    // get some pace on, then set cruise at it
    for(let i=0;i<200;i++){ D2.setInput(0,1,0); D2.step(1); }
    const atSet=D2.game.speed;
    D2.clearInput();
    D2.cruise();
    rec("cruise engages at the pace you're doing", D2.game.cc>0 &&
        Math.abs(D2.game.cc-atSet)<atSet*0.12,
        "engaged at "+Math.round(D2.game.cc*0.36)+" km/h (was doing "+Math.round(atSet*0.36)+")");

    // Cruise owns the throttle, not the wheel — so keep steering, exactly as a player must. (Letting go of
    // the wheel entirely just drives you off a curving road, which tests the road, not the cruise.)
    // setInput(steer, undefined, undefined) forces ONLY the steering and leaves the pedals to cruise.
    for(let i=0;i<600;i++){
      if(D2.state!=='play') break;
      D2.autopilot(); const st=D2.game.forceSteer;
      D2.setInput(st, undefined, undefined);
      D2.step(1);
    }
    const held=D2.game.speed, tgt=D2.game.cc;
    rec("cruise holds the set speed with no input at all", D2.game.cc>0 &&
        Math.abs(held-tgt) < tgt*0.10,
        "after 5s hands-off: "+Math.round(held*0.36)+" km/h vs set "+Math.round(tgt*0.36)+" km/h");

    // it must never steer — the corners stay yours. Take our hands off the wheel for one step and check
    // cruise contributes NOTHING to the steering (the loop above was steering, so asserting on it would be
    // asserting on the test's own input).
    D2.clearInput(); D2.step(1);
    rec("cruise never steers for you", D2.game.steer===0 && D2.game.cc>0,
        "hands off the wheel with cruise still holding "+Math.round(D2.game.cc*0.36)+" km/h: steer="+
        D2.game.steer+" (must be 0 — the corners stay yours)");

    // and a dab of brake drops it, which is also what keeps the brake free as the drift trigger
    D2.setInput(0,0,1); D2.step(2); D2.clearInput();
    rec("braking cancels cruise (so the brake stays the drift trigger)", D2.game.cc===0,
        "cc="+D2.game.cc+" after a dab of brake");

    // toggling off works too
    D2.cruise(); const onAgain=D2.game.cc>0; D2.cruise();
    rec("cruise toggles off", onAgain && D2.game.cc===0, "on->"+onAgain+" then off->"+(D2.game.cc===0));

    // ---- the wheel's thumb pads ARE the controls (a car's cluster reports; the wheel commands)
    D2.start(); D2.clearInput();
    const gw=D2.game; gw.view='driver'; gw.wheelSteer=0;
    const wg=wheelGeom();
    const padPt=(sgn)=>({ x: wg.cx + sgn*wg.rad*0.52, y: wg.cy + wg.rad*0.085 });   // wheel centred => no rotation
    const L=padPt(-1), R=padPt(1);
    rec("the wheel has a cruise pad and a media pad", wheelPadAt(gw,L.x,L.y)===0 && wheelPadAt(gw,R.x,R.y)===1,
        "left pad -> "+wheelPadAt(gw,L.x,L.y)+" (0=cruise), right pad -> "+wheelPadAt(gw,R.x,R.y)+" (1=media)");

    for(let i=0;i<200;i++){ D2.setInput(0,1,0); D2.step(1); }   // get some pace on
    D2.clearInput();
    pd(9, L.x, L.y); pu(9);                                      // TAP the left thumb pad
    rec("tapping the wheel's left pad sets cruise", D2.game.cc>0,
        "cc="+Math.round(D2.game.cc*0.36)+" km/h after a thumb tap on the wheel");
    pd(9, L.x, L.y); pu(9);
    rec("tapping it again cancels cruise", D2.game.cc===0, "cc="+D2.game.cc);

    // and the important one: you must be able to GRAB the wheel near a pad without setting cruise by accident
    pd(9, L.x, L.y); pm(9, L.x+60, L.y); const dragSteer=S(); pu(9);
    rec("dragging from a pad steers instead of pressing it", D2.game.cc===0 && Math.abs(dragSteer)>0.05,
        "cc="+D2.game.cc+" (must stay 0) and the wheel turned to "+dragSteer.toFixed(2));

    // the pads turn WITH the wheel — that's what makes them feel like they're on it
    gw.wheelSteer=0.6;
    const ang=0.6*2.1, lx=-wg.rad*0.52, ly=wg.rad*0.085;
    const rot={ x: wg.cx + lx*Math.cos(ang) - ly*Math.sin(ang), y: wg.cy + lx*Math.sin(ang) + ly*Math.cos(ang) };
    rec("the pads rotate with the wheel", wheelPadAt(gw,rot.x,rot.y)===0 && wheelPadAt(gw,L.x,L.y)!==0,
        "with the wheel turned, the cruise pad has moved with it (and is no longer where it was)");
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" control problem(s)") : "PASS | all controls respond");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
