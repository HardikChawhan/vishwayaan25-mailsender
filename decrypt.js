const crypto = require('crypto');
require('dotenv').config();

const AES_KEY = process.env.AES_KEY;
const AES_IV = process.env.AES_IV;

function decryptData(encryptedData) {
  const decipher = crypto.createDecipheriv('aes-128-cbc', AES_KEY, AES_IV);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Example encrypted data (replace this with your actual encrypted data)
const encryptedData = 'c6bc3c27e15ce96f841bdead8bf6b9be39b33c49f5bff0dc5c0a3e9c6bc7c2eb1de46e11825fb068e9d9732fe436d50e4790b51aadefb2d7b1c001d8853df7041334842de1dda6ebe07cb327e4009c250b0de34636d239d9702cfac5149c33befec435cc4165e73b451f74f5afebfb2045b50ff5729d2b03845da0b99e4e3c954f101f547652870d78a60d73cb78eb86d0671b8281692d840598bd6cdde5e6b94128875132710544d30ce4bfeadc965825a4738ba539feeaf992699ce70a0941d511849bdd4575e89525f94cc34c80b2';

try {
  const decryptedData = decryptData(encryptedData);
  console.log('Decrypted data:', decryptedData);
} catch (err) {
  console.error('Error decrypting data:', err);
}