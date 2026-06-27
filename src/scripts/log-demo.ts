import '../utils/logger';

console.log('Demo log', {
  email: 'alice@example.com',
  wallet: '0x1234567890abcdef1234567890abcdef',
});
console.info(
  'String message with email alice@example.com and wallet 0xAbCdEf1234567890',
);
console.error(
  new Error(
    'Test error with email bob@sample.org and wallet 0xdeadbeefcafebabe00112233',
  ),
);
