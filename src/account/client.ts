import {createClient} from '@supabase/supabase-js';

export function accountConfig(env:Record<string,string|undefined>){
 const url=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
 return url&&key?{url,key}:null;
}
const config=accountConfig(import.meta.env??{});
export const accountClient=config?createClient(config.url,config.key):null;
