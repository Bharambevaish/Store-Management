const TWILIO_SID = process.env.TWILIO_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE;

exports.sendMessage = async (to, message) => {
  console.log(`[SMS/WhatsApp Service] Sending message to ${to}...`);
  console.log(`[SMS/WhatsApp Service] Content: "${message}"`);
  
  if (TWILIO_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE) {
    try {
      const twilio = require('twilio');
      const client = twilio(TWILIO_SID, TWILIO_AUTH_TOKEN);
      const res = await client.messages.create({
        body: message,
        from: TWILIO_PHONE,
        to: to
      });
      console.log(`[SMS/WhatsApp Service] Sent successfully via Twilio, SID: ${res.sid}`);
      return { success: true, provider: 'twilio', sid: res.sid };
    } catch (err) {
      console.error('[SMS/WhatsApp Service] Twilio delivery failed:', err.message);
      return { success: false, error: err.message };
    }
  } else {
    console.log('[SMS/WhatsApp Service] Twilio credentials not fully set. Logged message above (Mock Mode).');
    return { success: true, provider: 'mock' };
  }
};

exports.sendOrderCreated = async (mobile, orderRef, amount) => {
  const msg = `Hello! Your order ${orderRef} for Rs.${amount} has been successfully placed. We will notify you once it's out for delivery.`;
  return this.sendMessage(mobile, msg);
};

exports.sendOutForDelivery = async (mobile, orderRef) => {
  const msg = `Good news! Your order ${orderRef} is out for delivery.`;
  return this.sendMessage(mobile, msg);
};

exports.sendOrderDelivered = async (mobile, orderRef) => {
  const msg = `Your order ${orderRef} has been delivered successfully. Thank you for choosing us!`;
  return this.sendMessage(mobile, msg);
};

exports.sendPaymentReceived = async (mobile, amount) => {
  const msg = `We have received your payment of Rs.${amount}. Thank you!`;
  return this.sendMessage(mobile, msg);
};
