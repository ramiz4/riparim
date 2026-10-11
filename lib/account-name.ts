export const accountNameMinLength=2;
export const accountNameMaxLength=80;

export function validAccountName(value:unknown):string|null{
 if(typeof value!=="string")return null;
 const name=value.trim();
 return name.length>=accountNameMinLength&&name.length<=accountNameMaxLength?name:null;
}

// Missing provider profile names must never expose an email address in reviews.
export function publicAccountName(value:unknown):string{
 return validAccountName(value)??"Anonym";
}
