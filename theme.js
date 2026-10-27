/* Theme menu: Dark / Light / Auto, same logic and storage key as lumobot.org (seasonal buttons are handled by assets/lumo-holiday.js). */
(function(){var root=document.documentElement,KEY="aeth-theme",ORDER=["dark","light","auto"],mq=window.matchMedia?matchMedia("(prefers-color-scheme: light)"):null;
function read(){var v="dark";try{v=localStorage.getItem(KEY)||v}catch(e){}return ORDER.indexOf(v)>=0?v:"dark"}
function apply(p){var eff=p==="auto"?(mq&&mq.matches?"light":"dark"):p;root.setAttribute("data-theme-pref",p);root.setAttribute("data-theme",eff);
document.querySelectorAll("[data-theme-set]").forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.themeSet===p))});
var n={dark:"Dark",light:"Light",auto:"Auto"};document.querySelectorAll("[data-theme-menu]").forEach(function(b){b.setAttribute("aria-label","Appearance: "+n[p]+". Theme and seasonal options");b.title="Appearance: "+n[p]})}
if(window.__lumoTheme){window.__lumoTheme();bindMenu();return}
function save(p){try{localStorage.setItem(KEY,p)}catch(e){}apply(p)}
function pop(open,focus){document.querySelectorAll("[data-theme-menu]").forEach(function(b){var m=document.getElementById(b.getAttribute("aria-controls"));if(!m)return;m.hidden=!open;b.setAttribute("aria-expanded",String(open));if(!open&&focus)b.focus()})}
document.addEventListener("click",function(e){var s=e.target.closest("[data-theme-set]");if(s){save(s.dataset.themeSet);return}var b=e.target.closest("[data-theme-menu]");if(b){pop(b.getAttribute("aria-expanded")!=="true");return}if(!e.target.closest(".theme-menu"))pop(false)});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&document.querySelector('[data-theme-menu][aria-expanded="true"]'))pop(false,true)});
if(mq){var f=function(){if(read()==="auto")apply("auto")};mq.addEventListener?mq.addEventListener("change",f):mq.addListener(f)}
window.addEventListener("storage",function(e){if(e.key===KEY)apply(read())});apply(read());window.__lumoTheme=function(){apply(read())};bindMenu();
function bindMenu(){var menu=document.querySelector("details.menu");if(menu)menu.onclick=function(e){if(e.target.closest("a"))menu.removeAttribute("open")}}})();
