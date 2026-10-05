import type {ErrorCode} from "@/lib/i18n/codes";

// Sources assign codes; callers never classify human-readable/provider messages.
export class ValidationError extends Error{
 constructor(readonly code:ErrorCode,message:string){super(message);this.name="ValidationError";}
}
