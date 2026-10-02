import AuthScreenPage from "../auth-screen";
export const dynamic="force-dynamic";
export default function Page({searchParams}:{searchParams:Promise<{weiter?:string;fehler?:string}>}){return <AuthScreenPage screen="reset" searchParams={searchParams}/>;}
