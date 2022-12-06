module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: __dirname + '/lib',
    filename: '[name].js',
  },
  target: 'node',
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
    ],
  },
};
