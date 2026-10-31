// Browser-only fixture: never a production entry point; no real GitHub credentials.
import https from 'node:https';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';
import {requiredTests} from '../site/lib/model.js';
const env={APP_MODE:'hosted',PUBLIC_BASE_URL:'https://localhost:3443',DATA_DIR:process.env.TEST_DATA_DIR,GITHUB_CLIENT_ID:'fixture-client',GITHUB_CLIENT_SECRET:'fixture-only',ALLOWED_GITHUB_LOGIN:'MyoungJoonKim',GRADER_BACKEND:'judge0',JUDGE0_URL:'https://judge.test',JUDGE0_LANGUAGE_ID:'51'};
const app=createApp({env,authFetch:async(url)=>Response.json(url.endsWith('/access_token')?{access_token:'fixture-only'}:{id:77,login:'MyoungJoonKim'}),runIsolated:async(id,source)=>({report:{schemaVersion:1,problemId:id,source,runner:'Browser fixture - not executed code',tests:requiredTests[id].map(name=>({name,status:'passed',actual:'fixture'}))}})});
const server=https.createServer({key:await readFile(process.env.TEST_KEY),cert:await readFile(process.env.TEST_CERT)},app.listeners('request')[0]);
server.listen(3443,'127.0.0.1',()=>console.log('Hosted browser fixture started'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit()));
