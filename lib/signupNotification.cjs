function verifiedSignupText(user, request, now=Date.now()) {
 const created=Date.parse(user?.created_at);
 if(!user?.id||user.id!==request.user_id||!user.email||user.email.toLowerCase()!==String(request.email||'').trim().toLowerCase()
   ||!Number.isFinite(created)||created>now||now-created>300000||user.is_anonymous)throw Error('signup_not_verified');
 const field=value=>String(value||'-').slice(0,100);
 const meta=user.user_metadata||{};
 return `New account — ${user.email_confirmed_at?'email confirmed':'email confirmation pending'}\n${user.email}\nUTM: ${field(meta.utm_source)}/${field(meta.utm_campaign)}`;
}
module.exports={verifiedSignupText};
