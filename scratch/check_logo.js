import fs from 'fs';

function getPngDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error('Not a PNG file');
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

try {
  const dim = getPngDimensions('public/logo_square.png');
  console.log('Real PNG Dimensions:', dim);
} catch (err) {
  console.error('Error:', err);
}
