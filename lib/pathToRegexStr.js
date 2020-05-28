import { pathToRegexp } from "path-to-regexp";

export default (path) =>
  pathToRegexp(path)
    .toString()
    .replace(/\/(.*)\/\i/, "$1");
