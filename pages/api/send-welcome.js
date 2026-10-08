// Supabase Auth sends confirmation. Paid Telegram invites require verified payment.
export default function(req,res){
 res.setHeader('Cache-Control','no-store');
 return res.status(410).json({ok:false,error:'use_account_confirmation_and_paid_telegram_invite'});
}
