//@ts-check

// @ts-ignore
const PrerenderManifest = require("./prerender-manifest.json");
// @ts-ignore
const Manifest = require("./manifest.json");
const cloudfrontAdapter = require("./cloudfront-adapter");

const addS3HostHeader = (req, s3DomainName) => {
  req.headers["host"] = [{ key: "host", value: s3DomainName }];
};

const router = (manifest) => {
  const {
    pages: { ssr, html },
  } = manifest;

  const allDynamicRoutes = { ...ssr.dynamic, ...html.dynamic };

  return (path) => {
    if (ssr.nonDynamic[path]) {
      return ssr.nonDynamic[path];
    }

    for (const route in allDynamicRoutes) {
      const { file, regex } = allDynamicRoutes[route];

      const re = new RegExp(regex, "i");
      const pathMatchesRoute = re.test(path);

      if (pathMatchesRoute) {
        return file;
      }
    }

    // path didn't match any route, return error page
    return "pages/_error.js";
  };
};

const normaliseUri = (uri) => (uri === "/" ? "/index" : uri);

exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  process.env = process.env || {};
  Object.keys(request.origin.s3.customHeaders).forEach((header) => {
    if (header.toLowerCase().startsWith("x-env-")) {
      const envName = header.replace("x-env-", "").toUpperCase();
      process.env[envName] = request.origin.s3.customHeaders[header][0].value;
    }
  });
  const uri = normaliseUri(request.uri);
  const manifest = Manifest;
  const prerenderManifest = PrerenderManifest;
  const { pages, publicFiles } = manifest;

  const isStaticPage = pages.html.nonDynamic[uri];
  const isPublicFile = publicFiles[uri];
  const isPrerenderedPage = prerenderManifest.routes[request.uri]; // prerendered pages are also static pages like "pages.html" above, but are defined in the prerender-manifest

  const origin = request.origin;
  const s3Origin = origin.s3;

  const isHTMLPage = isStaticPage || isPrerenderedPage;

  if (isHTMLPage || isPublicFile) {
    s3Origin.path = isHTMLPage ? "/static-pages" : "/public";

    if (isHTMLPage) {
      addS3HostHeader(request, s3Origin.domainName);
      request.uri = uri + ".html";
    }

    return request;
  }

  const pagePath = router(manifest)(uri);

  if (pagePath.endsWith(".html")) {
    s3Origin.path = "/static-pages";
    request.uri = pagePath.replace("pages", "");
    addS3HostHeader(request, s3Origin.domainName);
    return request;
  }

  const { req, res, responsePromise } = cloudfrontAdapter(event.Records[0].cf);

  // eslint-disable-next-line
  const page = require(`./${pagePath}`);
  page.render(req, res);

  return responsePromise;
};
