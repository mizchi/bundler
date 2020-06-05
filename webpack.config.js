const path = require("path");
module.exports = {
  entry: {
    bundler: path.join(__dirname, "src/index"),
  },
  output: {
    libraryTarget: "umd",
    filename: "[name].js",
  },
  resolve: {
    extensions: [".ts", ".js", ".mjs"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
            },
          },
        ],
      },
    ],
  },
};
