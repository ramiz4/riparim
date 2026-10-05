import {LoaderCircle} from "lucide-react";

export default function Loading(){
 return <main className="workshop-page wrap"><div className="review-loading" role="status"><LoaderCircle size={18} className="spin" aria-hidden="true"/>Werkstattprofil wird geladen …</div></main>;
}
