import Jimp from 'jimp';

const file = await Jimp.read('data/feynman.jpg');
const settings = { width: 1920, height: 1080 };

const result = file.contain(settings.width, settings.height)
  .background(0xaaaaaaff)
  .greyscale()
  .write('data/output.jpg');
