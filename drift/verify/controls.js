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
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" control problem(s)") : "PASS | all controls respond");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
