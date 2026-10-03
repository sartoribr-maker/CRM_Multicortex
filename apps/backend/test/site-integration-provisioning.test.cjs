'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
// Import helpers only; the CLI main and every persistence operation stay mocked.
const original=Module._load;
Module._load=function(name,...args){
 if(name==='../src/users/dto/create-user.dto')return {CreateUserDto:class {}};
 if(name==='../src/users/users.service')return {UsersService:class {create(){throw Error('Unexpected creation');}}};
 if(name==='../src/audit/audit.service')return {AuditService:class {}};
 return original.call(this,name,...args);
};
const {readConfiguration,prerequisites,createAccount,readHidden}=require('../scripts/create-site-integration-user.cjs');
Module._load=original;
const env={CRM_INTEGRATION_EMAIL:'integration@example.test',CRM_INTEGRATION_ROLE_ID:'11111111-1111-4111-8111-111111111111',CRM_PROVISION_DATABASE_URL:'postgresql://fixture@db.example.test:6543/approved'};
const config=readConfiguration(env);
const role={id:config.roleId,name:'Configured role',deletedAt:null,permissions:[{permission:{key:'leads.create',deletedAt:null}}]};
const existing={status:'ACTIVE',deletedAt:null,mustChangePassword:false,role};
test('configuration is mandatory, validated and keeps the approved destination',()=>{
 assert.equal(config.databaseUrl,env.CRM_PROVISION_DATABASE_URL);assert.equal(config.email,env.CRM_INTEGRATION_EMAIL);
 for(const key of ['CRM_INTEGRATION_EMAIL','CRM_INTEGRATION_ROLE_ID','CRM_PROVISION_DATABASE_URL'])assert.throws(()=>readConfiguration({...env,[key]:undefined}));
 for(const changes of [{CRM_INTEGRATION_EMAIL:'bad'},{CRM_INTEGRATION_ROLE_ID:'bad'},{CRM_PROVISION_DATABASE_URL:'https://db.example.test'},{CRM_PROVISION_DATABASE_URL:'postgresql://host/'}])assert.throws(()=>readConfiguration({...env,...changes}));
});
test('only leads.create role is accepted and divergent existing accounts fail closed',async()=>{
 const db=(r,u)=>({role:{findUnique:async()=>r},user:{findUnique:async()=>u}});
 assert.equal(await prerequisites(db(role,existing),config),existing);
 for(const r of [null,{...role,deletedAt:new Date()},{...role,permissions:[...role.permissions,{permission:{key:'users.create'}}]},{...role,permissions:[{permission:{key:'leads.create',deletedAt:new Date()}}]}])await assert.rejects(prerequisites(db(r,null),config));
 for(const u of [{...existing,status:'INACTIVE'},{...existing,mustChangePassword:true},{...existing,role:{...role,id:'other'}}])await assert.rejects(prerequisites(db(role,u),config));
});
test('idempotency does not create or update the existing account; password cleared',async()=>{
 const tx={role:{findUnique:async()=>role},user:{findUnique:async()=>existing}};
 const dto={password:'fixture-only'};const result=await createAccount({$transaction:async fn=>fn(tx)},dto,config);
 assert.equal(result.created,false);assert.equal(dto.password,'');
});
test('password input rejects pipes and noninteractive terminals',async()=>{
 await assert.rejects(readHidden('Prompt',{isTTY:false},{isTTY:false}));
});
