// TODO: publicPath
export function filepathToFlatSymbol(filepath: string, publicPath = "/") {
  return publicPath + filepath.replace(/\//g, "_$_");
}
