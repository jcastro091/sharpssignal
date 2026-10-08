const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 let source=fs.readFileSync('utils/email.js','utf8').replace("import { Resend } from 'resend';",'const Resend=class { emails={send:async payload=>{globalThis.__emailPayload=payload;return globalThis.__emailResponse;}} };');
 const {sendEmail}=await import('data:text/javascript,'+encodeURIComponent(source));
 process.env.RESEND_FROM='SharpsSignal <notifications@sharps-signal.com>';
 process.env.RESEND_REPLY_TO='SharpsSignal@gmail.com';
 globalThis.__emailResponse={data:{id:'test-only'}};
 assert.equal((await sendEmail({from:'old@example.invalid',to:'test@example.invalid',subject:'Test',html:'test'})).id,'test-only');
 assert.equal(globalThis.__emailPayload.from,process.env.RESEND_FROM);
 assert.equal(globalThis.__emailPayload.replyTo,'SharpsSignal@gmail.com');
 globalThis.__emailResponse={error:{message:'private provider detail'}};
 await assert.rejects(()=>sendEmail({to:'test@example.invalid'}),/^Error: Email provider rejected the request$/);
 delete process.env.RESEND_FROM;
 await assert.rejects(()=>sendEmail({to:'test@example.invalid'}),/sender is not configured/);
 console.log('Email sender, reply-to, rejection and missing-config checks passed. No messages sent.');
})();
