// The wire, without the network: the multiplayer layer's protocol, interpolation, race clock and
// standings, driven through fake connections and the game's own sync step. Nothing here opens a
// PeerJS socket — the broker's job (the handshake) is the one part a headless probe can't own, and
// everything AFTER the handshake is plain message-passing, which is exactly what this suite pins.
(function(){
  const out=[], errs=[];
  window.onerror=(m,s,l,c,e)=>{ errs.push(String(m)+" @"+l+":"+c); };
  const D=window.__drift, H=D.mp, MP=H.MP;
  function ok(name,cond,detail){ out.push((cond?"PASS":"FAIL")+" "+name+(cond?"":"  — "+(detail||""))); }
  function fake(){ return { open:true, sent:[],
    send(m){ this.sent.push(JSON.parse(JSON.stringify(m))); },
    on(ev,cb){ this["_"+ev]=cb; }, close(){ this.open=false; } }; }

  // ---------- room codes: four glyphs, none of the ones people misread over a shoulder ----------
  let codesOk=true, alphaOk=true;
  for(let i=0;i<60;i++){ const c=H.code();
    if(c.length!==4) codesOk=false;
    if(/[0O1IL]/.test(c)) alphaOk=false; }
  ok("room codes are 4 glyphs", codesOk);
  ok("codes never use 0/O/1/I/L", alphaOk);

  // ---------- the host end of the star ----------
  MP.on=true; MP.isHost=true; MP.racing=false; MP.pid='H'; MP.pidSeq=1; MP.code='TEST';
  MP.conns=new Map(); MP.players=new Map();
  H.addPlayer('H','HOSTY','#fff');
  const c1=fake(), c2=fake();
  H.hostConn(c1); c1._data({t:'hi',name:'RIVAL ONE'});
  const wel=c1.sent.find(m=>m.t==='wel');
  ok("a hello is answered with a welcome", !!wel);
  ok("the welcome names the joiner", wel&&wel.pid==='P2', wel&&wel.pid);
  ok("the welcome carries the whole grid", wel&&wel.players.length===2);
  H.hostConn(c2); c2._data({t:'hi',name:'RIVAL TWO'});
  ok("a second joiner makes three", MP.players.size===3);
  ok("the first joiner hears about the second", c1.sent.some(m=>m.t==='lobby'&&m.players.length===3));
  c1.sent.length=0; c2.sent.length=0;
  c1._data({t:'st', x:100, y:200, a:0.5, s:1234, d:5000, m:2});
  const relay=c2.sent.find(m=>m.t==='st');
  ok("host relays a pose to the rest of the grid", !!relay);
  ok("the relay is stamped with the sender", relay&&relay.p==='P2', relay&&relay.p);
  ok("the pose lands in the sender's file", MP.players.get('P2').snaps.length===1 && MP.players.get('P2').score===1234);
  ok("a full room turns the ninth car away", (function(){
    for(let i=0;i<9;i++){ const c=fake(); H.hostConn(c); c._data({t:'hi',name:'X'+i}); }
    const last=[...MP.players.keys()].length;
    return last<=8; })(), "grid grew past 8");

  // ---------- where a rival is drawn: 140 ms behind the wire, never teleporting ----------
  const now=performance.now();
  function snapPlayer(snaps){ return { snaps, lastRx:now, racing:true, over:false }; }
  let p=snapPlayer([{rt:now-240,x:0,y:0,a:0},{rt:now-40,x:200,y:0,a:0}]);
  let g=H.pose(p);
  ok("between two poses the car is between them", g && Math.abs(g.x-100)<25, g&&g.x);
  p=snapPlayer([{rt:now-400,x:0,y:0,a:0},{rt:now-200,x:100,y:0,a:0}]);
  g=H.pose(p);
  ok("past the newest pose it coasts, gently", g && g.x>100 && g.x<=160, g&&g.x);
  p=snapPlayer([{rt:now-240,x:0,y:0,a:3.1},{rt:now-40,x:0,y:0,a:-3.1}]);
  g=H.pose(p);
  ok("headings lerp the short way round pi", g && Math.abs(Math.abs(g.a)-Math.PI)<0.2, g&&g.a);
  p=snapPlayer([]); ok("no signal yet, no hologram", H.pose(p)===null);

  // ---------- the flag drops ----------
  const bestBefore=localStorage.getItem('drift.best');
  MP.roundLen=120;
  H.beginRace(424242);
  ok("the race is a play state", D.state==='play');
  ok("the run is marked as a race", !!D.game.mp);
  ok("the grid clock is the host's round length", D.game.raceT===120, D.game.raceT);
  ok("the sky is the seed's sky", D.game.wet===D.daily.wet(424242));
  ok("the valet is waved off for the race", D.game.apArm===false);
  ok("everyone in the paddock made the grid", [...MP.players.values()].every(q=>q.racing));
  D.setInput(0,1,0); D.step(120);          // a second of full throttle inside the count
  ok("the count pins the score to zero", D.game.score===0, D.game.score);
  D.step(260);                             // the rest of the 3 s count, and a beat beyond
  ok("after the count the clock is running", D.game.raceT<120, D.game.raceT);

  // ---------- time is called ----------
  D.game.raceT=0.05; D.step(30);
  ok("the clock ends the run", D.state==='over');
  ok("the run ends as TIME UP", document.getElementById('overReason').textContent.indexOf('TIME UP')>=0,
    document.getElementById('overReason').textContent);
  ok("a race never touches the endless best", localStorage.getItem('drift.best')===bestBefore);
  ok("NEW BEST stays out of a race card", document.getElementById('newBest').style.display==='none');
  ok("Again becomes the walk back to the paddock", document.getElementById('againBtn').textContent==='Paddock');
  ok("the tower's column is on the card", document.getElementById('mpStand').style.display==='block');
  ok("the grid heard the host go out", c1.sent.some(m=>m.t==='over'&&m.p==='H'));

  // ---------- the order, once every car is in ----------
  // a spectator who joined mid-race must never hold the result open
  H.addPlayer('SPEC','LATECOMER','#999');
  for(const [pid,q] of MP.players){ if(pid!=='H'&&pid!=='SPEC'&&q.racing&&!q.over) H.netData({t:'over',p:pid,s:100+(+pid.slice(1)||0),r:'OUT'}); }
  H.maybeFinal();
  ok("all cars in closes the race", MP.racing===false);
  const st=H.standings();
  ok("standings hold only the grid", st.every(q=>q.pid!=='SPEC'));
  ok("standings are ordered by score", st.every((q,i)=>i===0||st[i-1].score>=q.score));
  ok("the card crowns the winner", document.getElementById('mpStand').innerHTML.indexOf('TAKES IT')>=0);

  // ---------- the joiner end of the star ----------
  H.shutdown(false);
  MP.on=true; MP.isHost=false; MP.conns=new Map(); MP.players=new Map();
  H.netData({t:'wel', pid:'P5', roundLen:300, racing:false,
    players:[{pid:'H',name:'HOSTY',color:'#fff',over:false,score:0,inRace:false},
             {pid:'P5',name:'ME',color:'#abc',over:false,score:0,inRace:false}]});
  ok("a welcome seats the joiner", MP.pid==='P5' && MP.players.size===2);
  ok("the host's round length is adopted", MP.roundLen===300);
  H.netData({t:'st', p:'GHOSTPID', x:1, y:2, a:0});
  ok("a pose from nobody is ignored", !MP.players.has('GHOSTPID'));
  H.netData({t:'lobby', roundLen:300, racing:false,
    players:[{pid:'H',name:'HOSTY',color:'#fff',over:false,score:0,inRace:false}]});
  ok("a lobby update prunes the departed", !MP.players.has('P5')||MP.players.size===1);
  H.shutdown(false);

  const div=document.createElement('div'); div.id='RESULTS';
  div.textContent=(errs.length?errs.map(e=>"!! "+e).join("\n")+"\n":"")+out.join("\n");
  document.body.appendChild(div);
})();
