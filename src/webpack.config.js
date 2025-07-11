const path = require('path');

module.exports = [
  {
    mode: 'development',
    entry: './src/main.ts', // Main process pour Electron
    target: 'electron-main',
    module: {
      rules: [
        {
          test: /\.ts$/,
          include: [path.resolve(__dirname, 'src')],
          use: [{ loader: 'ts-loader' }]
        }
      ]
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'main.js'
    }
  },
  {
    mode: 'development',
    entry: './src/main.tsx', // Renderer process (ton app React)
    target: 'electron-renderer',
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          include: [path.resolve(__dirname, 'src')],
          use: [{ loader: 'ts-loader' }]
        }
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'renderer.js'
    }
  }
];