const SUPABASE_URL = 'https://sryymcdthuonhfupibnl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_SaHEbcFzUHjzlkUbFO80dw_8j5GPrxu';
const API_BASE = 'https://pmes-api-gemini.onrender.com';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id)=>document.getElementById(id);
async function session(){ const { data } = await sb.auth.getSession(); return data.session; }
async function requireLogin(){ const s=await session(); if(!s) location.href='login.html'; return s; }
async function logout(){ await sb.auth.signOut(); location.href='login.html'; }
function fmt(d){ return new Date(d).toLocaleString('pt-BR'); }
async function authHeader(){ const s=await session(); return s ? { Authorization: 'Bearer '+s.access_token } : {}; }
async function api(path, opts={}){ const headers={ 'Content-Type':'application/json', ...(await authHeader()), ...(opts.headers||{}) }; const r=await fetch(API_BASE+path,{...opts,headers}); return r.json(); }
