// Characters without ambiguous letters/numbers: O, 0, I, 1, L
const CHARACTERS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

const generateJoinCode = (length = 6) => {
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * CHARACTERS.length);
    result += CHARACTERS[randomIndex];
  }
  return result;
};

module.exports = {
  generateJoinCode,
};
