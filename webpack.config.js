module.exports = {
  mode: 'development',
  entry: {
    main: './src/cli/main.js',
    index: './src/index.js',
  },
  output: {
    path: __dirname + '/lib',
    filename: '[name].js',
    library: {type: 'commonjs2'},
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
