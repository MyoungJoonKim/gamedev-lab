import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {validateBackup} from '../site/lib/model.js';
export const emptyState=()=>({version:1,drafts:{},history:[],diagnosis:null});
export class Store {
 constructor(filename){
  if(filename!==':memory:')mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});
  this.db=new DatabaseSync(filename);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS owner (singleton INTEGER PRIMARY KEY CHECK(singleton=1), github_id TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, github_id TEXT NOT NULL, login TEXT NOT NULL, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS oauth (state TEXT PRIMARY KEY, verifier TEXT NOT NULL, expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS learning (github_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, content TEXT NOT NULL);
  `);
 }
 pinOwner(id){const current=this.db.prepare('SELECT github_id FROM owner WHERE singleton=1').get();if(current)return current.github_id===id;this.db.prepare('INSERT INTO owner VALUES (1,?)').run(id);return true;}
 owner(){return this.db.prepare('SELECT github_id FROM owner WHERE singleton=1').get()?.github_id;}
 putOauth(state,verifier){this.db.prepare('DELETE FROM oauth WHERE expires < ?').run(Date.now());if(this.db.prepare('SELECT COUNT(*) AS n FROM oauth').get().n>=100){const e=Error('로그인 요청이 많습니다. 잠시 후 다시 시도하세요.');e.status=429;throw e;}this.db.prepare('INSERT INTO oauth VALUES (?,?,?)').run(state,verifier,Date.now()+600000);}
 takeOauth(state){const value=this.db.prepare('SELECT * FROM oauth WHERE state=?').get(state);this.db.prepare('DELETE FROM oauth WHERE state=?').run(state);return value&&value.expires>Date.now()?value:null;}
 createSession(hash,id,login,csrf){this.db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());this.db.prepare('INSERT INTO sessions VALUES (?,?,?,?,?)').run(hash,id,login,csrf,Date.now()+7*86400000);}
 session(hash){return this.db.prepare('SELECT * FROM sessions WHERE hash=? AND expires>?').get(hash,Date.now());}
 deleteSession(hash){this.db.prepare('DELETE FROM sessions WHERE hash=?').run(hash);}
 load(id){const row=this.db.prepare('SELECT revision,content FROM learning WHERE github_id=?').get(id);return row?{revision:row.revision,state:JSON.parse(row.content)}:{revision:0,state:emptyState()};}
 save(id,revision,state){
  validateBackup(state);const content=JSON.stringify(state);if(Buffer.byteLength(content)>5e6)throw Error('학습 기록은 5MB 이하여야 합니다. 백업 후 오래된 이력을 정리하세요.');
  this.db.exec('BEGIN IMMEDIATE');
  try{const current=this.load(id);if(current.revision!==revision){this.db.exec('ROLLBACK');return null;}
   const next=revision+1;this.db.prepare('INSERT INTO learning VALUES (?,?,?) ON CONFLICT(github_id) DO UPDATE SET revision=excluded.revision,content=excluded.content').run(id,next,content);this.db.exec('COMMIT');return next;
  }catch(e){try{this.db.exec('ROLLBACK');}catch{}throw e;}
 }
 close(){this.db.close();}
}
