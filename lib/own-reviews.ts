export function reviewSubmissionId(value:unknown):string|null{return typeof value==="string"&&/^[0-9a-f-]{36}$/.test(value)?value:null;}
export function ownReviewsHref(value:unknown=null):string{const id=reviewSubmissionId(value);return `/bewertungen${id?`?einreichung=${encodeURIComponent(id)}`:""}`;}
