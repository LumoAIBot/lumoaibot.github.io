/* Home page demo chat: a scripted Discord channel. Every reply is Lumo's real output, rendered from the bot's own code
   (_build/gen_demo.py). No network, no AI: the buttons only swap in prepared messages. */
(function(){
var box=document.querySelector('[data-demo]'),src=document.getElementById('demo-data');if(!box||!src)return;
var D=JSON.parse(src.textContent),U=D.ui,log=box.querySelector('.demo-log'),toast=box.querySelector('.demo-toast'),busy=false,tt;
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function md(s){return esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\*(.+?)\*/g,'<i>$1</i>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\n/g,'<br>')}
function embed(e){return '<div class=dc-embed style="border-left-color:'+e.color+'"><div class=dc-embed-title>'+md(e.title)+'</div><p>'+md(e.desc)+'</p><div class=dc-footer>'+esc(e.foot)+'</div></div>'}
function btns(list){return '<div class=dc-buttons>'+list.map(function(b){return b.href?'<a class="dc-btn" href="'+b.href+'" target=_blank rel=noopener>'+esc(b.t)+' ↗</a>':'<button type=button class="dc-btn'+(b.k?' dc-btn-'+b.k:'')+'" data-act="'+(b.a||'')+'">'+esc(b.t)+'</button>'}).join('')+'</div>'}
function msg(cmd,inner,eph){var m=document.createElement('div');m.className='dc-msg demo-in';
 m.innerHTML='<span class="dc-avatar demo-av" aria-hidden=true>✦</span><div class=dc-body><div class=dc-used><b>Mira</b> '+esc(U.used)+' <span class=dc-used-cmd>'+esc(cmd)+'</span></div><div class=dc-meta><b class=bot-name>Lumo</b><span class=dc-tag>APP</span></div>'+inner+(eph?'<div class=dc-eph>'+esc(U.eph)+'</div>':'')+'</div>';return m}
function say(t){toast.textContent=t;toast.hidden=false;clearTimeout(tt);tt=setTimeout(function(){toast.hidden=true},4200)}
function watchBtns(){return D.watch_btns.map(function(t,i){return{t:t,k:'success',a:'catch:'+D.stars[i]}}).concat([{t:D.details,a:'details'}])}
var R={
 watch:function(){return msg('/sky watch',embed(D.watch)+btns(watchBtns()))},
 daily:function(){return msg('/coins daily',embed(D.daily),1)},
 rank:function(){return msg('/rank','<img class=demo-card src="'+box.getAttribute('data-rank')+'" width=360 height=215 alt="'+esc(U.rank_alt)+'">')},
 vote:function(){return msg('/vote',embed(D.vote)+btns([{t:D.vote.btn,href:'https://top.gg/bot/1545140271073722378/vote'}]))},
 play:function(){return msg('/play query: outer space loop','<p class=dc-reply>'+md(D.play.reply)+'</p>'+embed(D.play)+btns([{t:'⏸️ Pause',a:'music'},{t:'⏭️ Skip',a:'music'},{t:'⏹️ Stop',k:'danger',a:'music'},{t:'📜 Queue',a:'music'}]),0)}
};
function add(m){log.appendChild(m);while(log.children.length>6)log.removeChild(log.firstElementChild);log.scrollTop=log.scrollHeight}
box.querySelector('.demo-cmds').addEventListener('click',function(e){var b=e.target.closest('button[data-cmd]');if(!b||busy)return;busy=true;
 var ty=document.createElement('div');ty.className='demo-typing';ty.textContent=U.thinking;log.appendChild(ty);log.scrollTop=log.scrollHeight;
 setTimeout(function(){ty.remove();add(R[b.getAttribute('data-cmd')]());busy=false},matchMedia('(prefers-reduced-motion: reduce)').matches?0:650)});
log.addEventListener('click',function(e){var b=e.target.closest('button[data-act]');if(!b)return;var a=b.getAttribute('data-act'),m=b.closest('.dc-msg');
 if(a.indexOf('catch:')===0){if(m.dataset.caught){say(U.more);return}var s=a.slice(6),af=D.after[s];m.dataset.caught=s;
  var body=m.querySelector('.dc-body');body.querySelectorAll('.dc-embed,.dc-buttons').forEach(function(x){x.remove()});
  var bl=af.btns.map(function(t,i){return D.stars[i]===s?{t:t}:{t:t,k:'success',a:'catch:'+D.stars[i]}}).concat([{t:D.details,a:'details'}]);
  body.insertAdjacentHTML('beforeend',embed(D.catch[s])+embed(af.embed)+btns(bl));log.scrollTop=log.scrollHeight;return}
 say(U[a]||'')});
add(R.watch());
})();
