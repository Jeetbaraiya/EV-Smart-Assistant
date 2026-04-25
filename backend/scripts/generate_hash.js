const bcrypt = require('bcryptjs');
const password = 'Owner@123';
const hash = bcrypt.hashSync(password, 10);

console.log('--------------------------------------------------');
console.log('NEW HASH FOR: ' + password);
console.log(hash);
console.log('--------------------------------------------------');
console.log('\nSQL QUERY TO RUN:');
console.log(`UPDATE users SET password = '${hash}' WHERE username = 'TARGET_USERNAME';`);
console.log('--------------------------------------------------');
