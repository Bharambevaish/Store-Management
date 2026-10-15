const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  companyName: {
    type: String,
    default: 'NARESH ENTERPRISES',
    trim: true,
    maxlength: 150
  },
  state: {
    type: String,
    default: 'Maharashtra',
    trim: true,
    maxlength: 100
  },
  logoUrl: {
    type: String,
    default: '',
    maxlength: 2000
  },
  address: {
    type: String,
    default: 'Office H. No.34/B, No.31L.H. Colony, Beside Govt. ITI, NANDED',
    trim: true,
    maxlength: 500
  },
  email: {
    type: String,
    default: 'contact@nareshenterprises.com',
    trim: true,
    lowercase: true,
    maxlength: 254
  },
  contact: {
    type: String,
    default: '9822311640, 7020317605',
    trim: true,
    maxlength: 100
  },
  gstNumber: {
    type: String,
    default: '',
    trim: true,
    maxlength: 15
  },
  bankDetails: {
    bankName: { type: String, default: 'State Bank of India', maxlength: 150 },
    accountNo: { type: String, default: '12345678901', maxlength: 34 },
    ifscCode: { type: String, default: 'SBIN0001234', maxlength: 20 },
    branch: { type: String, default: 'Shivajinagar Branch', maxlength: 150 }
  },
  smsTemplates: {
    marathi: {
      type: String,
      default: 'प्रिय {customer_name}, तुमचे थकीत बिल {amount} रुपये प्रलंबित आहे. कृपया लवकरात लवकर भरणा करावा. धन्यवाद, {company_name}.',
      maxlength: 2000
    },
    english: {
      type: String,
      default: 'Dear {customer_name}, your outstanding payment of Rs. {amount} is pending. Please pay at the earliest. Thank you, {company_name}.',
      maxlength: 2000
    }
  },
  pdfSettings: {
    billPageSize: {
      type: String,
      enum: ['A4', 'A5', 'LETTER', 'THERMAL_80MM'],
      default: 'A4'
    },
    quotationPageSize: {
      type: String,
      enum: ['A4', 'A5', 'LETTER'],
      default: 'A4'
    },
    billTemplate: {
      type: String,
      enum: ['CLASSIC_MEMO_BOOK', 'MODERN_TAX_INVOICE', 'ELEGANT_MINIMAL', 'THERMAL_POS'],
      default: 'CLASSIC_MEMO_BOOK'
    }
  },
  whatsappProvider: {
    type: String,
    default: 'meta',
    enum: ['meta']
  },
  whatsappPhoneId: {
    type: String,
    default: '',
    maxlength: 100
  },
  whatsappToken: {
    type: String,
    default: '',
    select: false,
    maxlength: 1000
  }
});

const removeProviderSecrets = (_doc, value) => {
  delete value.whatsappToken;
  return value;
};
settingSchema.set('toJSON', { transform: removeProviderSecrets });
settingSchema.set('toObject', { transform: removeProviderSecrets });

module.exports = mongoose.model('Setting', settingSchema);
