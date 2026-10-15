// Form Validation Helpers for Medical Stock & Pharmacy ERP

export const validateName = (name, fieldName = 'Name', min = 2, max = 100, required = true) => {
  if (!name || !name.toString().trim()) {
    return required ? `${fieldName} is required` : '';
  }
  const clean = name.toString().trim();
  if (clean.length < min) {
    return `${fieldName} must be at least ${min} characters long`;
  }
  if (clean.length > max) {
    return `${fieldName} cannot exceed ${max} characters`;
  }
  // Allow letters, spaces, period, hyphen, apostrophe, ampersand
  if (!/^[a-zA-Z\s.'&-]+$/.test(clean)) {
    return `${fieldName} can only contain letters, spaces, dots, hyphens, and ampersands`;
  }
  if (/\s{2,}/.test(name)) {
    return `${fieldName} cannot contain consecutive spaces`;
  }
  return '';
};

export const validateProductName = (name, fieldName = 'Product Name', min = 2, max = 100, required = true) => {
  if (!name || !name.toString().trim()) {
    return required ? `${fieldName} is required` : '';
  }
  const clean = name.toString().trim();
  if (clean.length < min) {
    return `${fieldName} must be at least ${min} characters long`;
  }
  if (clean.length > max) {
    return `${fieldName} cannot exceed ${max} characters`;
  }
  // Allow letters, numbers, spaces, (), /, -, ., +, %
  if (!/^[a-zA-Z0-9\s()/.\-+%]+$/.test(clean)) {
    return `${fieldName} contains invalid special characters`;
  }
  if (/\s{2,}/.test(name)) {
    return `${fieldName} cannot contain consecutive spaces`;
  }
  return '';
};

export const validateCategory = (cat, fieldName = 'Category', required = true) => {
  if (!cat || !cat.toString().trim()) {
    return required ? `${fieldName} is required` : '';
  }
  const clean = cat.toString().trim();
  // Allow letters, numbers, spaces, &, -, /
  if (!/^[a-zA-Z0-9\s&/-]+$/.test(clean)) {
    return `${fieldName} can only contain letters, numbers, spaces, &, -, and /`;
  }
  return '';
};

export const validateUnit = (unit, fieldName = 'Unit', required = true) => {
  if (!unit || !unit.toString().trim()) {
    return required ? `${fieldName} is required` : '';
  }
  const clean = unit.toString().trim();
  if (/^\d+$/.test(clean)) {
    return `${fieldName} cannot be a numeric-only value (use e.g. strip, tablet, bottle, ml, etc.)`;
  }
  return '';
};

export const sanitizeNameInput = (val) => {
  if (typeof val !== 'string') return val;
  return val.replace(/[^a-zA-Z\s.'&-]/g, '');
};

export const sanitizeNumericInput = (val, maxLength) => {
  if (!val && val !== 0) return '';
  const digitsOnly = val.toString().replace(/\D/g, '');
  if (maxLength) {
    return digitsOnly.slice(0, maxLength);
  }
  return digitsOnly;
};

export const sanitizePriceInput = (val) => {
  if (!val && val !== 0) return '';
  let str = val.toString().replace(/[^0-9.]/g, '');
  const parts = str.split('.');
  if (parts.length > 2) {
    str = parts[0] + '.' + parts.slice(1).join('');
  }
  if (parts.length === 2 && parts[1].length > 2) {
    str = parts[0] + '.' + parts[1].slice(0, 2);
  }
  return str;
};

export const validateMobile = (mobile, required = true) => {
  if (!mobile || !mobile.toString().trim()) {
    return required ? 'Mobile number is required' : '';
  }
  const clean = mobile.toString().trim();
  if (!/^\d{10}$/.test(clean)) {
    return 'Enter a valid 10-digit mobile number';
  }
  return '';
};

export const validateEmail = (email, required = false) => {
  if (!email || !email.trim()) {
    return required ? 'Email is required' : '';
  }
  const clean = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clean)) {
    return 'Invalid email address format';
  }
  return '';
};

export const validateGST = (gst, required = false) => {
  if (!gst || !gst.trim()) {
    return required ? 'GST number is required' : '';
  }
  const clean = gst.trim().toUpperCase();
  if (clean.length !== 15) {
    return 'GST number must be exactly 15 characters';
  }
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstRegex.test(clean)) {
    return 'Invalid GST number format (e.g., 27AAAAA0000A1Z5)';
  }
  return '';
};

export const validatePAN = (pan, required = false) => {
  if (!pan || !pan.trim()) {
    return required ? 'PAN number is required' : '';
  }
  const clean = pan.trim().toUpperCase();
  if (clean.length !== 10) {
    return 'PAN number must be exactly 10 characters';
  }
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(clean)) {
    return 'Invalid PAN format (e.g., ABCDE1234F)';
  }
  return '';
};

export const validateHSN = (hsn, required = false) => {
  if (!hsn || !hsn.toString().trim()) {
    return required ? 'HSN code is required' : '';
  }
  const clean = hsn.toString().trim();
  if (!/^(?:\d{4}|\d{6}|\d{8})$/.test(clean)) {
    return 'HSN Code must be exactly 4, 6, or 8 digits';
  }
  return '';
};

export const validatePositiveNumber = (val, fieldName = 'Value', allowZero = true) => {
  if (val === '' || val === null || val === undefined) {
    return `${fieldName} is required`;
  }
  const num = Number(val);
  if (isNaN(num)) {
    return `${fieldName} must be a valid number`;
  }
  if (allowZero && num < 0) {
    return `${fieldName} cannot be negative`;
  }
  if (!allowZero && num <= 0) {
    return `${fieldName} must be greater than 0`;
  }
  return '';
};

export const validateRetailVsPurchase = (purchasePrice, retailPrice) => {
  const p = Number(purchasePrice);
  const r = Number(retailPrice);
  if (!isNaN(p) && !isNaN(r) && r < p) {
    return 'Retail Price cannot be less than Purchase Price';
  }
  return '';
};

export const validateMRPvsRetail = (retailPrice, mrp) => {
  const r = Number(retailPrice);
  const m = Number(mrp);
  if (!isNaN(r) && !isNaN(m) && m < r) {
    return 'MRP cannot be less than Retail Price';
  }
  return '';
};

export const validateExpiryVsMfgDate = (mfgDate, expiryDate) => {
  if (!mfgDate || !expiryDate) return '';
  const mfg = new Date(mfgDate);
  const exp = new Date(expiryDate);
  if (exp <= mfg) {
    return 'Expiry Date must be strictly after Manufacturing Date';
  }
  return '';
};

export const validateDropdownSelect = (val, fieldName = 'Option') => {
  if (!val || val === '' || val === 'Select' || val.toString().startsWith('Select')) {
    return `Please select a valid ${fieldName}`;
  }
  return '';
};

export const validatePassword = (password, minLength = 6, maxLength = 100) => {
  if (!password) return 'Password is required';
  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters long`;
  }
  if (password.length > maxLength) {
    return `Password cannot exceed ${maxLength} characters`;
  }
  return '';
};

export const validateRequired = (val, fieldName = 'Field') => {
  if (!val || (typeof val === 'string' && !val.trim())) {
    return `${fieldName} is required`;
  }
  return '';
};

export const sanitizeTextareaInput = (val, maxLength = 500) => {
  if (typeof val !== 'string') return val;
  const clean = val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  return clean.slice(0, maxLength);
};

export const trimObjectValues = (obj) => {
  const trimmed = {};
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      trimmed[key] = obj[key].trim();
    } else {
      trimmed[key] = obj[key];
    }
  }
  return trimmed;
};
