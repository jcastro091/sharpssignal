const {test}=require('node:test');const assert=require('node:assert/strict');
const {verifiedSignupText}=require('../lib/signupNotification.cjs');
const now=Date.now(),user={id:'id',email:'synthetic@example.invalid',created_at:new Date(now-1000).toISOString(),user_metadata:{utm_source:'test'}};
test('fresh provider account produces accurate confirmation status',()=>assert.match(verifiedSignupText(user,{user_id:'id',email:user.email},now),/confirmation pending/));
test('existing or spoofed accounts cannot become new-account notices',()=>{
 for(const candidate of [{...user,id:'other'},{...user,created_at:new Date(now-600000).toISOString()},{...user,email:'other@example.invalid'}])assert.throws(()=>verifiedSignupText(candidate,{user_id:'id',email:user.email},now),/not_verified/);
});
