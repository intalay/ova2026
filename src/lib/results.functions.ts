import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';
export const getResultsPage=createServerFn({method:'GET'}).inputValidator(input=>z.object({page:z.number().int().min(1),pageSize:z.number().int().min(1).max(50)}).parse(input)).handler(async({data})=>{
 const key=process.env['SUPABASE_PUBLISHABLE_KEY']??process.env['SUPABASE_ANON_KEY'];const url=process.env['SUPABASE_URL'];if(!key||!url)throw new Error('Results source unavailable');
 const client=createClient<Database>(url,key,{auth:{persistSession:false},global:{fetch:(input,init)=>{const h=new Headers(init?.headers);if(key.startsWith('sb_')&&h.get('Authorization')===`Bearer ${key}`)h.delete('Authorization');h.set('apikey',key);return fetch(input,{...init,headers:h});}}});
 const now=new Date();const start=new Date(now);start.setUTCMonth(start.getUTCMonth()-3);const from=(data.page-1)*data.pageSize;
 const {data:matches,error,count}=await client.from('matches').select('*',{count:'exact'}).eq('status','final').gte('source_date',start.toISOString().slice(0,10)).lte('source_date',now.toISOString().slice(0,10)).order('source_date',{ascending:false}).order('id').range(from,from+data.pageSize-1);
 if(error)throw new Error('Could not load results. Please try again.');return {matches:matches??[],total:count??0};
});
