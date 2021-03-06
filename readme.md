# :chocolate_bar: aws-next

A CLI to build artifacts to deploy Next.js on AWS using Cloudfront and Lambda@edge

<a href="https://www.npmjs.org/package/aws-next">
  <img src="https://img.shields.io/npm/v/aws-next.svg" alt="Current npm package version." />
</a>

## Install

```bash
npm i -g aws-next
```

## Usage

Build your Next.js app (e.g. `next build`), then navigate to the root of your Next.js project and run:

```bash
$ aws-next
```

This will output the build artifacts under `.aws-next` folder. The artifacts are meant to be deployed using AWS CDK.

### Artifacts

- `s3`: contains static assets to be deployed to AWS S3
- `default-lambda`: contains the lambda@edge code to handle all page and assets requests
- `api-lambda`: contains the lambda@edge code to handle all api requests

## Inject environment variables

Lambda@edge [does not support environment variables](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-requirements-limits.html#lambda-requirements-lambda-function-configuration). To overcome this you can bundle your enviroment variables into your Next.js deploy. Alternatively, this CLI injects into `process.env` custom headers defined from the Cloudfront distribution that starts with `X-ENV-`.

## Contribute

Based on the contribution, format your commit message this way so that the version is correctly bumped:

- If the contribution is a breaking change, put `BREAKING CHANGE` or `major` somewhere in your commit.
- If the contribution is a new feature format your message like this "`feat`: added this new cool stuff". You can also use `minor` or `feature`
- All other changes will increment the patch version

In case you might want to skip version bumping just add `[skip ci]` to your commit.

### Publishing to NPM

To publish a new version to npm, just create a Github release. Once you create the release a Github workflow will take care of the publishing process.
