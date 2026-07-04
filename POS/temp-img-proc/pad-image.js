const Jimp = require('jimp');

async function processImage() {
  try {
    // 1. Read the original rectangular logo
    const image = await Jimp.read('../assets/images/logo.png');
    
    // 2. Calculate the dimension for a perfect square (padding it by 1.5x of its largest side so it has nice whitespace around it)
    const size = Math.floor(Math.max(image.bitmap.width, image.bitmap.height) * 1.5);
    
    // 3. Create a new pure white square canvas
    const square = new Jimp(size, size, '#ffffff');
    
    // 4. Paste the original logo perfectly in the center of the white canvas
    square.composite(image, (size - image.bitmap.width) / 2, (size - image.bitmap.height) / 2);
    
    // 5. Overwrite the icons with this new perfectly padded square image
    await square.writeAsync('../assets/images/icon.png');
    await square.writeAsync('../assets/images/splash-icon.png');
    await square.writeAsync('../assets/images/android-icon-foreground.png');
    
    console.log('Successfully padded logo to a white square!');
  } catch (err) {
    console.error('Error processing image:', err);
  }
}

processImage();
