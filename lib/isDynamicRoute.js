/** @type {(route: string) => boolean} */
export default function isDynamicRoute(route) {
  // Identify /[param]/ in route string
  return /\/\[[^\/]+?\](?=\/|$)/.test(route);
}
