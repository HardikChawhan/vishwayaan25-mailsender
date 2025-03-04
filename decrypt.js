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
const encryptedData = 'fd681527d842c233a1c24d01755cd60778e5f32c7befe1fe9c4abf5e66bf3fc7383794cbbc47c1eeb5a95432bdda310601e58f4a91bd3979ba9ed8172b09bce026533d680af0efedc2340b7c7bbfb18cb13e4c9b8a2610f7b7024befc61349ea4ce9798a3ae17985bf92312a9d2cdb5af561f4cf4da7dd8ff3b8c8c4bbb27c4cb8325fcdde798aa5d4305c9b8531c0037b607ab6966440936fe697d2df9b92cf8bb6c41586e69d227c4da80b86e9cea41c3b85d82ee4d1fe44462dbe45c9dabd399883dd4186020d17d86d7a1f8337306d57ddd24dfcce401a78e197b5102f672a6d3e4f33fd7ffdd82a9efdab2cd167f0c6a8b476c1149fcfa7e5c249b6cfce03c60d5bc0c5e6b66aaaa2d10da01b6b';

try {
  const decryptedData = decryptData(encryptedData);
  console.log('Decrypted data:', decryptedData);
} catch (err) {
  console.error('Error decrypting data:', err);
}