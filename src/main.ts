type Options = {
  width: number;
  height: number;
};

function setDefaults(given: Partial<Options>) {
  return {
    width: given.width ?? 1920,
    height: given.height ?? 1080,
  };
}

console.log(setDefaults({ width: 1 }));
