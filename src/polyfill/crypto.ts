import * as Crypto from 'expo-crypto';

// Polyfill for crypto.getRandomValues
if (!global.crypto) {
  global.crypto = {
    // @ts-ignore
    getRandomValues: (array) => Crypto.getRandomValues(array),
  };
}
