export type AccountRole="user"|"admin";
export type ManagedUser={
 id:string;email:string;name:string;role:AccountRole;active:boolean;confirmed:boolean;
 createdAt:string|null;lastSignInAt:string|null;providers:string[];protected:boolean;
};
