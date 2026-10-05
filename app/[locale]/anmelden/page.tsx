import AuthScreenPage from "@/app/auth-screen";
export const dynamic="force-dynamic";
export default function Page({searchParams,params}:{params:Promise<{locale:string}>;searchParams:Promise<{weiter?:string;fehler?:string}>}){return <AuthScreenPage screen="login" searchParams={searchParams} params={params}/>;}
