export function descriptionHtml(html){
  const opening=/<div\b[^>]*\bitemprop\s*=\s*["']description["'][^>]*>/i.exec(html);
  if(!opening)return '';
  const start=opening.index+opening[0].length, tags=/<\/?div\b[^>]*>/gi;
  tags.lastIndex=start;let depth=1;
  for(let tag;(tag=tags.exec(html));){depth+=/^<\//.test(tag[0])?-1:1;if(depth===0)return html.slice(start,tag.index);}
  throw new Error('Unclosed description element');
}

function decode(text){
  const entities={nbsp:' ',thinsp:' ',quot:'"',apos:"'",amp:'&',lt:'<',gt:'>',laquo:'«',raquo:'»',ndash:'–',mdash:'—'};
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(all,value)=>value[0]==='#'?String.fromCodePoint(value[1].toLowerCase()==='x'?parseInt(value.slice(2),16):Number(value.slice(1))):entities[value]??all);
}

export function descriptionParagraphs(html){
  return descriptionHtml(html).replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
    .replace(/<\/?(?:p|li|tr|h[1-6]|div)\b[^>]*>|<br\b[^>]*>/gi,'\n\n').replace(/<\/?(?:td|th)\b[^>]*>/gi,' | ').replace(/<[^>]*>/g,' ')
    .split(/\n+/).map(text=>decode(text).replace(/\s+/g,' ').replace(/\|\s*\|/g,'|').replace(/^\s*\|\s*|\s*\|\s*$/g,'').trim()).filter(Boolean);
}
