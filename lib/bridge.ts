// Injected into every served HTML file. Phase 1: report which [data-screen] is visible.
// It never reads parent state, never makes network calls and ignores incoming messages.
export const BRIDGE_JS = `(function(){
var last=null;
function visible(el){var r=el.getBoundingClientRect();var s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;}
function current(){var els=document.querySelectorAll('[data-screen]');for(var i=0;i<els.length;i++){if(visible(els[i]))return els[i].getAttribute('data-screen');}return null;}
function report(){var id=current();if(id!==last){last=id;try{window.parent.postMessage({type:'screen',id:id},'*');}catch(e){}}}
document.addEventListener('DOMContentLoaded',report);
window.addEventListener('load',report);
window.addEventListener('hashchange',report);
new MutationObserver(report).observe(document.documentElement,{attributes:true,childList:true,subtree:true});
report();
})();`;
