(function(){
var d=document.documentElement;d.classList.add('js');
var RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(window.__sky){document.body.prepend(window.__sky);}else{
var c=window.__sky=document.createElement('canvas');c.id='sky';c.setAttribute('aria-hidden','true');document.body.prepend(c);
var x=c.getContext('2d'),W,H,dpr=Math.min(devicePixelRatio||1,2),stars=[],band=[],shoot=null,t0=performance.now();
function rnd(a,b){return a+Math.random()*(b-a)}
function build(){W=innerWidth;H=innerHeight;c.width=W*dpr;c.height=H*dpr;c.style.width=W+'px';c.style.height=H+'px';x.setTransform(dpr,0,0,dpr,0,0);
 var n=Math.round(W*H/1500);stars=[];for(var i=0;i<n;i++){var z=Math.random();stars.push({x:rnd(0,W),y:rnd(0,H*2.2),z:z<.6?.15:z<.9?.35:.7,r:z<.6?rnd(.4,.8):z<.9?rnd(.7,1.2):rnd(1.1,1.7),p:rnd(0,6.28),s:rnd(.6,2),h:Math.random()<.12?(Math.random()<.5?'#c9b8ff':'#ffd9a0'):null})}
 band=[];for(var j=0;j<Math.round(W/1.3);j++){var u=Math.random(),off=(Math.random()+Math.random()+Math.random()-1.5)*H*.16;band.push({u:u,o:off,r:rnd(.3,.9),a:rnd(.08,.35)})}}
function dark(){return d.dataset.theme!=='light'}
function frame(now){var t=(now-t0)/1000,sc=scrollY;x.clearRect(0,0,W,H);
 var dk=dark(),ink=dk?'235,232,255':'42,53,80';
 // milky way: a diagonal drift of faint dust, not a blob
 for(var j=0;j<band.length;j++){var b=band[j],bx=b.u*W,by=H*.15+b.u*H*.7+b.o-(sc*.05%(H));by=((by%(H*1.2))+H*1.2)%(H*1.2)-H*.1;x.fillStyle='rgba('+(dk?'190,175,255':'90,80,140')+','+(b.a*(dk?1:.5))+')';x.fillRect(bx,by,b.r,b.r)}
 for(var i=0;i<stars.length;i++){var s=stars[i],y=((s.y-sc*s.z)%(H*2.2)+H*2.2)%(H*2.2);if(y>H)continue;
  var a=RM?.7:.45+.45*Math.sin(t*s.s+s.p);a*=dk?1:.8;x.globalAlpha=a;x.fillStyle=s.h&&dk?s.h:(s.r>1.3&&dk?'#ffe2a8':'rgb('+ink+')');
  if(s.r>1.3){var L=s.r*(3+2*a);x.globalAlpha=a*.35;x.beginPath();x.arc(s.x,y,s.r*2.6,0,6.28);x.fill();x.globalAlpha=a;x.beginPath();x.moveTo(s.x-L,y);x.quadraticCurveTo(s.x,y,s.x,y-L);x.quadraticCurveTo(s.x,y,s.x+L,y);x.quadraticCurveTo(s.x,y,s.x,y+L);x.quadraticCurveTo(s.x,y,s.x-L,y);x.fill()}else{x.beginPath();x.arc(s.x,y,s.r,0,6.28);x.fill()}}
 x.globalAlpha=1;
 if(dk&&!RM){if(!shoot&&Math.random()<.004)shoot={x:rnd(W*.2,W),y:rnd(0,H*.5),v:rnd(7,11),l:0};
  if(shoot){shoot.l+=1;var sx=shoot.x-shoot.l*shoot.v,sy=shoot.y+shoot.l*shoot.v*.45,g=x.createLinearGradient(sx,sy,sx+70,sy-32);g.addColorStop(0,'rgba(255,240,210,.9)');g.addColorStop(1,'rgba(255,240,210,0)');x.strokeStyle=g;x.lineWidth=1.4;x.beginPath();x.moveTo(sx,sy);x.lineTo(sx+70,sy-32);x.stroke();if(shoot.l>40)shoot=null}}
 if(!RM)requestAnimationFrame(frame)}
build();window.onresize=build;requestAnimationFrame(frame);if(RM)window.onscroll=function(){requestAnimationFrame(frame)};
new MutationObserver(function(){if(RM)requestAnimationFrame(frame)}).observe(d,{attributes:true,attributeFilter:['data-theme']});
}
// reveal
var els=document.querySelectorAll('.ed,.fig,.stage,section.cta,.cl-day,.cmd-group,details.faq,.row,.srv,.set');
if(RM||!('IntersectionObserver'in window)){els.forEach(function(e){e.classList.add('in')})}else{
 var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});
 els.forEach(function(e){e.classList.add('rv');io.observe(e)})}
})();
