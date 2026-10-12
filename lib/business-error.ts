import {ValidationError} from "./validation-error";
import type {ErrorCode} from "./i18n/codes";

export class BusinessError extends ValidationError{constructor(message:string,public status=409,code:ErrorCode="conflict"){super(code,message);}}
