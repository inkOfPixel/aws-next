// @ts-check
import React from "react";
import PropTypes from "prop-types";
import { Text, Box, Color } from "ink";
import execa from "execa";
import Spinner from "ink-spinner";
import fse from "fs-extra";
import isDynamicRoute from "../lib/isDynamicRoute";
import { getSortedRoutes } from "../lib/sortedRoutes";
import expressifyDynamicRoute from "../lib/expressifyDynamicRoute";
import pathToRegexStr from "../lib/pathToRegexStr";
import klaw from "klaw";
import path from "path";
import pathToPosix from "../lib/pathToPosix";

/// Hello world command
function Index({}) {
  /** @type {[boolean, any]} */
  const [building, setBuilding] = React.useState(true);
  const [error, setError] = React.useState();

  React.useEffect(() => {
    async function run() {
      try {
        await buildArtifacts();
        setBuilding(false);
      } catch (error) {
        setError(error.message);
      }
    }
    run();
  }, []);

  if (error) {
    return (
      <Color red>
        <Text>❌</Text>
        <Text>{`  ${error}`}</Text>
      </Color>
    );
  }

  if (building) {
    return (
      <Box>
        <Color green>
          <Spinner type="dots" />
        </Color>
        {" Loading"}
      </Box>
    );
  }

  return (
    <Box>
      <Text>✅{"  It's done! Check output folder "}</Text>
      <Text>
        "<Color blue>.aws-next</Color>"
      </Text>
    </Box>
  );
}

Index.propTypes = {
  /// Name of the person to greet
  // name: PropTypes.string.isRequired,
};

async function buildArtifacts() {
  const hasServerlessArtifacts = await fse.pathExists(".next/serverless");
  if (!hasServerlessArtifacts) {
    throw new Error(
      ".next/serverless folder not found. make sure you run `next build` and that `next.config.js` target is set to 'serverless'"
    );
  }
  await fse.emptyDir(".aws-next");
  await fse.ensureDir(".aws-next/s3");
  const hasPublicFolder = await fse.pathExists("./public");
  if (hasPublicFolder) {
    // Copy /public folder
    await fse.copy("./public", ".aws-next/s3/public");
  }
  // Copy static files
  await fse.ensureDir(".aws-next/s3/_next");
  await fse.copy(".next/static", ".aws-next/s3/_next/static");

  // Copy static pages
  const pagesManifest = await fse.readJSON(
    ".next/serverless/pages-manifest.json"
  );
  // console.log(pagesManifest);
  await Promise.all(
    Object.values(pagesManifest)
      .filter((pageFile) => pageFile.endsWith(".html"))
      .map(async (staticPageFile) => {
        const relativePath = staticPageFile.replace(/^pages\//, "");
        const outputPath = `.aws-next/s3/static-pages/${relativePath}`;
        await fse.ensureFile(outputPath);
        await fse.copyFile(`.next/serverless/${staticPageFile}`, outputPath);
      })
  );
  const {
    defaultBuildManifest,
    apiBuildManifest,
  } = await createBuildManifests();
  await buildDefaultHandler(defaultBuildManifest);
  await buildApiHandler(apiBuildManifest);
}

async function buildDefaultHandler(manifest) {
  // build default lambda
  await fse.ensureDir(".aws-next/default-lambda");
  await Promise.all([
    fse.copyFile(
      path.join(__dirname, "../../handlers/default-handler.js"),
      ".aws-next/default-lambda/index.js"
    ),
    fse.copyFile(
      path.join(__dirname, "../../handlers/cloudfront-adapter.js"),
      ".aws-next/default-lambda/cloudfront-adapter.js"
    ),
    fse.writeJson(".aws-next/default-lambda/manifest.json", manifest),
    fse.copy(".next/serverless/pages", ".aws-next/default-lambda/pages", {
      filter: (filePath) => {
        const isNotPrerenderedHTMLPage = path.extname(filePath) !== ".html";
        const isNotStaticPropsJSONFile = path.extname(filePath) !== ".json";
        const isNotApiPage = pathToPosix(filePath).indexOf("pages/api") === -1;

        return (
          isNotApiPage && isNotPrerenderedHTMLPage && isNotStaticPropsJSONFile
        );
      },
    }),
    fse.copy(
      ".next/prerender-manifest.json",
      ".aws-next/default-lambda/prerender-manifest.json"
    ),
  ]);
}

async function buildApiHandler(manifest) {
  // build default lambda
  await fse.ensureDir(".aws-next/api-lambda");
  await Promise.all([
    fse.copyFile(
      path.join(__dirname, "../../handlers/api-handler.js"),
      ".aws-next/api-lambda/index.js"
    ),
    fse.copyFile(
      path.join(__dirname, "../../handlers/cloudfront-adapter.js"),
      ".aws-next/default-lambda/cloudfront-adapter.js"
    ),
    fse.writeJson(".aws-next/api-lambda/manifest.json", manifest),
    fse.copy(".next/serverless/pages/api", ".aws-next/api-lambda/pages/api"),
    fse.copy(
      ".next/serverless/pages/_error.js",
      ".aws-next/api-lambda/pages/_error.js"
    ),
  ]);
}

async function createBuildManifests() {
  const hasServerlessPageManifest = await fse.pathExists(
    ".next/serverless/pages-manifest.json"
  );
  if (!hasServerlessPageManifest) {
    throw new Error(
      "pages-manifest not found. make sure that `next.config.js` target is set to 'serverless'"
    );
  }
  const pagesManifest = await fse.readJSON(
    ".next/serverless/pages-manifest.json"
  );

  const dynamicRoutes = Object.keys(pagesManifest).filter(isDynamicRoute);
  let sortedPages = Object.keys(pagesManifest).reduce((pages, route) => {
    if (isDynamicRoute(route)) {
      return pages;
    }
    pages[route] = pagesManifest[route];
    return pages;
  }, {});
  getSortedRoutes(dynamicRoutes).forEach((route) => {
    sortedPages[route] = pagesManifest[route];
  });

  const defaultBuildManifest = {
    pages: {
      ssr: {
        dynamic: {},
        nonDynamic: {},
      },
      html: {
        dynamic: {},
        nonDynamic: {},
      },
    },
    publicFiles: {},
  };

  const apiBuildManifest = {
    apis: {
      dynamic: {},
      nonDynamic: {},
    },
  };

  const ssrPages = defaultBuildManifest.pages.ssr;
  const htmlPages = defaultBuildManifest.pages.html;
  const apiPages = apiBuildManifest.apis;

  const isHtmlPage = (path) => path.endsWith(".html");
  const isApiPage = (path) => path.startsWith("pages/api");

  Object.entries(pagesManifest).forEach(([route, pageFile]) => {
    const dynamicRoute = isDynamicRoute(route);
    const expressRoute = dynamicRoute ? expressifyDynamicRoute(route) : null;

    if (isHtmlPage(pageFile)) {
      if (dynamicRoute) {
        const route = expressRoute;
        htmlPages.dynamic[route] = {
          file: pageFile,
          regex: pathToRegexStr(route),
        };
      } else {
        htmlPages.nonDynamic[route] = pageFile;
      }
    } else if (isApiPage(pageFile)) {
      if (dynamicRoute) {
        const route = expressRoute;
        apiPages.dynamic[route] = {
          file: pageFile,
          regex: pathToRegexStr(route),
        };
      } else {
        apiPages.nonDynamic[route] = pageFile;
      }
    } else if (dynamicRoute) {
      const route = expressRoute;
      ssrPages.dynamic[route] = {
        file: pageFile,
        regex: pathToRegexStr(route),
      };
    } else {
      ssrPages.nonDynamic[route] = pageFile;
    }
  });

  // Add public files
  const prefix = `${process.cwd()}/public/`;
  for await (const item of klaw("./public")) {
    if (item.stats.isFile()) {
      const relativePath = item.path.replace(prefix, "");
      defaultBuildManifest.publicFiles[`/${relativePath}`] = relativePath;
    }
  }

  return {
    defaultBuildManifest,
    apiBuildManifest,
  };
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default Index;
