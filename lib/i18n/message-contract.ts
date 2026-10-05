// The same literal-key and interpolation contract applies to each feature catalog.
export type MessageValue=string|{one:string;other:string};
export type ParameterNames<S extends string>=S extends `${string}{${infer Name}}${infer Rest}`?Name|ParameterNames<Rest>:never;
type SameParameters<A extends string,B extends string>=[ParameterNames<A>] extends [ParameterNames<B>]?([ParameterNames<B>] extends [ParameterNames<A>]?true:false):false;
type ValidText<A extends string,B extends string>=B extends ""?never:SameParameters<A,B> extends true?B:never;
type CheckedMessage<Source,Translated>=Source extends string
 ? Translated extends string?ValidText<Source,Translated>:never
 : Source extends {one:infer One extends string;other:infer Other extends string}
  ? Translated extends {one:infer TranslatedOne extends string;other:infer TranslatedOther extends string}
   ? {one:ValidText<One,TranslatedOne>;other:ValidText<Other,TranslatedOther>}:never
  : never;
export type MessageShape<Source>={-readonly [K in keyof Source]:Source[K] extends string?string:{one:string;other:string}};
export type CheckedMessages<Source,Translated>={[K in keyof Source]:K extends keyof Translated?CheckedMessage<Source[K],Translated[K]>:never};
export function defineMessages<Source>(){
 return <const Translated extends MessageShape<Source>>(catalog:Translated&CheckedMessages<Source,Translated>):Translated=>catalog;
}
