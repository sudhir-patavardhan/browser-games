// Measure the real on-screen geometry of the pedals in BOTH cameras — half-offscreen pedals would be a
// serious mobile bug, and the screenshot alone can't tell me apart from a capture artifact.
(function(){
  const rows=[];
  try{
    __drift.start();
    const note=(label)=>{
      rows.push("VIEW="+label+"  innerWidth="+innerWidth+"  innerHeight="+innerHeight+
        "  scrollW="+document.documentElement.scrollWidth);
      for(const id of ["gas","brake","viewBtn"]){
        const r=document.getElementById(id).getBoundingClientRect();
        const off = r.right>innerWidth+0.5 || r.left<-0.5 || r.bottom>innerHeight+0.5 || r.top<-0.5;
        rows.push("  #"+id+" x=["+r.left.toFixed(0)+".."+r.right.toFixed(0)+"] y=["+
          r.top.toFixed(0)+".."+r.bottom.toFixed(0)+"] size="+r.width.toFixed(0)+"x"+r.height.toFixed(0)+
          (off ? "   *** OFFSCREEN ***" : "   ok"));
      }
      const g=document.getElementById("gas").getBoundingClientRect();
      const b=document.getElementById("brake").getBoundingClientRect();
      const ov=!(g.right<b.left||b.right<g.left||g.bottom<b.top||b.bottom<g.top);
      rows.push("  pedals overlap each other: "+ov);
      // what does a tap in the middle of each pedal actually hit?
      const hit=(el,name)=>{
        const r=el.getBoundingClientRect();
        const t=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
        rows.push("  tap centre of "+name+" hits: <"+(t?t.tagName.toLowerCase()+(t.id?"#"+t.id:""):"null")+">");
      };
      hit(document.getElementById("gas"),"GAS");
      hit(document.getElementById("brake"),"BRAKE");
    };
    note(__drift.game.view);
    document.getElementById("viewBtn").click();
    note(__drift.game.view);
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); }
  const d=document.createElement("div");
  d.id="GEO"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
