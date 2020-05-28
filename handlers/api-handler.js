// @ts-check

// @ts-ignore
const manifest = require("./manifest.json");
const cloudfrontAdapter = require("./cloudfront-adapter");

const normaliseUri = (uri) => (uri === "/" ? "/index" : uri);

const router = (manifest) => {
  const {
    apis: { dynamic, nonDynamic },
  } = manifest;

  return (path) => {
    if (nonDynamic[path]) {
      return nonDynamic[path];
    }

    for (const route in dynamic) {
      const { file, regex } = dynamic[route];

      const re = new RegExp(regex, "i");
      const pathMatchesRoute = re.test(path);

      if (pathMatchesRoute) {
        return file;
      }
    }

    return "pages/_error.js";
  };
};

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

  const pagePath = router(manifest)(uri);

  // eslint-disable-next-line
  const page = require(`./${pagePath}`);
  const { req, res, responsePromise } = cloudfrontAdapter(event.Records[0].cf);

  page.default(req, res);

  return responsePromise;
};
