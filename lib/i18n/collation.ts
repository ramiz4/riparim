import {isLocale,type Locale} from "./locale";

// Native workerd omits SQ ICU. Use the same bounded Latin/SQ ordering in every
// runtime, rather than silently switching alphabet during hydration.
// Primary tailorings: Unicode CLDR standard Albanian collation, sq.xml:
// https://github.com/unicode-org/cldr/blob/main/common/collation/sq.xml
const alphabet=["a","b","c","ç","d","dh","e","ë","f","g","gj","h","i","j","k","l","ll","m","n","nj","o","p","q","r","rr","s","sh","t","th","u","v","w","x","xh","y","z","zh"];
const letters=new Map(alphabet.map((letter,index)=>[letter,index]));
const contractions=new Set(["dh","gj","ll","nj","rr","sh","th","xh","zh"]);
type Token={text:string;letter:number|undefined};
function tokens(value:string,numeric:boolean):Token[]{
 const points=Array.from(value.normalize("NFC")),result:Token[]=[];
 for(let index=0;index<points.length;index++){
  let text=points[index];
  if(numeric&&/^[0-9]$/.test(text)){while(/^[0-9]$/.test(points[index+1]??""))text+=points[++index];}
  else{
   const pair=text+(points[index+1]??""),lower=pair.toLowerCase();
   // Standard CLDR contracts lower/title/upper pairs; mixed lower+upper is not a contraction.
   if(contractions.has(lower)&&(pair===lower||pair===lower.toUpperCase()||pair===lower[0].toUpperCase()+lower[1])){text=pair;index++;}
  }
  const lower=text.toLowerCase(),base=lower==="ç"||lower==="ë"?lower:lower.normalize("NFD").replace(/\p{Mark}/gu,"");
  result.push({text,letter:letters.get(base)});
 }
 return result;
}
export function displayComparator(locale:Locale,numeric=false):(a:string,b:string)=>number{
 const active=isLocale(locale)?locale:"de",ordinary=new Intl.Collator(active==="sq"?"en":active,{numeric});
 if(active!=="sq")return ordinary.compare;
 const primary=new Intl.Collator("en",{numeric,sensitivity:"base"});
 return (a,b)=>{
  const left=tokens(a,numeric),right=tokens(b,numeric);
  for(let index=0;index<Math.min(left.length,right.length);index++){
   const x=left[index],y=right[index],difference=x.letter!==undefined&&y.letter!==undefined?x.letter-y.letter:primary.compare(x.text,y.text);
   if(difference)return difference;
  }
  // Unknown original characters remain untouched and use the supported base
  // collation. Case/secondary accents break only a complete primary equality.
  return left.length-right.length||ordinary.compare(a,b);
 };
}
