const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  target: 'node',
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  }
}
