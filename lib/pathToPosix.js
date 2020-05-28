export default function pathToPosix(path) {
  return path.replace(/\\/g, "/");
}
