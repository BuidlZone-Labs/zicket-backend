export function generateOTP(length: number = 6): number {
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10).toString();
  }
  return parseInt(otp, 10);
}
