/* Clean visible labels without changing product IDs, cart keys or saved settings. */
(() => {
  'use strict';
  const emoji=/\p{Extended_Pictographic}[\uFE0E\uFE0F]?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}[\uFE0E\uFE0F]?(?:\p{Emoji_Modifier})?)*|\p{Regional_Indicator}{1,2}|[\u2605\u2606\u2726-\u2729\u2733\u2734\u2736\u2737\u2743-\u2745][\uFE0E\uFE0F]?/gu;
  const clean=text=>String(text).replace(emoji,match=>/^[©®™]/u.test(match)?match[0]:'').replace(/([0-9#*])[\uFE0E\uFE0F]?\u20E3/gu,'$1');
  const excluded='script,style,textarea,pre,code,svg,[contenteditable="true"]';
  function cleanText(node){
    if(node.parentElement?.closest(excluded))return;
    const next=clean(node.nodeValue);
    if(next!==node.nodeValue)node.nodeValue=next;
  }
  function cleanAttributes(element){
    if(element.closest(excluded))return;
    for(const name of ['alt','title','aria-label','placeholder']){
      const value=element.getAttribute(name);if(value===null)continue;
      const next=clean(value);if(next!==value)element.setAttribute(name,next);
    }
  }
  function cleanNode(node){
    if(node.nodeType===Node.TEXT_NODE){cleanText(node);return;}
    if(node.nodeType!==Node.ELEMENT_NODE||node.closest(excluded))return;
    cleanAttributes(node);
    node.querySelectorAll('[alt],[title],[aria-label],[placeholder]').forEach(cleanAttributes);
    const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
    let text;while((text=walker.nextNode()))cleanText(text);
  }
  const observer=new MutationObserver(records=>{
    observer.disconnect();
    for(const record of records){
      if(record.type==='attributes')cleanAttributes(record.target);
      else if(record.type==='characterData')cleanText(record.target);
      else record.addedNodes.forEach(cleanNode);
    }
    observe();
  });
  function observe(){observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['alt','title','aria-label','placeholder']});}
  cleanNode(document.body);observe();
})();
