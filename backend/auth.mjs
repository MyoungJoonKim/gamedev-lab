import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
const token=()=>randomBytes(32).toString('base64url');
const hash=s=>createHash('sha256').update(s).digest('hex');
export function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);}
function cookie(req,name){try{return (req.headers.cookie||'').split(';').map(x=>x.trim().split('=')).find(([key])=>key===name)?.[1]||'';}catch{return '';}}
export function createAuth(store,config,{fetcher=fetch}={}){
 const sessionCookie='__Host-gdl_session',oauthCookie='__Host-gdl_oauth';
 const cookieValue=(name,value,maxAge)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
 const origin=config.publicUrl;
 const clearOauth=cookieValue(oauthCookie,'',0);
 function session(req){const raw=cookie(req,sessionCookie);if(!/^[\w-]{43}$/.test(raw))return null;return store.session(hash(raw));}
 return {
  session,
  canWrite(req,s){return req.headers.origin===origin&&equal(req.headers['x-csrf-token'],s.csrf)&&req.headers['content-type']==='application/json';},
  begin(res){const state=token(),verifier=token();store.putOauth(hash(state),verifier);
   const params=new URLSearchParams({client_id:config.clientId,redirect_uri:origin+'/auth/github/callback',scope:'read:user',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
   res.writeHead(302,{'Location':'https://github.com/login/oauth/authorize?'+params,'Set-Cookie':cookieValue(oauthCookie,state,600),'Cache-Control':'no-store'}).end();
  },
  async callback(req,res,url){
   const state=url.searchParams.get('state'),code=url.searchParams.get('code');
   if(!state||!code||code.length>1000||!equal(cookie(req,oauthCookie),state))throw Error('로그인 요청이 만료되었거나 일치하지 않습니다. 다시 로그인하세요.');
   const pending=store.takeOauth(hash(state));if(!pending)throw Error('이미 사용했거나 만료된 로그인입니다.');
   const response=await fetcher('https://github.com/login/oauth/access_token',{method:'POST',redirect:'error',headers:{'Accept':'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,code,code_verifier:pending.verifier,redirect_uri:origin+'/auth/github/callback'}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('GitHub 로그인 교환에 실패했습니다. 다시 시도하세요.');const credentials=await response.json();
   if(typeof credentials.access_token!=='string'||credentials.error)throw Error('GitHub에서 로그인을 승인하지 않았습니다.');
   const userResponse=await fetcher('https://api.github.com/user',{redirect:'error',headers:{'Authorization':'Bearer '+credentials.access_token,'Accept':'application/vnd.github+json','User-Agent':'GameDev-Lab'},signal:AbortSignal.timeout(10000)});
   if(!userResponse.ok)throw Error('GitHub 계정을 확인하지 못했습니다.');
   const user=await userResponse.json();if(!Number.isSafeInteger(user.id)||typeof user.login!=='string')throw Error('GitHub 사용자 응답을 확인하지 못했습니다.');
   const id=String(user.id),pinned=store.owner();
   if(config.allowedId?id!==config.allowedId:pinned?id!==pinned:user.login.toLowerCase()!==config.allowedLogin.toLowerCase())throw Error('이 사이트 소유자의 GitHub 계정만 로그인할 수 있습니다.');
   if(!store.pinOwner(id))throw Error('사이트 소유자와 다른 계정입니다.');
   const raw=token(),csrf=token();store.createSession(hash(raw),id,user.login,csrf);
   res.writeHead(302,{'Location':'/','Set-Cookie':[cookieValue(sessionCookie,raw,7*86400),clearOauth],'Cache-Control':'no-store'}).end();
  },
  logout(req,res){store.deleteSession(hash(cookie(req,sessionCookie)));res.writeHead(204,{'Set-Cookie':cookieValue(sessionCookie,'',0),'Cache-Control':'no-store'}).end();}
 };
}
export function hostedConfig(env){
 const publicUrl=(env.PUBLIC_BASE_URL||env.RENDER_EXTERNAL_URL||'').replace(/\/$/,'');
 let url;try{url=new URL(publicUrl);}catch{throw Error('PUBLIC_BASE_URL에 배포한 HTTPS 주소를 설정하세요.');}
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('PUBLIC_BASE_URL은 경로 없는 HTTPS 주소여야 합니다.');
 if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET)throw Error('GitHub OAuth App의 Client ID와 Client Secret이 필요합니다.');
 const allowedId=env.ALLOWED_GITHUB_ID||'',allowedLogin=env.ALLOWED_GITHUB_LOGIN||'';
 if(allowedId?!/^\d+$/.test(allowedId):!/^[-\w]{1,39}$/.test(allowedLogin))throw Error('ALLOWED_GITHUB_ID 또는 ALLOWED_GITHUB_LOGIN을 설정하세요.');
 if(env.GRADER_BACKEND!=='judge0')throw Error('서버 모드에서는 Judge0 격리 채점 서비스를 지정해야 합니다.');
 if(env.GRADER_BACKEND==='judge0'){
  const endpoint=new URL(env.JUDGE0_URL||'');if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw Error('JUDGE0_URL에 인증 정보 없는 HTTPS API 주소를 설정하세요.');
  if(endpoint.hostname.endsWith('.p.rapidapi.com')&&!env.JUDGE0_RAPIDAPI_KEY)throw Error('관리형 채점 서비스의 RapidAPI 키를 설정하세요.');
  if(env.JUDGE0_RAPIDAPI_KEY&&!endpoint.hostname.endsWith('.p.rapidapi.com'))throw Error('RapidAPI 키를 전송할 대상 호스트를 확인하세요.');
  if(!Number.isInteger(Number(env.JUDGE0_LANGUAGE_ID))||Number(env.JUDGE0_LANGUAGE_ID)<=0)throw Error('JUDGE0_LANGUAGE_ID에 사용 중인 C# 실행 환경 ID를 설정하세요.');
 }
 return {publicUrl,allowedId,allowedLogin,clientId:env.GITHUB_CLIENT_ID,clientSecret:env.GITHUB_CLIENT_SECRET};
}
