import {validAccountName} from "@/lib/account-name";

export const reviewTextMaxLength=2000;

export function validReviewRating(rating:unknown):rating is number{
 return typeof rating==="number"&&Number.isInteger(rating)&&rating>=1&&rating<=5;
}

export function validReviewText(review:unknown):boolean{
 return review==null||(typeof review==="string"&&review.trim().length<=reviewTextMaxLength);
}

export function completeReview(review:{display_name:unknown;rating:unknown;review:unknown}):boolean{
 return !!validAccountName(review.display_name)&&validReviewRating(review.rating)&&validReviewText(review.review);
}
